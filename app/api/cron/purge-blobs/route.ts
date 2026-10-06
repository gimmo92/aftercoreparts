import { del } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { passwordsMatch } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!secret || !token || !passwordsMatch(token, secret)) {
    return Response.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);
  const rows = await prisma.search.findMany({
    where: {
      status: "completed",
      imageDeletedAt: null,
      createdAt: { lt: cutoff },
      NOT: { imageUrl: "" },
    },
    select: { id: true, imageUrl: true },
  });

  const seen = new Set<string>();
  let deleted = 0;
  for (const row of rows) {
    if (seen.has(row.imageUrl)) continue;
    seen.add(row.imageUrl);
    try {
      await del(row.imageUrl);
      await markDeleted(row.imageUrl);
      deleted += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "errore";
      if (/not found|404/i.test(message)) {
        await markDeleted(row.imageUrl);
        deleted += 1;
      } else {
        console.error(JSON.stringify({ event: "purge_failed", id: row.id, message }));
      }
    }
  }

  return Response.json({ deleted });
}

function markDeleted(imageUrl: string) {
  return prisma.search.updateMany({
    where: { imageUrl, imageDeletedAt: null },
    data: { imageDeletedAt: new Date() },
  });
}
