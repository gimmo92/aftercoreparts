import { createHash } from "node:crypto";

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function hashIp(ip: string) {
  const salt = process.env.IP_HASH_SALT || "dev-salt-change-me";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function dailySearchCap() {
  const parsed = Number(process.env.DAILY_SEARCH_CAP ?? "100");
  if (!Number.isFinite(parsed) || parsed < 1) return 100;
  return Math.floor(parsed);
}

export function clip(value: string | null | undefined, max: number) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

export function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}
