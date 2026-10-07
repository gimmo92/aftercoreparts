import Link from "next/link";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col bg-paper text-ink">
      <header className="flex h-14 shrink-0 items-center gap-6 border-b border-line bg-white px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-blue text-white">
            <Mark />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">aftercore</span>
        </Link>
        <nav className="flex min-w-0 items-center gap-1 overflow-x-auto text-sm">
          <Link href="/" className="inline-flex items-center gap-2 rounded-lg bg-soft px-3 py-1.5 font-medium whitespace-nowrap text-blue">
            <ChatIcon />
            Trova ricambio
          </Link>
          <Link href="/privacy" className="rounded-lg px-3 py-1.5 whitespace-nowrap text-muted hover:bg-paper hover:text-ink">
            Privacy
          </Link>
        </nav>
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}

function Mark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 8h3.2M9.3 8h3.2M8 3.5v3.2M8 9.3v3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8" cy="8" r="1.35" fill="currentColor" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 4.5h10v6.2a1 1 0 0 1-1 1H6.2L3.5 14V4.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
