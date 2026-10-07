import { cookies } from "next/headers";
import Link from "next/link";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/admin-auth";
import { listAdminRows } from "@/lib/admin-rows";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin · Trova Ricambio",
  robots: { index: false, follow: false },
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ errore?: string }>;
}) {
  const jar = await cookies();
  const allowed = verifyAdminSession(jar.get(ADMIN_COOKIE)?.value);
  if (!allowed) {
    const params = await searchParams;
    return (
      <div className="mx-auto w-full max-w-sm px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <form action="/api/admin/login" method="post" className="mt-6 space-y-4">
          <label className="block text-sm font-medium">
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-blue"
            />
          </label>
          {params.errore ? <p className="text-sm text-red-600">Password non corretta.</p> : null}
          <button type="submit" className="h-11 w-full rounded-xl bg-blue text-sm font-semibold text-white">
            Entra
          </button>
        </form>
      </div>
    );
  }

  const rows = await listAdminRows(300);
  return (
    <div className="h-full overflow-y-auto">
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lead e ricerche</h1>
          <p className="mt-1 text-sm text-muted">{rows.length} righe più recenti</p>
        </div>
        <div className="flex gap-3">
          <Link href="/api/admin/export" className="inline-flex h-10 items-center rounded-xl bg-blue px-4 text-sm font-semibold text-white">
            Esporta CSV
          </Link>
          <form action="/api/admin/logout" method="post">
            <button type="submit" className="h-10 rounded-xl border border-line bg-white px-4 text-sm font-medium">
              Esci
            </button>
          </form>
        </div>
      </div>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-3 py-3 font-medium">Data</th>
              <th className="px-3 py-3 font-medium">Email</th>
              <th className="px-3 py-3 font-medium">Azienda</th>
              <th className="px-3 py-3 font-medium">Foto</th>
              <th className="px-3 py-3 font-medium">Riconosciuto</th>
              <th className="px-3 py-3 font-medium">Alta confidenza</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-muted">
                  Nessuna ricerca ancora.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-line align-top">
                  <td className="px-3 py-3 whitespace-nowrap">
                    {row.createdAt.toLocaleString("it-IT", { timeZone: "Europe/Rome" })}
                  </td>
                  <td className="px-3 py-3">{row.email || "—"}</td>
                  <td className="px-3 py-3">{row.companyName || "—"}</td>
                  <td className="px-3 py-3">
                    {row.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <Link href={`/risultati/${row.id}`} className="font-medium text-blue">
                      {row.recognized}
                    </Link>
                    {row.codes ? <p className="mt-1 text-muted">{row.codes}</p> : null}
                  </td>
                  <td className="px-3 py-3">{row.highConfidence}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}
