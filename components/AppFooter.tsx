import Link from "next/link";

export function AppFooter({ lastEvaluatedAt }: { lastEvaluatedAt?: number }) {
  const evalLabel = lastEvaluatedAt
    ? new Date(lastEvaluatedAt).toISOString().slice(0, 16).replace("T", " ") + " UTC"
    : "—";

  return (
    <footer className="mx-auto max-w-7xl border-t border-[color:var(--line)] px-4 py-4 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] text-dim">
        <span>Last trigger eval: {evalLabel}</span>
        <Link href="/methodology#glossary" className="text-muted hover:text-ink-soft">
          glossary →
        </Link>
      </div>
    </footer>
  );
}
