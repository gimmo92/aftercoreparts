import { clip } from "@/lib/format";
import { normalizeUrl } from "@/lib/urls";
import type { Candidate, CandidateOrigin } from "@/lib/search/types";

const SERP_ENDPOINT = "https://serpapi.com/search.json";
const TIMEOUT_MS = 20_000;

type SerpRecord = Record<string, unknown>;

function asRecord(value: unknown): SerpRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as SerpRecord;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? clip(value, max) : null;
}

export function formatPrice(price: unknown) {
  if (typeof price === "string") return clip(price, 40);
  const record = asRecord(price);
  if (!record) return null;
  if (typeof record.value === "string") return clip(record.value, 40);
  if (typeof record.extracted_value === "number" && typeof record.currency === "string") {
    return clip(`${record.extracted_value} ${record.currency}`, 40);
  }
  return null;
}

async function serpGet(params: Record<string, string>) {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) throw new Error("SERPAPI_API_KEY non configurata");
  const url = new URL(SERP_ENDPOINT);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("output", "json");
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SerpApi ${response.status}: ${body.slice(0, 180)}`);
  }
  return (await response.json()) as SerpRecord;
}

function toCandidate(input: {
  title: unknown;
  link: unknown;
  source: unknown;
  snippet: unknown;
  thumbnail: unknown;
  price: unknown;
  origin: CandidateOrigin;
}): Candidate | null {
  const url = typeof input.link === "string" ? normalizeUrl(input.link) : null;
  const title = text(input.title, 200);
  if (!url || !title) return null;
  return {
    title,
    url,
    source: text(input.source, 120),
    snippet: text(input.snippet, 300),
    thumbnailUrl: text(input.thumbnail, 500),
    price: formatPrice(input.price),
    origin: input.origin,
  };
}

export async function searchLens(imageUrl: string) {
  const json = await serpGet({
    engine: "google_lens",
    url: imageUrl,
    type: "visual_matches",
    hl: "it",
    country: "it",
  });
  return asArray(json.visual_matches)
    .map((item) => {
      const record = asRecord(item);
      if (!record) return null;
      return toCandidate({
        title: record.title,
        link: record.link,
        source: record.source,
        snippet: record.snippet,
        thumbnail: record.thumbnail,
        price: record.price,
        origin: "lens",
      });
    })
    .filter((item): item is Candidate => item !== null);
}

export async function searchGoogle(query: string, origin: "google_code" | "google_query") {
  const json = await serpGet({
    engine: "google",
    q: query,
    hl: "it",
    gl: "it",
    google_domain: "google.it",
    num: "10",
  });
  const organic = asArray(json.organic_results)
    .map((item) => {
      const record = asRecord(item);
      if (!record) return null;
      return toCandidate({
        title: record.title,
        link: record.link,
        source: record.source,
        snippet: record.snippet,
        thumbnail: record.thumbnail,
        price: record.price ?? richPrice(record),
        origin,
      });
    })
    .filter((item): item is Candidate => item !== null);
  const shopping = asArray(json.shopping_results)
    .map((item) => {
      const record = asRecord(item);
      if (!record) return null;
      return toCandidate({
        title: record.title,
        link: record.link ?? record.product_link,
        source: record.source,
        snippet: record.snippet,
        thumbnail: record.thumbnail,
        price: record.price,
        origin: "shopping",
      });
    })
    .filter((item): item is Candidate => item !== null);
  return [...organic, ...shopping];
}

function richPrice(record: SerpRecord) {
  const rich = asRecord(record.rich_snippet);
  const bottom = asRecord(rich?.bottom);
  const extensions = asRecord(bottom?.detected_extensions);
  return extensions?.price ?? null;
}

const ORIGIN_RANK: Record<CandidateOrigin, number> = {
  google_code: 0,
  shopping: 1,
  lens: 2,
  google_query: 3,
};

export function mergeCandidates(lists: Candidate[][]) {
  const ordered = lists.flat().sort((a, b) => ORIGIN_RANK[a.origin] - ORIGIN_RANK[b.origin]);
  const map = new Map<string, Candidate>();
  for (const candidate of ordered) {
    const url = normalizeUrl(candidate.url);
    if (!url) continue;
    const normalized = { ...candidate, url };
    const existing = map.get(url);
    if (!existing) {
      map.set(url, normalized);
      continue;
    }
    map.set(url, {
      ...existing,
      title: existing.title || normalized.title,
      source: existing.source || normalized.source,
      snippet: existing.snippet || normalized.snippet,
      thumbnailUrl: existing.thumbnailUrl || normalized.thumbnailUrl,
      price: existing.price || normalized.price,
    });
  }
  return [...map.values()].slice(0, 15);
}
