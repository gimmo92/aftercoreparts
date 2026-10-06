import { SearchForm } from "@/components/search-form";

const STEPS = [
  "Scatta il pezzo o la targhetta, anche dal telefono in officina.",
  "Leggiamo tipo, marca e codici e cerchiamo dove è in vendita.",
  "Ti mostriamo i rivenditori con un livello di confidenza.",
];

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange">Per officine e dealer</p>
      <h1 className="font-display mt-2 text-5xl leading-[0.95] tracking-tight">
        Trova il ricambio partendo da una foto
      </h1>
      <ol className="mt-6 space-y-3">
        {STEPS.map((step, index) => (
          <li key={step} className="flex gap-3 text-base leading-6">
            <span className="font-display mt-0.5 text-xl text-orange">{index + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <SearchForm />
    </div>
  );
}
