import Link from "next/link";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="hazard" />
      <header className="border-b border-ink/10">
        <div className="mx-auto flex w-full max-w-lg items-end justify-between px-4 py-3">
          <Link href="/" className="block">
            <p className="font-display text-2xl leading-none tracking-wide">TROVA RICAMBIO</p>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-ink/60">di Aftercore</p>
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-ink/10">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-4 px-4 py-4 text-sm text-ink/70">
          <p>Aftercore</p>
          <Link href="/privacy" className="underline underline-offset-4">
            Privacy
          </Link>
        </div>
      </footer>
    </>
  );
}
