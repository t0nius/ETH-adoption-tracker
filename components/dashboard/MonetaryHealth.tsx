"use client";

import Link from "next/link";
import type { MetricBundle } from "@/components/MetricCard";
import { METRIC_BY_NAME } from "@/lib/metrics";

const MONETARY_HEALTH_METRICS = [
  "burn_24h",
  "net_issuance_daily",
  "supply_inflation_annualized",
] as const;

function toneForMetric(
  name: (typeof MONETARY_HEALTH_METRICS)[number],
  value: number | null,
): string {
  if (value === null) return "var(--muted)";
  if (name === "burn_24h") return value > 0 ? "var(--up)" : "var(--muted)";
  if (name === "net_issuance_daily") return value <= 0 ? "var(--up)" : "var(--watch)";
  if (name === "supply_inflation_annualized") {
    if (value > 1) return "var(--signal)";
    if (value > 0) return "var(--watch)";
    return "var(--up)";
  }
  return "var(--ink)";
}

export function MonetaryHealth({ byName }: { byName: Map<string, MetricBundle> }) {
  const items = MONETARY_HEALTH_METRICS.map((name) => {
    const bundle = byName.get(name);
    const def = METRIC_BY_NAME[name];
    return { name, bundle, def };
  });

  const liveCount = items.filter((i) => i.bundle?.snapshot.status === "ok").length;
  if (liveCount === 0) return null;

  return (
    <section className="surface section-gap" id="monetary-health">
      <div className="flex flex-col gap-1 border-b border-[color:var(--line)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-eyebrow">MONETARY HEALTH</p>
          <p className="mt-1 text-xs text-muted">
            Burn + net issuance + annualized supply — feeds trigger T1.2
          </p>
        </div>
        <Link
          href="/methodology#monetary"
          className="font-mono text-[10px] uppercase tracking-[0.12em] text-dim underline"
        >
          methodology →
        </Link>
      </div>
      <div className="grid gap-px bg-[color:var(--line)] sm:grid-cols-3">
        {items.map(({ name, bundle, def }) => {
          const ok = bundle?.snapshot.status === "ok";
          const value = bundle?.snapshot.value ?? null;
          return (
            <Link
              key={name}
              href={`/metrics/${name}`}
              className="flex flex-col gap-2 bg-[color:var(--bg-1)] px-4 py-4 transition-colors hover:bg-[color:var(--bg-2)]"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-dim">
                {def?.label ?? name}
              </p>
              <p
                className="font-mono text-xl tabular font-medium"
                style={{ color: ok ? toneForMetric(name, value) : "var(--muted)" }}
              >
                {ok ? bundle!.snapshot.formatted : "—"}
              </p>
              <p className="text-[10px] text-dim">
                {ok && bundle!.analytics.delta30 !== null
                  ? `Δ30 ${bundle!.analytics.delta30 >= 0 ? "+" : ""}${bundle!.analytics.delta30.toFixed(1)}%`
                  : bundle?.snapshot.error?.slice(0, 48) ?? "awaiting snapshot"}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
