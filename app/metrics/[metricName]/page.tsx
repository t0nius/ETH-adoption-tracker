"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  METRIC_BY_NAME,
  MetricName,
  describeThreshold,
  describeTrend,
  formatCompact,
} from "@/lib/metrics";
import { GROUP_THEME } from "@/lib/groups";
import { type ChartPeriod, seriesStats } from "@/lib/chartFormat";
import { MetricTrendChart } from "@/components/MetricTrendChart";
import { MetricBundle } from "@/components/MetricCard";
import { QualityGauge } from "@/components/QualityGauge";
import { DeltaChip } from "@/components/DeltaChip";

type Period = 30 | 90 | 365;

const RELATED_TRIGGERS: Partial<Record<MetricName, string[]>> = {
  eth_defi_share: ["T1.1_eth_defi_share_drop"],
  stables_supply_eth: ["T2.6_stables_drop_12m"],
  tps_l1_l2: ["T2.5_tps_drop_12m"],
  blob_count_latest: ["T2.7_blobs_plateau_9m"],
  rwa_eth_share: ["T2.8_rwa_share_below_50"],
  staking_ratio: ["T1.4_staking_drop_or_exit_queue"],
  ser_total_eth: ["T1.3_etf_neg_and_ser_drop"],
};

function periodLabel(p: Period) {
  if (p === 30) return "30D";
  if (p === 90) return "90D";
  return "1Y";
}

function Cell({
  label,
  value,
  big = false,
  emphasize = false,
}: {
  label: string;
  value: string;
  big?: boolean;
  emphasize?: boolean;
}) {
  return (
    <div className="bg-[color:var(--bg-1)] px-4 py-3">
      <p className="text-eyebrow">{label}</p>
      <p
        className={`mt-1.5 font-mono tabular font-medium leading-none ${
          big ? "text-[24px]" : "text-lg"
        }`}
        style={{ color: emphasize ? "var(--signal)" : "var(--ink)" }}
      >
        {value}
      </p>
    </div>
  );
}

export default function MetricDetailPage() {
  const params = useParams<{ metricName: string }>();
  const metricName = (params.metricName ?? "") as MetricName;
  const def = METRIC_BY_NAME[metricName];
  const theme = def ? GROUP_THEME[def.group] : null;
  const [period, setPeriod] = useState<Period>(90);

  const bundles = useQuery(api.snapshots.dashboardBundle, {}) as
    | MetricBundle[]
    | undefined;
  const bundle = bundles?.find((b) => b.metric_name === metricName) ?? null;
  const snapshot = bundle?.snapshot ?? null;
  const history = bundle?.history ?? [];
  const filtered = useMemo(() => {
    const thresholdMs = Date.now() - period * 24 * 60 * 60 * 1000;
    return history
      .filter(
        (h): h is { timestamp: number; value: number; status: "ok" | "stale" } =>
          h.value !== null,
      )
      .filter((h) => h.timestamp >= thresholdMs)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((h) => ({ timestamp: h.timestamp, value: h.value }));
  }, [history, period]);

  const windowStats = useMemo(
    () => seriesStats(filtered.map((p) => p.value)),
    [filtered],
  );

  if (!def) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-8">
        <h1 className="font-display text-3xl text-ink">UNKNOWN METRIC</h1>
        <p className="mt-2 font-mono text-xs text-muted">this metric id is not registered.</p>
        <Link href="/" className="btn mt-4 inline-flex">← dashboard</Link>
      </main>
    );
  }

  if (bundles === undefined) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-8">
        <h1 className="font-display text-3xl text-ink">{def.detailTitle}</h1>
        <p className="mt-2 font-mono text-xs text-muted">loading metric context...</p>
      </main>
    );
  }

  const a = bundle?.analytics ?? null;
  const threshold = describeThreshold(def, snapshot?.value ?? null);
  const trend = describeTrend(def, a?.delta30 ?? null);
  const related = RELATED_TRIGGERS[metricName] ?? [];

  const chartThreshold = def.threshold
    ? {
        label: def.threshold.label,
        value: def.threshold.value,
        breached: threshold?.breached,
      }
    : undefined;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
      <nav className="mb-4 font-mono text-[11px] text-dim" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-ink-soft">
          Dashboard
        </Link>
        <span className="mx-1.5">›</span>
        <span className="text-muted">{def.group}</span>
        <span className="mx-1.5">›</span>
        <span className="text-ink-soft">{def.label}</span>
      </nav>

      {/* Why it matters + linked triggers */}
      <section className="surface mb-4">
        <header className="border-b border-[color:var(--line)] px-4 py-2">
          <p className="text-eyebrow">WHY IT MATTERS</p>
        </header>
        <div className="px-4 py-4">
          <p className="text-sm leading-relaxed text-ink-soft">{def.whyItMatters}</p>
          {related.length > 0 ? (
            <div className="mt-4 border-t border-[color:var(--line)] pt-3">
              <p className="text-eyebrow">LINKED TRIGGERS</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {related.map((tr) => (
                  <Link key={tr} href="/triggers" className="btn text-[11px]">
                    {tr.replace(/^T\d\.\d_/, "").replace(/_/g, " ")}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="surface">
        <div className="px-5 py-6 sm:px-8 sm:py-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-eyebrow">
                {theme?.glyph} · {def.group}
              </p>
              <h1 className="mt-3 font-display text-[36px] leading-[1.05] text-ink sm:text-[44px]">
                {def.detailTitle.toUpperCase()}
              </h1>
              <p className="mt-1 max-w-2xl font-mono text-[11px] text-muted">
                {def.interpretationHint}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {a ? <QualityGauge score={a.qualityScore} segments={10} /> : null}
              <Link href="/" className="btn">← dashboard</Link>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-px border border-[color:var(--line)] bg-[color:var(--line)] md:grid-cols-4">
            <Cell label="CURRENT" value={snapshot?.formatted ?? "—"} big />
            <Cell
              label="30D Δ"
              value={
                a?.delta30 === null || a?.delta30 === undefined
                  ? "—"
                  : `${a.delta30 > 0 ? "+" : ""}${a.delta30.toFixed(1)}%`
              }
            />
            <Cell
              label="90D Δ"
              value={
                a?.delta90 === null || a?.delta90 === undefined
                  ? "—"
                  : `${a.delta90 > 0 ? "+" : ""}${a.delta90.toFixed(1)}%`
              }
            />
            <Cell
              label="1Y Δ"
              value={
                a?.delta365 === null || a?.delta365 === undefined
                  ? "—"
                  : `${a.delta365 > 0 ? "+" : ""}${a.delta365.toFixed(1)}%`
              }
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--line)] pt-4">
            <p className="text-eyebrow">TREND · {periodLabel(period)}</p>
            <div className="flex flex-wrap gap-1.5">
              {([30, 90, 365] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setPeriod(d)}
                  className={`btn ${period === d ? "btn-active" : ""}`}
                >
                  {periodLabel(d)}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 border border-[color:var(--line)] bg-[color:var(--bg-1)] p-2">
            <MetricTrendChart
              points={filtered}
              threshold={chartThreshold}
              height={320}
              period={period as ChartPeriod}
              unit={snapshot?.unit}
              avgLine={a?.avg30 ?? null}
              ariaLabel={`${def.detailTitle} over ${periodLabel(period)}`}
            />
          </div>

          {windowStats ? (
            <div className="mt-3 flex flex-wrap gap-4 font-mono text-[10px] uppercase tracking-[0.1em] text-dim">
              <span>window low {formatCompact(windowStats.min)}</span>
              <span>window high {formatCompact(windowStats.max)}</span>
              <span>last {formatCompact(windowStats.last)}</span>
            </div>
          ) : null}

          <p className="mt-4 font-mono text-xs text-muted">{trend.text}</p>
          {threshold ? (
            <p
              className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.08em]"
              style={{
                color: threshold.breached ? "var(--signal)" : "var(--dim)",
              }}
            >
              {threshold.text}
            </p>
          ) : null}
        </div>
      </section>

      {a ? (
        <section className="surface mt-4">
          <header className="border-b border-[color:var(--line)] px-4 py-2">
            <p className="text-eyebrow">DIAGNOSTICS</p>
          </header>
          <div className="grid grid-cols-2 gap-px border-b border-[color:var(--line)] bg-[color:var(--line)] md:grid-cols-4">
            <Cell label="QUALITY" value={`${a.qualityScore}/100`} />
            <Cell label="STALE 7D" value={`${a.staleRate7d}%`} />
            <Cell label="FRESHNESS" value={`${a.freshnessHours.toFixed(1)}h`} />
            <Cell label="COMPLETENESS 30D" value={`${a.completeness30}%`} />
            <Cell label="30D AVG" value={a.avg30 === null ? "—" : formatCompact(a.avg30)} />
            <Cell label="90D AVG" value={a.avg90 === null ? "—" : formatCompact(a.avg90)} />
            <Cell
              label="VOL 30D"
              value={a.volatility30 === null ? "—" : `${a.volatility30.toFixed(1)}%`}
            />
            <Cell
              label="LAST FETCH"
              value={
                snapshot
                  ? new Date(snapshot.timestamp)
                      .toISOString()
                      .replace("T", " ")
                      .slice(0, 16) + "Z"
                  : "—"
              }
            />
          </div>
        </section>
      ) : null}

      {a ? (
        <section className="surface mt-4">
          <header className="border-b border-[color:var(--line)] px-4 py-2">
            <p className="text-eyebrow">DELTAS BY WINDOW</p>
          </header>
          <div className="flex flex-wrap gap-x-4 gap-y-2 px-4 py-4">
            <DeltaChip label="7D" value={a.delta7} preferred={def.preferredTrend} />
            <DeltaChip label="30D" value={a.delta30} preferred={def.preferredTrend} />
            <DeltaChip label="90D" value={a.delta90} preferred={def.preferredTrend} />
            <DeltaChip label="1Y" value={a.delta365} preferred={def.preferredTrend} />
          </div>
        </section>
      ) : null}


      {snapshot ? (
        <section className="surface mt-4 px-4 py-3 font-mono text-[11px]">
          <span className="text-eyebrow mr-2">SOURCE</span>
          <span className="text-muted">{snapshot.source}</span>
        </section>
      ) : null}
    </main>
  );
}
