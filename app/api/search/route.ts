import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { getClientIp, hashIp } from "@/lib/format";
import { leadFieldError, upsertLead } from "@/lib/leads";
import { assertCanSearch } from "@/lib/rate-limit";
import { ImageError, prepareImage } from "@/lib/search/image";
import { runSearch } from "@/lib/search/pipeline";
import { readIncomingSearch } from "@/lib/search/request";
import type { SearchEvent } from "@/lib/search/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ message, code }, { status });
}

export async function POST(request: Request) {
  let tempBlobUrl: string | null = null;
  try {
    const incoming = await readIncomingSearch(request);
    tempBlobUrl = incoming.tempBlobUrl;
    const prepared = await prepareImage(incoming.image);
    const ipHash = hashIp(getClientIp(request));
    const wantsLead = Boolean(incoming.email.trim() || incoming.companyName.trim());
    let lead: { id: string; email: string; companyName: string; consentAt: Date } | null = null;

    if (wantsLead) {
      const fieldError = leadFieldError(incoming);
      if (fieldError) {
        if (tempBlobUrl) await del(tempBlobUrl).catch(() => undefined);
        return jsonError(fieldError, 400, "invalid_lead");
      }
      const saved = await upsertLead(incoming);
      lead = {
        id: saved.id,
        email: saved.email,
        companyName: saved.companyName,
        consentAt: saved.consentAt,
      };
    }

    const decision = await assertCanSearch({
      ipHash,
      leadId: lead?.id ?? null,
      hasLead: Boolean(lead),
    });
    if (!decision.ok) {
      if (tempBlobUrl) await del(tempBlobUrl).catch(() => undefined);
      return jsonError(decision.message, decision.status, decision.code);
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: SearchEvent) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };
        try {
          for await (const event of runSearch({
            jpeg: prepared.jpeg,
            hash: prepared.hash,
            tempBlobUrl,
            machineBrand: incoming.machineBrand,
            machineModel: incoming.machineModel,
            notes: incoming.notes,
            ipHash,
            lead,
          })) {
            send(event);
          }
        } catch (error) {
          console.error(
            JSON.stringify({
              event: "search_failed",
              message: error instanceof Error ? error.message : "errore",
            }),
          );
          send({ type: "error", message: "Ricerca interrotta. Riprova tra poco." });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    if (tempBlobUrl) await del(tempBlobUrl).catch(() => undefined);
    if (error instanceof ImageError) return jsonError(error.message, 400, "invalid_image");
    console.error(error);
    return jsonError("Servizio non disponibile. Riprova tra poco.", 500, "unavailable");
  }
}
