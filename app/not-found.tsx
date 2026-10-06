import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-12">
      <h1 className="font-display text-4xl">Pagina non trovata</h1>
      <Link href="/" className="mt-4 inline-flex font-semibold text-orange">
        Torna all&apos;inizio
      </Link>
    </div>
  );
}
