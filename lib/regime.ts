/**
 * Dashboard scores (0–100). Heuristics only — not trading signals.
 *
 * - **Fundamental**: weighted 30-day trends by pillar (live metrics only).
 * - **Data health**: API coverage and freshness (no trigger double-count).
 * - **Triggers card**: invalidation state (separate, not folded into data health).
 */

import { METRIC_BY_NAME, type MetricGroup, type MetricName } from "./metrics";

export const ADOPTION_METRIC_NAMES: MetricName[] = (
  Object.keys(METRIC_BY_NAME) as MetricName[]
).filter((n) => n !== "eth_btc");

/** Thesis-relevant pillar weights (Monetary + Institutional dominate). */
export const PILLAR_WEIGHTS: Record<MetricGroup, number> = {
  Monetary: 0.35,
  Institutional: 0.35,
  Usage: 0.2,
  Infrastructure: 0.1,
};

export const DATA_HEALTH_WEIGHTS = {
  perStale: 10,
  perAged: 3,
} as const;

export function fundamentalLabel(score: number): string {
  if (score >= 80) return "STRONG";
  if (score >= 65) return "STEADY";
  if (score >= 50) return "MIXED";
  if (score >= 35) return "SOFT";
  return "WEAK";
}

/** @alias fundamentalLabel */
export const adoptionLabel = fundamentalLabel;

export function dataHealthLabel(score: number): string {
  if (score >= 85) return "SOLID";
  if (score >= 70) return "OK";
  if (score >= 50) return "PATCHY";
  return "GAPS";
}

/** @deprecated use dataHealthLabel */
export function regimeLabel(score: number): string {
  return dataHealthLabel(score);
}

export type MetricTrendInput = {
  metric_name: string;
  status: "ok" | "stale";
  delta30: number | null;
};

/** Map 30-day delta to 0–100 subscore from preferred trend direction. */
export function trendSubscore(
  preferredTrend: "up" | "down" | "stable",
  delta30: number | null,
): number {
  if (delta30 === null) return 55;
  if (Math.abs(delta30) < 2) return 72;
  if (preferredTrend === "up") {
    return Math.round(Math.max(15, Math.min(100, 55 + delta30 * 1.8)));
  }
  if (preferredTrend === "down") {
    return Math.round(Math.max(15, Math.min(100, 55 - delta30 * 1.8)));
  }
  return Math.round(Math.max(20, Math.min(85, 72 - Math.abs(delta30) * 0.8)));
}

export function computeFundamentalScore(
  metrics: MetricTrendInput[],
  opts?: { tier12Triggered?: number },
): number {
  const byPillar = new Map<MetricGroup, number[]>();

  for (const m of metrics) {
    if (m.status !== "ok" || m.metric_name === "eth_btc") continue;
    const def = METRIC_BY_NAME[m.metric_name as MetricName];
    if (!def) continue;
    const sub = trendSubscore(def.preferredTrend, m.delta30);
    const bucket = byPillar.get(def.group) ?? [];
    bucket.push(sub);
    byPillar.set(def.group, bucket);
  }

  let weightedSum = 0;
  let weightTotal = 0;
  for (const group of Object.keys(PILLAR_WEIGHTS) as MetricGroup[]) {
    const subs = byPillar.get(group);
    if (!subs?.length) continue;
    const pillarAvg = subs.reduce((a, b) => a + b, 0) / subs.length;
    const w = PILLAR_WEIGHTS[group];
    weightedSum += pillarAvg * w;
    weightTotal += w;
  }

  if (weightTotal === 0) return 0;

  const base = weightedSum / weightTotal;
  const triggerPenalty = (opts?.tier12Triggered ?? 0) * 15;

  return Math.max(0, Math.min(100, Math.round(base - triggerPenalty)));
}

export type DataHealthInput = {
  liveCount: number;
  totalMetrics: number;
  staleCount: number;
  agedCount: number;
};

export function computeDataHealthScore(input: DataHealthInput): number {
  const coverageRatio =
    input.totalMetrics > 0 ? input.liveCount / input.totalMetrics : 0;
  const w = DATA_HEALTH_WEIGHTS;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        coverageRatio * 100 -
          input.staleCount * w.perStale -
          input.agedCount * w.perAged,
      ),
    ),
  );
}

/** @deprecated use computeDataHealthScore — trigger penalties removed from this score */
export type OperationalInput = DataHealthInput & {
  triggeredCount: number;
  warningCount: number;
  noDataCount: number;
};

/** @deprecated use computeDataHealthScore */
export function computeOperationalScore(input: OperationalInput): number {
  return computeDataHealthScore(input);
}

/** @deprecated use computeFundamentalScore */
export type AdoptionMetricInput = MetricTrendInput & {
  qualityScore: number;
};

/** @deprecated use computeFundamentalScore */
export function computeAdoptionScore(
  metrics: AdoptionMetricInput[],
  opts?: { adoptionTriggerPenalty?: number },
): number {
  const tier12 =
    opts?.adoptionTriggerPenalty != null
      ? Math.round(opts.adoptionTriggerPenalty / 12)
      : 0;
  return computeFundamentalScore(metrics, { tier12Triggered: tier12 });
}

/** @alias computeDataHealthScore */
export function computeRegimeScore(input: DataHealthInput): number {
  return computeDataHealthScore(input);
}
