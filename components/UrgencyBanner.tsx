"use client";

import Link from "next/link";

export function UrgencyBanner({
  triggered,
  warning,
}: {
  triggered: Array<{ trigger_name: string; tier: number; message: string; description?: string }>;
  warning: number;
}) {
  if (triggered.length === 0 && warning === 0) return null;

  if (triggered.length > 0) {
    const first = triggered[0];
    return (
      <section
        role="alert"
        className="surface verdict-accent-act px-5 py-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-signal">
              INVALIDATION TRIPPED · TIER {first.tier}
            </p>
            <p className="mt-1.5 font-mono text-base tabular text-ink">
              {triggered.length === 1
                ? first.description ?? first.trigger_name
                : `${triggered.length} triggers tripped`}
            </p>
            <p className="mt-2 max-w-3xl text-sm text-ink-soft">{first.message}</p>
          </div>
          <Link href="/triggers" className="btn shrink-0 self-start">
            open triggers →
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="surface verdict-accent-watch px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs">
          <span className="text-eyebrow mr-2">WATCH</span>
          <span className="tabular font-semibold text-watch">{warning}</span>{" "}
          <span className="text-muted uppercase">
            trigger{warning > 1 ? "s" : ""} in warning state
          </span>
        </p>
        <Link href="/triggers" className="btn">
          inspect →
        </Link>
      </div>
    </section>
  );
}
