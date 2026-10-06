import { prisma } from "@/lib/db";
import { dailySearchCap, startOfUtcDay } from "@/lib/format";

const EMAIL_DAILY_LIMIT = 10;

export const CAP_MESSAGE =
  "Per oggi abbiamo raggiunto il numero massimo di ricerche. Riprova domani: nel frattempo puoi parlare con Aftercore.";

export const EMAIL_LIMIT_MESSAGE =
  "Hai raggiunto il limite di 10 ricerche per oggi con questa email. Riprova domani.";

export const LEAD_REQUIRED_MESSAGE =
  "Per una nuova ricerca servono l'email aziendale, il nome dell'azienda e il consenso privacy.";

export async function anonymousSearchCount(ipHash: string) {
  return prisma.search.count({ where: { ipHash, leadId: null } });
}

export async function globalSearchCount() {
  return prisma.search.count({ where: { createdAt: { gte: startOfUtcDay() } } });
}

export async function getQuota(ipHash: string) {
  const [anonymous, globalCount] = await Promise.all([
    anonymousSearchCount(ipHash),
    globalSearchCount(),
  ]);
  const capped = globalCount >= dailySearchCap();
  return {
    requiresLead: anonymous >= 1,
    capped,
    message: capped ? CAP_MESSAGE : null,
  };
}

export async function assertCanSearch(input: { ipHash: string; leadId: string | null; hasLead: boolean }) {
  const quota = await getQuota(input.ipHash);
  if (quota.capped) {
    return { ok: false as const, status: 429, code: "daily_cap", message: CAP_MESSAGE };
  }
  if (!input.hasLead && quota.requiresLead) {
    return { ok: false as const, status: 403, code: "lead_required", message: LEAD_REQUIRED_MESSAGE };
  }
  if (input.leadId) {
    const used = await prisma.search.count({
      where: { leadId: input.leadId, createdAt: { gte: startOfUtcDay() } },
    });
    if (used >= EMAIL_DAILY_LIMIT) {
      return { ok: false as const, status: 429, code: "email_limit", message: EMAIL_LIMIT_MESSAGE };
    }
  }
  return { ok: true as const };
}
