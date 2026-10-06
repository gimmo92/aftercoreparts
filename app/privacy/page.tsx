export const metadata = {
  title: "Privacy · Trova Ricambio",
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto w-full max-w-lg px-4 py-8">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange">Segnaposto</p>
      <h1 className="font-display mt-2 text-4xl">Informativa privacy</h1>
      <div className="mt-5 space-y-4 text-sm leading-6">
        <p>
          Questo testo è un segnaposto. Va sostituito con l&apos;informativa redatta dal responsabile del trattamento
          prima di raccogliere dati reali.
        </p>
        <p>
          Trova Ricambio, servizio di Aftercore, tratta la foto del ricambio per cercare online dove acquistarlo. L&apos;immagine
          viene conservata per 30 giorni e poi cancellata. Dalla seconda ricerca chiediamo email aziendale, nome
          dell&apos;azienda e un consenso esplicito.
        </p>
        <p>
          I risultati contengono link a siti di terzi. Quei siti trattano i dati secondo le loro informative. Compatibilità
          e disponibilità del pezzo vanno verificate con il venditore.
        </p>
        <p>Per domande sui dati: sostituire questo paragrafo con il contatto del titolare.</p>
      </div>
    </article>
  );
}
