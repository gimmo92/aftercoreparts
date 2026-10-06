import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

function secret() {
  return process.env.ADMIN_PASSWORD ?? "";
}

export function passwordsMatch(input: string, expected: string) {
  const left = createHash("sha256").update(input).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

export function signAdminSession() {
  const expiresAt = Date.now() + TWELVE_HOURS_MS;
  const payload = String(expiresAt);
  const signature = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

export function verifyAdminSession(token: string | undefined) {
  const password = secret();
  if (!password || !token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = createHmac("sha256", password).update(payload).digest("hex");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  if (!timingSafeEqual(actualBuffer, expectedBuffer)) return false;
  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

export const ADMIN_COOKIE = "admin_session";
