import { readFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Candidate, Extraction, VerifiedCandidate } from "@/lib/search/types";

const extractionSchema = z.object({
  tipo_componente: z.string(),
  marca: z.union([z.string(), z.null()]).optional(),
  codici: z.array(z.string()).optional(),
  caratteristiche_visibili: z.string().optional(),
  query_suggerite: z.array(z.string()).optional(),
});

const verdictSchema = z.object({
  url: z.string(),
  pertinente: z.boolean(),
  confidenza: z.enum(["alta", "media", "bassa"]),
  motivazione: z.string(),
  vende_pezzo: z.boolean(),
});

const verifySchema = z.object({
  risultati: z.array(verdictSchema),
});

export type TokenUsage = { input: number; output: number };

function emptyUsage(): TokenUsage {
  return { input: 0, output: 0 };
}

export function loadPrompt(name: "extract.md" | "verify.md") {
  return readFileSync(join(process.cwd(), "prompts", name), "utf8");
}

function parseJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("JSON assente nella risposta del modello");
  }
  return JSON.parse(raw.slice(start, end + 1)) as unknown;
}

function client() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.VLM_MODEL;
  if (!apiKey || !model) {
    throw new Error("ANTHROPIC_API_KEY o VLM_MODEL non configurati");
  }
  return { anthropic: new Anthropic({ apiKey, timeout: 45_000 }), model };
}

async function askVision(prompt: string, jpeg: Buffer, maxTokens: number) {
  const { anthropic, model } = client();
  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    temperature: 0,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
  return {
    text,
    usage: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
    } satisfies TokenUsage,
  };
}

function normalizeExtraction(value: z.infer<typeof extractionSchema>): Extraction {
  const marca = value.marca?.trim() || null;
  const codici = [...new Set((value.codici ?? []).map((code) => code.trim()).filter((code) => code.length >= 3))].slice(
    0,
    8,
  );
  const query = (value.query_suggerite ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 3);
  return {
    tipo_componente: value.tipo_componente.trim().slice(0, 200) || "Componente non identificato",
    marca: marca ? marca.slice(0, 120) : null,
    codici,
    caratteristiche_visibili: (value.caratteristiche_visibili ?? "").trim().slice(0, 800),
    query_suggerite: query,
  };
}

export async function extractPart(
  jpeg: Buffer,
  context: { machineBrand: string | null; machineModel: string | null; notes: string | null },
) {
  const prompt = `${loadPrompt("extract.md")}

Contesto fornito dall'utente. Può essere incompleto: non trattarlo come un codice letto dalla foto.
- Marca macchina: ${context.machineBrand || "non indicata"}
- Modello macchina: ${context.machineModel || "non indicato"}
- Note: ${context.notes || "nessuna"}`;

  let usage = emptyUsage();
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const extra = attempt === 0 ? "" : "\n\nLa risposta precedente non era JSON valido. Rispondi solo con l'oggetto JSON.";
    try {
      const answer = await askVision(prompt + extra, jpeg, 1024);
      usage = {
        input: usage.input + answer.usage.input,
        output: usage.output + answer.usage.output,
      };
      const parsed = extractionSchema.parse(parseJson(answer.text));
      return { data: normalizeExtraction(parsed), usage };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Estrazione non riuscita");
}

export async function verifyCandidates(jpeg: Buffer, extraction: Extraction, candidates: Candidate[]) {
  const payload = candidates.map((candidate, index) => ({
    indice: index + 1,
    url: candidate.url,
    titolo: candidate.title,
    snippet: candidate.snippet,
    fonte: candidate.source,
    prezzo: candidate.price,
    miniatura: candidate.thumbnailUrl,
    origine: candidate.origin,
  }));
  const prompt = `${loadPrompt("verify.md")}

Dati estratti dalla foto:
${JSON.stringify(extraction)}

Candidati:
${JSON.stringify(payload)}`;

  let usage = emptyUsage();
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const extra = attempt === 0 ? "" : "\n\nLa risposta precedente non era JSON valido. Rispondi solo con l'oggetto JSON.";
    try {
      const answer = await askVision(prompt + extra, jpeg, 2500);
      usage = {
        input: usage.input + answer.usage.input,
        output: usage.output + answer.usage.output,
      };
      const parsed = verifySchema.parse(parseJson(answer.text));
      return { data: parsed.risultati, usage };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Verifica non riuscita");
}

export function fallbackVerdicts(candidates: Candidate[]): VerifiedCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    pertinente: true,
    confidenza: "bassa",
    motivazione: "Non è stato possibile verificare questo risultato.",
    vende_pezzo: Boolean(candidate.price),
  }));
}
