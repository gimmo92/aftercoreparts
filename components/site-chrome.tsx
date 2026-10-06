import Link from "next/link";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col">
      <div className="hazard shrink-0" />
      <header className="shrink-0 border-b border-ink/10">
        <div className="mx-auto flex w-full max-w-lg items-end justify-between px-4 py-3">
          <Link href="/" className="block">
            <p className="font-display text-2xl leading-none tracking-wide">TROVA RICAMBIO</p>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-ink/60">di Aftercore</p>
          </Link>
          <Link href="/privacy" className="text-sm text-ink/70 underline underline-offset-4">
            Privacy
          </Link>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
