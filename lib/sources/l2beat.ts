/**
 * Source: L2Beat — TVL agrégé sur tous les L2 d'Ethereum
 *
 * Doc URL: https://l2beat.com/api (non officielle, mais stable et publique)
 * Endpoint: https://l2beat.com/api/scaling/summary
 * Validated: 2026-05-22 (Phase 0)
 * Rate limit: non documenté, raisonnable
 *
 * Réponse observée:
 * { "chart": {
 *     "types": ["timestamp","native","canonical","external","ethPrice"],
 *     "data": [[1776816000, 10382904599.6, 14087316499.1, 16414135255.4, 2327.51], ...]
 *   } }
 *
 * Le dernier point est le TVL le plus récent. Total = native + canonical + external (USD).
 */

import { MetricResult, stale } from "../types";
import { fmtUSD } from "../format";

const NAME = "l2_tvl";
const LABEL = "L2 TVL (aggregated)";
const SOURCE = "L2Beat /api/scaling/summary";

type L2BeatResponse = {
  chart?: {
    types?: string[];
    data?: number[][];
  };
};

export async function getL2Tvl(): Promise<MetricResult> {
  try {
    const res = await fetch("https://l2beat.com/api/scaling/summary");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as L2BeatResponse;
    const rows = data.chart?.data;
    if (!rows || rows.length === 0) throw new Error("empty chart data");
    const last = rows[rows.length - 1];
    // [timestamp, native, canonical, external, ethPrice]
    const native = last[1] ?? 0;
    const canonical = last[2] ?? 0;
    const external = last[3] ?? 0;
    const total = native + canonical + external;
    if (total <= 0) throw new Error("L2 TVL total <= 0");

    return {
      name: NAME,
      label: LABEL,
      status: "ok",
      value: total,
      formatted: fmtUSD(total, 2),
      unit: "USD",
      source: SOURCE,
      fetchedAt: new Date().toISOString(),
      meta: { native, canonical, external, asOf: last[0] },
    };
  } catch (e) {
    return stale(NAME, LABEL, SOURCE, e instanceof Error ? e.message : String(e));
  }
}
