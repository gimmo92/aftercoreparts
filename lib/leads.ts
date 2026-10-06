import { prisma } from "@/lib/db";
import { businessEmailError, normalizeEmail } from "@/lib/email";
import { clip } from "@/lib/format";

export function leadFieldError(input: { email: string; companyName: string; privacyConsent: boolean }) {
  const emailError = businessEmailError(input.email);
  if (emailError) return emailError;
  if (!clip(input.companyName, 120) || input.companyName.trim().length < 2) {
    return "Inserisci il nome dell'azienda.";
  }
  if (!input.privacyConsent) {
    return "Per continuare serve il consenso al trattamento dei dati.";
  }
  return null;
}

export async function upsertLead(input: { email: string; companyName: string }) {
  const email = normalizeEmail(input.email);
  const companyName = clip(input.companyName, 120) ?? input.companyName.trim();
  const existing = await prisma.lead.findUnique({ where: { email } });
  if (existing) {
    return prisma.lead.update({
      where: { email },
      data: { companyName },
    });
  }
  return prisma.lead.create({
    data: {
      email,
      companyName,
      privacyConsent: true,
      consentAt: new Date(),
    },
  });
}

export async function notifyLead(payload: {
  email: string;
  companyName: string;
  consentAt: string;
  searchId: string;
  componentType: string | null;
  brand: string | null;
  codes: string[];
}) {
  const webhook = process.env.LEAD_WEBHOOK_URL;
  if (!webhook) return;
  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error(JSON.stringify({ event: "lead_webhook_failed", status: response.status }));
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "lead_webhook_failed",
        message: error instanceof Error ? error.message : "errore",
      }),
    );
  }
}
