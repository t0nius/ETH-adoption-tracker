"use client";

import Link from "next/link";
import type { PillarSummary } from "@/lib/pillars";
import { METRIC_BY_NAME, type MetricName } from "@/lib/metrics";

export function PillarSummaryGrid({ pillars }: { pillars: PillarSummary[] }) {
  return (
    <section className="mt-6">
      <header className="mb-3 flex items-end justify-between border-b border-[color:var(--line)] pb-2">
        <p className="text-eyebrow">FOUR PILLARS · 30-SECOND READ</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-dim">
          tap to drill down
        </p>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {pillars.map((p) => (
          <Link
            key={p.group}
            href={`#pillar-${p.group.toLowerCase()}`}
            className="surface block px-4 py-4 transition-colors hover:bg-[color:var(--bg-1)]"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-[11px] font-semibold tracking-[0.14em] text-dim">
                {p.glyph}
              </span>
              <span className="font-mono text-[10px] tabular text-muted">
                {p.liveCount}/{p.metricCount} live
              </span>
            </div>
            <h3 className="mt-2 font-mono text-sm font-semibold uppercase tracking-tight text-ink">
              {p.label}
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-dim">{p.blurb}</p>
            <div className="mt-4 flex flex-wrap gap-3 font-mono text-[10px] tabular uppercase tracking-[0.1em]">
              <span className="text-muted">
                Q <span className="text-ink">{p.avgQuality.toFixed(0)}</span>
              </span>
              {p.watchCount > 0 ? (
                <span className="text-ink-soft">{p.watchCount} watch</span>
              ) : (
                <span className="text-dim">0 watch</span>
              )}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-ink-soft">
              {p.headlineMetric ? (
                <>
                  <span className="text-ink">
                    {METRIC_BY_NAME[p.headlineMetric as MetricName]?.label ??
                      p.headlineMetric}
                  </span>
                  {" · "}
                  {p.headlineText}
                </>
              ) : (
                p.headlineText
              )}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
