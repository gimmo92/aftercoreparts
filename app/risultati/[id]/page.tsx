import Link from "next/link";
import { notFound } from "next/navigation";
import { DISCLAIMER, PHOTO_TIPS, type PublicResult } from "@/lib/search/types";
import { loadPublicSearch } from "@/lib/search/load";
import { siteLabel } from "@/lib/urls";

export const dynamic = "force-dynamic";

const BADGE: Record<PublicResult["confidence"], string> = {
  alta: "bg-emerald-50 text-emerald-700",
  media: "bg-amber-50 text-amber-700",
  bassa: "bg-paper text-muted",
};

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const search = await loadPublicSearch(id);
  if (!search) notFound();
  const calendarUrl = process.env.CALENDAR_URL || "";
  const context = [search.machineBrand, search.machineModel].filter(Boolean).join(" ");

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">Risultati</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Cosa abbiamo letto</h1>

        <section className="mt-5 rounded-2xl border border-line bg-white p-4">
          {search.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={search.imageUrl} alt="Foto analizzata" className="mb-4 max-h-56 w-full rounded-xl bg-paper object-contain" />
          ) : null}
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">Tipo componente</dt>
              <dd className="mt-1 font-medium">{search.recognition.tipo_componente || "Non identificato"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">Marca</dt>
              <dd className="mt-1 font-medium">{search.recognition.marca || "Non visibile"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">Codici letti</dt>
              <dd className="mt-1 flex flex-wrap gap-2">
                {search.recognition.codici.length > 0 ? (
                  search.recognition.codici.map((code) => (
                    <span key={code} className="rounded-full bg-soft px-3 py-1 text-sm font-medium text-blue">
                      {code}
                    </span>
                  ))
                ) : (
                  <span>Nessun codice leggibile</span>
                )}
              </dd>
            </div>
            {search.recognition.caratteristiche_visibili ? (
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">Caratteristiche</dt>
                <dd className="mt-1">{search.recognition.caratteristiche_visibili}</dd>
              </div>
            ) : null}
            {context ? (
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">Macchina indicata</dt>
                <dd className="mt-1">{context}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        {!search.reliable ? (
          <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <h2 className="text-base font-semibold">Nessun risultato affidabile</h2>
            <p className="mt-2 text-sm leading-6">
              Non abbiamo trovato una corrispondenza abbastanza sicura da indicarti un acquisto. Rifai la foto così:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6">
              {PHOTO_TIPS.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {search.results.length > 0 ? (
          <section className="mt-6">
            <h2 className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
              {search.reliable ? "Dove compare" : "Corrispondenze deboli"}
            </h2>
            <ul className="mt-3 overflow-hidden rounded-2xl border border-line bg-white">
              {search.results.map((result) => (
                <li key={result.url} className="border-b border-line p-4 last:border-b-0">
                  <div className="flex gap-3">
                    {result.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={result.thumbnailUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div className="h-16 w-16 shrink-0 rounded-lg bg-paper" />
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold leading-5 text-blue">{result.title}</p>
                      <p className="mt-1 text-sm text-muted">{siteLabel(result.url, result.source)}</p>
                      {result.price ? <p className="mt-1 text-sm font-medium">{result.price}</p> : null}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${BADGE[result.confidence]}`}>
                      {result.confidence}
                    </span>
                    <span className="text-xs text-muted">{result.sellsPart ? "Sembra in vendita" : "Pagina informativa"}</span>
                  </div>
                  <p className="mt-2 text-sm leading-5">{result.reason}</p>
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex text-sm font-medium text-blue"
                  >
                    Apri scheda
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="mt-6 text-sm leading-6 text-muted">{DISCLAIMER}</p>

        <section className="mt-6 rounded-2xl border border-line bg-white px-4 py-5">
          <p className="text-base font-semibold">Vuoi la ricerca per foto sul tuo magazzino ricambi?</p>
          {calendarUrl ? (
            <a
              href={calendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex h-10 items-center rounded-xl bg-blue px-4 text-sm font-semibold text-white"
            >
              Parla con Aftercore
            </a>
          ) : (
            <p className="mt-3 text-sm text-muted">Parla con Aftercore</p>
          )}
        </section>

        <Link href="/" className="mt-6 inline-flex text-sm font-medium text-blue">
          Nuova ricerca
        </Link>
      </div>
    </div>
  );
}
