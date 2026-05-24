/**
 * Source: growthepie.xyz — TPS et Active Addresses L1+L2
 *
 * Doc URL: https://docs.growthepie.xyz/
 * Endpoint: https://api.growthepie.xyz/v1/fundamentals.json
 * Validated: 2026-05-22 (Phase 0)
 * Rate limit: non documenté, CDN — poll horaire OK
 *
 * Format observé (array de records):
 * [{ "metric_key":"txcount", "origin_key":"ethereum", "date":"2026-05-21", "value":2320690.0 },
 *  { "metric_key":"daa", "origin_key":"arbitrum", "date":"2026-05-21", "value":137646.0 }, ...]
 *
 * Le payload contient l'historique quotidien complet. On expose:
 *   - fetchGrowthePieFundamentals() — un seul fetch, à réutiliser entre TPS et DAA
 *   - computeTpsAggregated(records)   — extracteur pur du TPS (latest)
 *   - computeDaaAggregated(records)   — extracteur pur du DAA (latest)
 *   - computeTpsDaily(records, n)     — séries quotidiennes pour backfill sparkline
 *   - computeDaaDaily(records, n)     — idem pour DAA
 *
 * + getTpsAggregated() / getActiveAddressesAggregated() pour compat tests Phase 1.
 */

import { MetricResult, stale } from "../types";
import { fmtNum } from "../format";

const SOURCE = "growthepie /v1/fundamentals.json";

const CHAINS = [
  "ethereum",
  "arbitrum",
  "base",
  "optimism",
  "polygon_pos",
  "starknet",
  "scroll",
  "linea",
  "zksync_era",
  "mantle",
  "taiko",
  "blast",
  "metis",
  "mode",
  "fraxtal",
  "manta",
  "gravity",
  "soneium",
  "worldchain",
  "ink",
  "lisk",
  "loopring",
  "plume",
  "ronin",
  "unichain",
  "zircuit",
  "celo",
  "arbitrum_nova",
];

export type GrowthePieRecord = {
  metric_key?: string;
  origin_key?: string;
  date?: string;
  value?: number;
};

export async function fetchGrowthePieFundamentals(): Promise<GrowthePieRecord[]> {
  const res = await fetch("https://api.growthepie.xyz/v1/fundamentals.json");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as GrowthePieRecord[];
}

function sumLatestByDate(
  records: GrowthePieRecord[],
  metricKey: string,
): { totalValue: number; latestDate: string; chainCount: number } {
  const byChain = new Map<string, { date: string; value: number }>();
  for (const r of records) {
    if (r.metric_key !== metricKey) continue;
    if (!r.origin_key || !r.date || typeof r.value !== "number") continue;
    if (!CHAINS.includes(r.origin_key)) continue;
    const prev = byChain.get(r.origin_key);
    if (!prev || r.date > prev.date) {
      byChain.set(r.origin_key, { date: r.date, value: r.value });
    }
  }
  let total = 0;
  let latestDate = "";
  for (const v of byChain.values()) {
    total += v.value;
    if (v.date > latestDate) latestDate = v.date;
  }
  return { totalValue: total, latestDate, chainCount: byChain.size };
}

export function computeTpsAggregated(records: GrowthePieRecord[]): MetricResult {
  const NAME = "tps_l1_l2";
  const LABEL = "TPS (L1 + L2 aggregated)";
  try {
    const { totalValue, latestDate, chainCount } = sumLatestByDate(records, "txcount");
    if (chainCount === 0) throw new Error("no txcount records found");
    const tps = totalValue / 86400;
    return {
      name: NAME,
      label: LABEL,
      status: "ok",
      value: tps,
      formatted: fmtNum(tps, 1),
      unit: "tx/s",
      source: SOURCE,
      fetchedAt: new Date().toISOString(),
      meta: { chainsCounted: chainCount, totalTx: totalValue, latestDate },
    };
  } catch (e) {
    return stale(NAME, LABEL, SOURCE, e instanceof Error ? e.message : String(e));
  }
}

export function computeDaaAggregated(records: GrowthePieRecord[]): MetricResult {
  const NAME = "daa_l1_l2";
  const LABEL = "Daily active addresses (L1+L2)";
  try {
    const { totalValue, latestDate, chainCount } = sumLatestByDate(records, "daa");
    if (chainCount === 0) throw new Error("no daa records found");
    return {
      name: NAME,
      label: LABEL,
      status: "ok",
      value: totalValue,
      formatted: fmtNum(totalValue, 2),
      unit: "addresses",
      source: SOURCE,
      fetchedAt: new Date().toISOString(),
      meta: { chainsCounted: chainCount, latestDate },
    };
  } catch (e) {
    return stale(NAME, LABEL, SOURCE, e instanceof Error ? e.message : String(e));
  }
}

// Compat helpers — useful for Phase 1 tests + standalone usage.
export async function getTpsAggregated(): Promise<MetricResult> {
  try {
    const records = await fetchGrowthePieFundamentals();
    return computeTpsAggregated(records);
  } catch (e) {
    return stale(
      "tps_l1_l2",
      "TPS (L1 + L2 aggregated)",
      SOURCE,
      e instanceof Error ? e.message : String(e),
    );
  }
}

export async function getActiveAddressesAggregated(): Promise<MetricResult> {
  try {
    const records = await fetchGrowthePieFundamentals();
    return computeDaaAggregated(records);
  } catch (e) {
    return stale(
      "daa_l1_l2",
      "Daily active addresses (L1+L2)",
      SOURCE,
      e instanceof Error ? e.message : String(e),
    );
  }
}

/**
 * Backfill — séries quotidiennes pour les N derniers jours, par metric_key et par chain.
 * Renvoie un Map<dateISO, totalValue> agrégé sur toutes les chains.
 */
export function computeDailySeries(
  records: GrowthePieRecord[],
  metricKey: string,
  days: number,
): Array<{ date: string; value: number }> {
  const cutoffDate = new Date(Date.now() - days * 86400 * 1000)
    .toISOString()
    .slice(0, 10);

  const byDate = new Map<string, number>();
  for (const r of records) {
    if (r.metric_key !== metricKey) continue;
    if (!r.origin_key || !r.date || typeof r.value !== "number") continue;
    if (!CHAINS.includes(r.origin_key)) continue;
    if (r.date < cutoffDate) continue;
    byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.value);
  }
  return [...byDate.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}
