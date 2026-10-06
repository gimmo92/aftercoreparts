import { del, put } from "@vercel/blob";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { notifyLead } from "@/lib/leads";
import { normalizeUrl } from "@/lib/urls";
import { mergeCandidates, searchGoogle, searchLens } from "@/lib/search/serp";
import { SEARCH_STEPS, type Candidate, type Extraction, type SearchEvent, type VerifiedCandidate } from "@/lib/search/types";
import { extractPart, fallbackVerdicts, verifyCandidates } from "@/lib/search/vlm";
import { toPublicSearch } from "@/lib/search/present";

const CONFIDENCE_RANK = { alta: 0, media: 1, bassa: 2 };

export type SearchRunInput = {
  jpeg: Buffer;
  hash: string;
  tempBlobUrl: string | null;
  machineBrand: string | null;
  machineModel: string | null;
  notes: string | null;
  ipHash: string;
  lead: { id: string; email: string; companyName: string; consentAt: Date } | null;
};

function step(id: (typeof SEARCH_STEPS)[number]["id"]): SearchEvent {
  const found = SEARCH_STEPS.find((item) => item.id === id)!;
  return { type: "step", id: found.id, label: found.label };
}

function emptyExtraction(): Extraction {
  return {
    tipo_componente: "Componente non identificato",
    marca: null,
    codici: [],
    caratteristiche_visibili: "",
    query_suggerite: [],
  };
}

async function uploadResized(hash: string, jpeg: Buffer) {
  const blob = await put(`ricambi/${hash}.jpg`, jpeg, {
    access: "public",
    contentType: "image/jpeg",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return { url: blob.url, pathname: blob.pathname };
}

async function discardTemp(tempBlobUrl: string | null, keepUrl: string | null) {
  if (!tempBlobUrl || tempBlobUrl === keepUrl) return;
  try {
    await del(tempBlobUrl);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "blob_delete_failed",
        message: error instanceof Error ? error.message : "errore",
      }),
    );
  }
}

function codeQuery(code: string, brand: string | null) {
  const quoted = `"${code.replace(/"/g, "")}"`;
  return brand ? `${quoted} ${brand}` : quoted;
}

async function collectCandidates(imageUrl: string, extraction: Extraction) {
  let serpApiCalls = 0;
  const tasks: Promise<Candidate[]>[] = [];

  const track = (run: () => Promise<Candidate[]>) => {
    serpApiCalls += 1;
    return run().catch((error: unknown) => {
      console.error(
        JSON.stringify({
          event: "serpapi_failed",
          message: error instanceof Error ? error.message : "errore",
        }),
      );
      return [] as Candidate[];
    });
  };

  tasks.push(track(() => searchLens(imageUrl)));
  const codes = extraction.codici.slice(0, 2);
  if (codes.length > 0) {
    for (const code of codes) {
      tasks.push(track(() => searchGoogle(codeQuery(code, extraction.marca), "google_code")));
    }
  } else if (extraction.query_suggerite[0]) {
    tasks.push(track(() => searchGoogle(extraction.query_suggerite[0], "google_query")));
  }

  const lists = await Promise.all(tasks);
  return { candidates: mergeCandidates(lists), serpApiCalls };
}

function hasExactCode(candidate: Candidate, codes: string[]) {
  const haystack = `${candidate.title} ${candidate.snippet ?? ""} ${candidate.url}`.toLowerCase();
  return codes.some((code) => code.length >= 4 && haystack.includes(code.toLowerCase()));
}

function selectResults(
  candidates: Candidate[],
  verdicts: { url: string; pertinente: boolean; confidenza: "alta" | "media" | "bassa"; motivazione: string; vende_pezzo: boolean }[],
  codes: string[],
) {
  const byUrl = new Map(candidates.map((candidate) => [candidate.url, candidate]));
  const paired = verdicts.flatMap((verdict) => {
    const url = normalizeUrl(verdict.url) ?? verdict.url;
    const candidate = byUrl.get(url) ?? candidates.find((item) => item.url === verdict.url);
    return candidate ? [{ candidate, verdict }] : [];
  });
  const rows =
    paired.length > 0 || verdicts.length !== candidates.length
      ? paired
      : candidates.map((candidate, index) => ({ candidate, verdict: verdicts[index]! }));

  const merged: VerifiedCandidate[] = [];
  for (const { candidate, verdict } of rows) {
    const exact = hasExactCode(candidate, codes);
    if (!verdict.pertinente && !exact) continue;
    merged.push({
      ...candidate,
      pertinente: true,
      confidenza: exact ? "alta" : verdict.confidenza,
      motivazione: verdict.motivazione.trim().slice(0, 240) || "Corrispondenza da verificare.",
      vende_pezzo: verdict.vende_pezzo,
    });
  }
  merged.sort((a, b) => CONFIDENCE_RANK[a.confidenza] - CONFIDENCE_RANK[b.confidenza]);
  const reliable = merged.some((item) => item.confidenza === "alta" || item.confidenza === "media");
  const pool = reliable ? merged : merged.filter((item) => item.confidenza === "bassa");
  return pool.slice(0, 8);
}

export async function* runSearch(input: SearchRunInput): AsyncGenerator<SearchEvent> {
  yield step("analyze");

  const cached = await prisma.search.findFirst({
    where: { imageHash: input.hash, status: "completed" },
    orderBy: { createdAt: "desc" },
    include: { results: { orderBy: { position: "asc" } } },
  });

  if (cached) {
    const hit = await prisma.search.create({
      data: {
        imageHash: cached.imageHash,
        imageUrl: cached.imageUrl,
        blobPath: cached.blobPath,
        imageDeletedAt: cached.imageDeletedAt,
        machineBrand: input.machineBrand,
        machineModel: input.machineModel,
        notes: input.notes,
        ipHash: input.ipHash,
        leadId: input.lead?.id,
        cacheOfId: cached.id,
        componentType: cached.componentType,
        brand: cached.brand,
        codes: cached.codes as Prisma.InputJsonValue,
        visibleFeatures: cached.visibleFeatures,
        suggestedQueries: cached.suggestedQueries as Prisma.InputJsonValue,
        status: "cache_hit",
      },
    });
    await discardTemp(input.tempBlobUrl, cached.imageUrl);
    console.log(
      JSON.stringify({
        event: "search_complete",
        searchId: hit.id,
        cached: true,
        serpApiCalls: 0,
        vlmInputTokens: 0,
        vlmOutputTokens: 0,
      }),
    );
    yield step("search");
    yield step("verify");
    if (input.lead) {
      await notifyLead({
        email: input.lead.email,
        companyName: input.lead.companyName,
        consentAt: input.lead.consentAt.toISOString(),
        searchId: hit.id,
        componentType: cached.componentType,
        brand: cached.brand,
        codes: Array.isArray(cached.codes) ? cached.codes.filter((code) => typeof code === "string") : [],
      });
    }
    yield {
      type: "result",
      data: toPublicSearch({
        id: hit.id,
        cached: true,
        imageUrl: cached.imageUrl,
        imageDeletedAt: cached.imageDeletedAt,
        machineBrand: input.machineBrand,
        machineModel: input.machineModel,
        componentType: cached.componentType,
        brand: cached.brand,
        codes: cached.codes,
        visibleFeatures: cached.visibleFeatures,
        results: cached.results,
      }),
    };
    return;
  }

  let uploaded: { url: string; pathname: string };
  try {
    uploaded = await uploadResized(input.hash, input.jpeg);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "blob_upload_failed",
        message: error instanceof Error ? error.message : "errore",
      }),
    );
    await discardTemp(input.tempBlobUrl, null);
    yield { type: "error", message: "Non riesco a salvare la foto. Riprova tra poco." };
    return;
  }
  await discardTemp(input.tempBlobUrl, uploaded.url);

  let extraction = emptyExtraction();
  let vlmInputTokens = 0;
  let vlmOutputTokens = 0;
  try {
    const extracted = await extractPart(input.jpeg, input);
    extraction = extracted.data;
    vlmInputTokens += extracted.usage.input;
    vlmOutputTokens += extracted.usage.output;
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "vlm_extract_failed",
        message: error instanceof Error ? error.message : "errore",
      }),
    );
    if (input.machineBrand || input.machineModel) {
      extraction.query_suggerite = [
        [input.machineBrand, input.machineModel, "ricambio"].filter(Boolean).join(" "),
      ];
    }
  }

  yield step("search");
  const { candidates, serpApiCalls } = await collectCandidates(uploaded.url, extraction);

  yield step("verify");
  let selected: VerifiedCandidate[] = [];
  if (candidates.length > 0) {
    try {
      const verified = await verifyCandidates(input.jpeg, extraction, candidates);
      vlmInputTokens += verified.usage.input;
      vlmOutputTokens += verified.usage.output;
      selected =
        verified.data.length === 0
          ? selectResults(candidates, fallbackVerdicts(candidates), extraction.codici)
          : selectResults(candidates, verified.data, extraction.codici);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "vlm_verify_failed",
          message: error instanceof Error ? error.message : "errore",
        }),
      );
      selected = selectResults(candidates, fallbackVerdicts(candidates), extraction.codici);
    }
  }

  const saved = await prisma.search.create({
    data: {
      imageHash: input.hash,
      imageUrl: uploaded.url,
      blobPath: uploaded.pathname,
      machineBrand: input.machineBrand,
      machineModel: input.machineModel,
      notes: input.notes,
      ipHash: input.ipHash,
      leadId: input.lead?.id,
      componentType: extraction.tipo_componente,
      brand: extraction.marca,
      codes: extraction.codici,
      visibleFeatures: extraction.caratteristiche_visibili || null,
      suggestedQueries: extraction.query_suggerite,
      status: "completed",
      serpApiCalls,
      vlmInputTokens,
      vlmOutputTokens,
      results: {
        create: selected.map((result, index) => ({
          position: index + 1,
          title: result.title,
          url: result.url,
          source: result.source,
          snippet: result.snippet,
          thumbnailUrl: result.thumbnailUrl,
          price: result.price,
          confidence: result.confidenza,
          reason: result.motivazione,
          sellsPart: result.vende_pezzo,
          origin: result.origin,
        })),
      },
    },
    include: { results: { orderBy: { position: "asc" } } },
  });

  console.log(
    JSON.stringify({
      event: "search_complete",
      searchId: saved.id,
      cached: false,
      serpApiCalls,
      vlmInputTokens,
      vlmOutputTokens,
      resultCount: saved.results.length,
    }),
  );

  if (input.lead) {
    await notifyLead({
      email: input.lead.email,
      companyName: input.lead.companyName,
      consentAt: input.lead.consentAt.toISOString(),
      searchId: saved.id,
      componentType: saved.componentType,
      brand: saved.brand,
      codes: extraction.codici,
    });
  }

  yield {
    type: "result",
    data: toPublicSearch({
      id: saved.id,
      cached: false,
      imageUrl: saved.imageUrl,
      imageDeletedAt: null,
      machineBrand: saved.machineBrand,
      machineModel: saved.machineModel,
      componentType: saved.componentType,
      brand: saved.brand,
      codes: saved.codes,
      visibleFeatures: saved.visibleFeatures,
      results: saved.results,
    }),
  };
}
