"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  METRIC_BY_NAME,
  MetricName,
  describeThreshold,
  describeTrend,
} from "@/lib/metrics";
import { type ChartPeriod } from "@/lib/chartFormat";
import { MetricTrendChart } from "./MetricTrendChart";
import { QualityGauge } from "./QualityGauge";
import { DeltaChip } from "./DeltaChip";
import { Sparkline } from "./Sparkline";
import { InfoHint } from "./InfoHint";
import { GROUP_THEME } from "@/lib/groups";
import type { GridMode } from "./dashboard/MetricGridControls";

type Snapshot = {
  metric_name: string;
  status: "ok" | "stale";
  value: number | null;
  formatted: string;
  unit?: string;
  source: string;
  timestamp: number;
  error?: string;
};

type HistoryPoint = {
  timestamp: number;
  value: number | null;
  status: "ok" | "stale";
};

type Analytics = {
  delta7: number | null;
  delta30: number | null;
  delta90: number | null;
  delta365: number | null;
  avg30: number | null;
  avg90: number | null;
  volatility30: number | null;
  completeness30: number;
  completeness90: number;
  freshnessHours: number;
  staleRate7d: number;
  qualityScore: number;
};

export type MetricBundle = {
  metric_name: string;
  snapshot: Snapshot;
  history: HistoryPoint[];
  analytics: Analytics;
};

type Period = ChartPeriod;

const STALE_BY_AGE_MS = 24 * 60 * 60 * 1000;
const HAS_THRESHOLD: Partial<Record<MetricName, boolean>> = {
  eth_defi_share: true,
  rwa_eth_share: true,
  supply_inflation_annualized: true,
  validator_queue_ratio: true,
};

function timeSinceMs(ts: number): string {
  if (ts === 0) return "—";
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function periodLabel(p: Period) {
  if (p === 7) return "7D";
  if (p === 30) return "30D";
  if (p === 90) return "90D";
  return "1Y";
}

function deltaForPeriod(analytics: Analytics, period: Period): number | null {
  if (period === 7) return analytics.delta7;
  if (period === 30) return analytics.delta30;
  if (period === 90) return analytics.delta90;
  return analytics.delta365;
}

export function MetricCard({
  bundle,
  selectedPeriod,
  gridMode = "compact",
}: {
  bundle: MetricBundle;
  selectedPeriod: Period;
  gridMode?: GridMode;
}) {
  const [showAllDeltas, setShowAllDeltas] = useState(false);
  const snap = bundle.snapshot;
  const metricName = snap.metric_name as MetricName;
  const def = METRIC_BY_NAME[metricName];
  const groupTheme = GROUP_THEME[def.group];
  const isStale = snap.status === "stale";
  const isAged =
    !isStale && snap.timestamp > 0 && Date.now() - snap.timestamp > STALE_BY_AGE_MS;
  const statusLabel = isStale ? "STALE" : isAged ? "AGED" : "LIVE";
  const statusColor = isStale
    ? "var(--signal)"
    : isAged
      ? "var(--watch)"
      : "var(--muted)";

  const filtered = useMemo(() => {
    const thresholdMs = Date.now() - selectedPeriod * 24 * 60 * 60 * 1000;
    return bundle.history
      .filter(
        (h): h is { timestamp: number; value: number; status: "ok" | "stale" } =>
          h.value !== null,
      )
      .filter((h) => h.timestamp >= thresholdMs)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((h) => ({ timestamp: h.timestamp, value: h.value }));
  }, [bundle.history, selectedPeriod]);

  const thresholdDesc = describeThreshold(def, snap.value);
  const trendDesc = describeTrend(def, bundle.analytics.delta30);
  const periodDelta = deltaForPeriod(bundle.analytics, selectedPeriod);

  const chartThreshold = def.threshold
    ? {
        label: def.threshold.label,
        value: def.threshold.value,
        breached: thresholdDesc?.breached,
      }
    : undefined;

  const showThreshold = HAS_THRESHOLD[metricName] && thresholdDesc;

  return (
    <article className="surface-raised panel-in flex flex-col">
      <header className="flex items-center justify-between border-b border-[color:var(--line)] px-3.5 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-[10px] text-dim shrink-0">{groupTheme.glyph}</span>
          <span className="truncate text-xs font-medium text-ink" title={def.label}>
            {def.label}
          </span>
        </div>
        <span className="status-tag shrink-0" style={{ color: statusColor }}>
          {statusLabel}
        </span>
      </header>

      <div className="flex flex-1 flex-col px-3.5 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-2">
            <p className="font-mono tabular text-[22px] font-medium leading-none tracking-tight text-ink sm:text-[26px]">
              {snap.formatted}
            </p>
            {snap.unit && !isStale ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-dim">
                {snap.unit}
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <QualityGauge score={bundle.analytics.qualityScore} segments={8} />
            <InfoHint
              label="Data quality"
              hint="0–100 score from freshness, 7-day stale rate, and 30-day completeness."
            />
          </div>
        </div>

        {gridMode === "compact" ? (
          <div className="mt-3 border border-[color:var(--line-dim)] bg-[color:var(--bg-1)] p-1.5">
            <Sparkline
              data={bundle.history}
              height={40}
              days={selectedPeriod}
            />
          </div>
        ) : (
          <div className="mt-3 border border-[color:var(--line-dim)] bg-[color:var(--bg-1)] p-1.5">
            <p className="mb-1 text-eyebrow">window · {periodLabel(selectedPeriod)}</p>
            <MetricTrendChart
              points={filtered}
              threshold={chartThreshold}
              height={148}
              period={selectedPeriod}
              unit={snap.unit}
              avgLine={bundle.analytics.avg30}
              ariaLabel={`${def.label} trend over ${periodLabel(selectedPeriod)}`}
            />
          </div>
        )}

        <p className="mt-2 font-mono text-[11px] leading-snug text-muted line-clamp-2">
          {trendDesc.text}
        </p>

        {showThreshold ? (
          <p
            className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em]"
            style={{
              color: thresholdDesc!.breached ? "var(--signal)" : "var(--dim)",
            }}
          >
            {thresholdDesc!.text}
          </p>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <DeltaChip
            label={periodLabel(selectedPeriod)}
            value={periodDelta}
            preferred={def.preferredTrend}
          />
          {showAllDeltas ? (
            <>
              {selectedPeriod !== 7 && (
                <DeltaChip label="7D" value={bundle.analytics.delta7} preferred={def.preferredTrend} />
              )}
              {selectedPeriod !== 30 && (
                <DeltaChip label="30D" value={bundle.analytics.delta30} preferred={def.preferredTrend} />
              )}
              {selectedPeriod !== 90 && (
                <DeltaChip label="90D" value={bundle.analytics.delta90} preferred={def.preferredTrend} />
              )}
              {selectedPeriod !== 365 && (
                <DeltaChip label="1Y" value={bundle.analytics.delta365} preferred={def.preferredTrend} />
              )}
            </>
          ) : (
            <button
              type="button"
              className="font-mono text-[10px] text-dim underline-offset-2 hover:text-muted hover:underline"
              onClick={() => setShowAllDeltas(true)}
            >
              all windows
            </button>
          )}
        </div>
      </div>

      <footer className="mt-auto flex items-center justify-between gap-2 border-t border-[color:var(--line)] px-3.5 py-2 font-mono text-[10px]">
        <p className="truncate text-dim" title={snap.source}>
          {snap.source}
        </p>
        <div className="flex shrink-0 items-center gap-2 text-muted">
          <span className="tabular">{timeSinceMs(snap.timestamp)}</span>
          <Link
            href={`/metrics/${snap.metric_name}`}
            className="upper tracking-[0.12em] text-ink hover:underline"
          >
            detail →
          </Link>
        </div>
      </footer>

      {isStale && snap.error ? (
        <p
          className="border-t border-[color:var(--line)] px-3.5 py-1.5 truncate font-mono text-[10px] text-signal"
          title={snap.error}
        >
          ! {snap.error}
        </p>
      ) : null}
    </article>
  );
}

export function EmptyMetricCard({ metric_name }: { metric_name: string }) {
  const def = METRIC_BY_NAME[metric_name as MetricName];
  const groupTheme = def ? GROUP_THEME[def.group] : null;
  return (
    <article className="surface-raised opacity-60">
      <header className="flex items-center justify-between border-b border-[color:var(--line)] px-3.5 py-2">
        <div className="flex items-center gap-2">
          {groupTheme ? (
            <span className="font-mono text-[10px] text-dim">{groupTheme.glyph}</span>
          ) : null}
          <span className="text-xs text-ink-soft">{def?.label ?? metric_name}</span>
        </div>
        <span className="status-tag">AWAITING</span>
      </header>
      <div className="px-3.5 py-5">
        <div className="flex h-[40px] items-center justify-center border border-[color:var(--line-dim)] bg-[color:var(--bg-1)]">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-dim">
            no snapshot yet
          </p>
        </div>
      </div>
    </article>
  );
}
