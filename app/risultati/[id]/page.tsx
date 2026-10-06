import Link from "next/link";
import { notFound } from "next/navigation";
import { DISCLAIMER, PHOTO_TIPS, type PublicResult } from "@/lib/search/types";
import { loadPublicSearch } from "@/lib/search/load";
import { siteLabel } from "@/lib/urls";

export const dynamic = "force-dynamic";

const BADGE: Record<PublicResult["confidence"], string> = {
  alta: "bg-emerald-700 text-white",
  media: "bg-amber-600 text-white",
  bassa: "bg-ink/70 text-white",
};

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const search = await loadPublicSearch(id);
  if (!search) notFound();
  const calendarUrl = process.env.CALENDAR_URL || "";
  const context = [search.machineBrand, search.machineModel].filter(Boolean).join(" ");

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange">Risultati</p>
      <h1 className="font-display mt-2 text-4xl leading-none">Cosa abbiamo letto</h1>

      <section className="mt-5 rounded-2xl border border-ink/10 bg-card p-4">
        {search.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={search.imageUrl} alt="Foto analizzata" className="mb-4 max-h-56 w-full rounded-xl object-contain" />
        ) : null}
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-ink/60">Tipo componente</dt>
            <dd className="text-base font-semibold">{search.recognition.tipo_componente || "Non identificato"}</dd>
          </div>
          <div>
            <dt className="text-ink/60">Marca</dt>
            <dd className="text-base font-semibold">{search.recognition.marca || "Non visibile"}</dd>
          </div>
          <div>
            <dt className="text-ink/60">Codici letti</dt>
            <dd className="mt-1 flex flex-wrap gap-2">
              {search.recognition.codici.length > 0 ? (
                search.recognition.codici.map((code) => (
                  <span key={code} className="rounded-full bg-ink px-3 py-1 text-sm text-white">
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
              <dt className="text-ink/60">Caratteristiche</dt>
              <dd>{search.recognition.caratteristiche_visibili}</dd>
            </div>
          ) : null}
          {context ? (
            <div>
              <dt className="text-ink/60">Macchina indicata</dt>
              <dd>{context}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {!search.reliable ? (
        <section className="mt-4 rounded-2xl border border-orange/40 bg-white p-4">
          <h2 className="font-display text-2xl">Nessun risultato affidabile</h2>
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
          <h2 className="font-display text-2xl">{search.reliable ? "Dove compare" : "Corrispondenze deboli"}</h2>
          <ul className="mt-3 space-y-3">
            {search.results.map((result) => (
              <li key={result.url} className="rounded-2xl border border-ink/10 bg-card p-3">
                <div className="flex gap-3">
                  {result.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={result.thumbnailUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="h-16 w-16 shrink-0 rounded-lg bg-ink/5" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold leading-5">{result.title}</p>
                    <p className="mt-1 text-sm text-ink/60">{siteLabel(result.url, result.source)}</p>
                    {result.price ? <p className="mt-1 text-sm font-semibold">{result.price}</p> : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${BADGE[result.confidence]}`}>
                    {result.confidence}
                  </span>
                  <span className="text-xs text-ink/60">{result.sellsPart ? "Sembra in vendita" : "Pagina informativa"}</span>
                </div>
                <p className="mt-2 text-sm leading-5">{result.reason}</p>
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex h-11 items-center text-sm font-semibold text-orange"
                >
                  Apri scheda
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-6 text-sm leading-6 text-ink/70">{DISCLAIMER}</p>

      <section className="mt-6 rounded-2xl bg-ink px-4 py-5 text-white">
        <p className="font-display text-3xl leading-none">Vuoi la ricerca per foto sul tuo magazzino ricambi?</p>
        {calendarUrl ? (
          <a
            href={calendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex h-12 items-center rounded-xl bg-orange px-4 font-semibold"
          >
            Parla con Aftercore
          </a>
        ) : (
          <p className="mt-3 text-sm">Parla con Aftercore</p>
        )}
      </section>

      <Link href="/" className="mt-6 inline-flex text-sm font-semibold underline underline-offset-4">
        Nuova ricerca
      </Link>
    </div>
  );
}
