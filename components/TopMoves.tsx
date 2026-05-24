"use client";

import Link from "next/link";
import type { MetricBundle } from "@/components/MetricCard";
import { METRIC_BY_NAME } from "@/lib/metrics";
import { Sparkline } from "./Sparkline";

type Row = {
  kind: "best" | "worst" | "surprise";
  bundle: MetricBundle;
  metricLabel: string;
  delta30: number;
  volatility30: number | null;
};

function pickRows(bundles: MetricBundle[]): Row[] {
  const enriched = bundles
    .filter((b) => b.snapshot.status === "ok")
    .map((b) => {
      const def = METRIC_BY_NAME[b.metric_name as keyof typeof METRIC_BY_NAME];
      const delta = b.analytics.delta30 ?? null;
      const preferred = def?.preferredTrend ?? "up";
      let score = 0;
      if (delta !== null) {
        score = preferred === "up" ? delta : preferred === "down" ? -delta : Math.abs(delta);
      }
      return { b, def, delta, preferred, score };
    });

  const sorted = [...enriched]
    .filter((e) => e.delta !== null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const best = sorted[0];
  const worst = [...sorted].reverse()[0];
  const mostVolatile = [...enriched]
    .filter((e) => e.b.analytics.volatility30 !== null)
    .sort((a, b) => (b.b.analytics.volatility30 ?? 0) - (a.b.analytics.volatility30 ?? 0))[0];

  const rows: Row[] = [];
  if (best && best.delta !== null && best.score > 1)
    rows.push({
      kind: "best",
      bundle: best.b,
      metricLabel: best.def?.label ?? best.b.metric_name,
      delta30: best.delta,
      volatility30: best.b.analytics.volatility30,
    });
  if (
    worst &&
    worst.delta !== null &&
    worst.score < -1 &&
    worst.b.metric_name !== best?.b.metric_name
  )
    rows.push({
      kind: "worst",
      bundle: worst.b,
      metricLabel: worst.def?.label ?? worst.b.metric_name,
      delta30: worst.delta,
      volatility30: worst.b.analytics.volatility30,
    });
  if (
    mostVolatile &&
    (mostVolatile.b.analytics.volatility30 ?? 0) > 5 &&
    mostVolatile.b.metric_name !== best?.b.metric_name &&
    mostVolatile.b.metric_name !== worst?.b.metric_name
  )
    rows.push({
      kind: "surprise",
      bundle: mostVolatile.b,
      metricLabel:
        METRIC_BY_NAME[mostVolatile.b.metric_name as keyof typeof METRIC_BY_NAME]
          ?.label ?? mostVolatile.b.metric_name,
      delta30: mostVolatile.delta ?? 0,
      volatility30: mostVolatile.b.analytics.volatility30,
    });
  return rows;
}

const KIND_LABEL: Record<Row["kind"], string> = {
  best: "LEADER",
  worst: "LAGGARD",
  surprise: "VOLATILE",
};

export function TopMoves({ bundles }: { bundles: MetricBundle[] }) {
  const rows = pickRows(bundles);
  if (rows.length === 0) return null;

  return (
    <section className="surface mt-4">
      <header className="flex items-center justify-between border-b border-[color:var(--line)] px-4 py-2">
        <p className="text-eyebrow">TOP MOVES · 30D</p>
      </header>
      <table className="w-full font-mono text-xs">
        <thead>
          <tr className="border-b border-[color:var(--line-dim)] text-dim">
            <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-[0.14em]">SIGNAL</th>
            <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-[0.14em]">METRIC</th>
            <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-[0.14em]">30D Δ</th>
            <th className="hidden px-4 py-2 text-left text-[10px] font-medium uppercase tracking-[0.14em] sm:table-cell">
              SHAPE · 30D
            </th>
            <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-[0.14em]">VOL30</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const deltaTone =
              r.kind === "best"
                ? "var(--ink-soft)"
                : r.kind === "worst"
                  ? "var(--muted)"
                  : "var(--dim)";
            return (
              <tr
                key={r.kind + r.bundle.metric_name}
                className="border-b border-[color:var(--line-dim)] hover:bg-[color:var(--bg-2)]"
              >
                <td className="px-4 py-2.5 text-muted">{KIND_LABEL[r.kind]}</td>
                <td className="px-4 py-2.5">
                  <Link
                    href={`/metrics/${r.bundle.metric_name}`}
                    className="text-ink hover:underline"
                  >
                    {r.metricLabel}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-right tabular" style={{ color: deltaTone }}>
                  {r.delta30 > 0 ? "+" : r.delta30 < 0 ? "−" : ""}
                  {Math.abs(r.delta30).toFixed(1)}%
                </td>
                <td className="hidden px-4 py-2.5 sm:table-cell">
                  <div className="w-36">
                    <Sparkline data={r.bundle.history} height={40} days={30} />
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right tabular text-muted">
                  {r.volatility30 === null ? "—" : `${r.volatility30.toFixed(1)}%`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
