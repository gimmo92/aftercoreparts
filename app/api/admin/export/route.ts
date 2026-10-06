import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/admin-auth";
import { listAdminRows } from "@/lib/admin-rows";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cell(value: string) {
  if (/[";\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET() {
  const jar = await cookies();
  if (!verifyAdminSession(jar.get(ADMIN_COOKIE)?.value)) {
    return new Response("Non autorizzato", { status: 401 });
  }
  const rows = await listAdminRows(5000);
  const header = ["Data", "Email", "Azienda", "Riconosciuto", "Codici", "Risultati alta confidenza", "URL immagine", "ID ricerca"];
  const lines = [
    header.join(";"),
    ...rows.map((row) =>
      [
        row.createdAt.toISOString(),
        row.email,
        row.companyName,
        row.recognized,
        row.codes,
        String(row.highConfidence),
        row.imageUrl ?? "",
        row.id,
      ]
        .map(cell)
        .join(";"),
    ),
  ];
  return new Response(`\uFEFF${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"lead-ricerche.csv\"",
    },
  });
}
