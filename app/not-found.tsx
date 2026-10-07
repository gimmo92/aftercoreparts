import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-lg px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Pagina non trovata</h1>
      <Link href="/" className="mt-4 inline-flex font-medium text-blue">
        Torna all&apos;inizio
      </Link>
    </div>
  );
}
