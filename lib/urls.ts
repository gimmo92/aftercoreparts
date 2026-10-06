const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "fbclid",
  "srsltid",
  "gbraid",
  "wbraid",
];

export function isBlobUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export function normalizeUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (
      host === "serpapi.com" ||
      host.endsWith(".serpapi.com") ||
      host === "webcache.googleusercontent.com" ||
      ((host === "google.com" || host.endsWith(".google.com") || host.endsWith(".google.it")) &&
        (url.pathname.startsWith("/search") || url.pathname.startsWith("/url")))
    ) {
      return null;
    }
    url.hash = "";
    url.hostname = host;
    for (const key of TRACKING_PARAMS) url.searchParams.delete(key);
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function siteLabel(url: string, source: string | null) {
  if (source?.trim()) return source.trim();
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
