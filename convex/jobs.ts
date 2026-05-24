import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { MetricResult } from "../lib/types";
import { getEthBtc } from "../lib/sources/coingecko";
import { getStablecoinSupplyEthereum } from "../lib/sources/defillama-stables";
import { getRwaShareEthereum } from "../lib/sources/defillama-rwa";
import {
  fetchGrowthePieFundamentals,
  computeTpsAggregated,
  computeDaaAggregated,
  computeDailySeries,
} from "../lib/sources/growthepie";
import { getL2Tvl } from "../lib/sources/l2beat";
import { getBurnRateDaily, getStakingRatio } from "../lib/sources/ultrasound";
import { getBlobCountLatest } from "../lib/sources/rpc-blob";
import { getSerTotalEth } from "../lib/sources/ser";
import { getEthDefiShare } from "../lib/sources/defillama-eth-share";
import { fmtUSD, fmtNum, fmtPct } from "../lib/format";

type SnapshotPayload = {
  metric_name: string;
  value: number | null;
  status: "ok" | "stale";
  timestamp: number;
  source: string;
  formatted: string;
  unit?: string;
  error?: string;
  metadata?: unknown;
};

function metricToPayload(m: MetricResult, ts: number): SnapshotPayload {
  return {
    metric_name: m.name,
    value: m.value,
    status: m.status,
    timestamp: ts,
    source: m.source,
    formatted: m.formatted,
    unit: m.unit,
    error: m.error,
    metadata: m.meta,
  };
}

// Hourly snapshot: fetch all 9 sources in parallel, write 9 rows to Convex.
export const snapshotAll = internalAction({
  args: {},
  returns: v.object({ inserted: v.number(), stale: v.number() }),
  handler: async (ctx): Promise<{ inserted: number; stale: number }> => {
    const ts = Date.now();
    const fundamentalsPromise = fetchGrowthePieFundamentals().catch(() => null);

    const [
      eth_btc,
      stables,
      rwa,
      l2tvl,
      burn,
      staking,
      blob,
      ser,
      ethShare,
      fundamentals,
    ] = await Promise.all([
      getEthBtc(),
      getStablecoinSupplyEthereum(),
      getRwaShareEthereum(),
      getL2Tvl(),
      getBurnRateDaily(),
      getStakingRatio(),
      getBlobCountLatest(),
      getSerTotalEth(),
      getEthDefiShare(),
      fundamentalsPromise,
    ]);

    let tps: MetricResult;
    let daa: MetricResult;
    if (fundamentals) {
      tps = computeTpsAggregated(fundamentals);
      daa = computeDaaAggregated(fundamentals);
    } else {
      const err = "growthepie fetch failed";
      tps = {
        name: "tps_l1_l2",
        label: "TPS (L1 + L2 aggregated)",
        status: "stale",
        value: null,
        formatted: "—",
        source: "growthepie /v1/fundamentals.json",
        fetchedAt: new Date(ts).toISOString(),
        error: err,
      };
      daa = {
        name: "daa_l1_l2",
        label: "Daily active addresses (L1+L2)",
        status: "stale",
        value: null,
        formatted: "—",
        source: "growthepie /v1/fundamentals.json",
        fetchedAt: new Date(ts).toISOString(),
        error: err,
      };
    }

    const metrics: MetricResult[] = [
      tps,
      stables,
      burn,
      staking,
      l2tvl,
      eth_btc,
      daa,
      rwa,
      blob,
      ser,
      ethShare,
    ];

    let inserted = 0;
    let staleCount = 0;
    for (const m of metrics) {
      await ctx.runMutation(internal.snapshots.insert, metricToPayload(m, ts));
      inserted++;
      if (m.status === "stale") staleCount++;
    }
    return { inserted, stale: staleCount };
  },
});

// Backfill 30 days of historical data from APIs that expose history.
// Skips ultrasound burn, staking ratio, RWA share, blob count (no granular history).
export const backfillHistorical = internalAction({
  args: { days: v.optional(v.number()) },
  returns: v.object({
    eth_btc: v.number(),
    stables_supply_eth: v.number(),
    l2_tvl: v.number(),
    tps_l1_l2: v.number(),
    daa_l1_l2: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    eth_btc: number;
    stables_supply_eth: number;
    l2_tvl: number;
    tps_l1_l2: number;
    daa_l1_l2: number;
  }> => {
    const days = args.days ?? 30;
    const counters = {
      eth_btc: 0,
      stables_supply_eth: 0,
      l2_tvl: 0,
      tps_l1_l2: 0,
      daa_l1_l2: 0,
    };

    // CoinGecko ETH/BTC — /coins/ethereum/market_chart, daily granularity for >90d
    try {
      const url = `https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=btc&days=${days}&interval=daily`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as { prices?: Array<[number, number]> };
        for (const [ts, price] of data.prices ?? []) {
          await ctx.runMutation(internal.snapshots.insertIfMissing, {
            metric_name: "eth_btc",
            value: price,
            status: "ok",
            timestamp: ts,
            source: "CoinGecko /coins/ethereum/market_chart (backfill)",
            formatted: price.toFixed(5),
            unit: "BTC",
          });
          counters.eth_btc++;
        }
      }
    } catch {
      /* swallow — backfill is best-effort */
    }

    // DeFiLlama stablecoins on Ethereum — daily history
    try {
      const url = "https://stablecoins.llama.fi/stablecoincharts/Ethereum";
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as Array<{
          date?: number | string;
          totalCirculatingUSD?: { peggedUSD?: number };
        }>;
        const cutoff = Date.now() - days * 86400 * 1000;
        for (const row of data) {
          const tsSec = typeof row.date === "string" ? parseInt(row.date, 10) : row.date;
          if (!tsSec) continue;
          const tsMs = tsSec * 1000;
          if (tsMs < cutoff) continue;
          const v = row.totalCirculatingUSD?.peggedUSD;
          if (typeof v !== "number") continue;
          await ctx.runMutation(internal.snapshots.insertIfMissing, {
            metric_name: "stables_supply_eth",
            value: v,
            status: "ok",
            timestamp: tsMs,
            source: "DeFiLlama /stablecoincharts/Ethereum (backfill)",
            formatted: fmtUSD(v, 2),
            unit: "USD",
          });
          counters.stables_supply_eth++;
        }
      }
    } catch {
      /* swallow */
    }

    // L2Beat — chart.data is hourly, take last `days*24` entries
    try {
      const res = await fetch("https://l2beat.com/api/scaling/summary");
      if (res.ok) {
        const data = (await res.json()) as {
          chart?: { types?: string[]; data?: number[][] };
        };
        const rows = data.chart?.data ?? [];
        const cutoff = Math.floor((Date.now() - days * 86400 * 1000) / 1000);
        for (const row of rows) {
          const [tsSec, native, canonical, external] = row;
          if (tsSec < cutoff) continue;
          const total = (native ?? 0) + (canonical ?? 0) + (external ?? 0);
          if (total <= 0) continue;
          await ctx.runMutation(internal.snapshots.insertIfMissing, {
            metric_name: "l2_tvl",
            value: total,
            status: "ok",
            timestamp: tsSec * 1000,
            source: "L2Beat /api/scaling/summary (backfill)",
            formatted: fmtUSD(total, 2),
            unit: "USD",
          });
          counters.l2_tvl++;
        }
      }
    } catch {
      /* swallow */
    }

    // growthepie — daily history for TPS and DAA aggregated across L1+L2
    try {
      const records = await fetchGrowthePieFundamentals();
      const tpsSeries = computeDailySeries(records, "txcount", days);
      const daaSeries = computeDailySeries(records, "daa", days);
      for (const point of tpsSeries) {
        const tsMs = Date.parse(point.date + "T00:00:00Z");
        const tps = point.value / 86400;
        await ctx.runMutation(internal.snapshots.insertIfMissing, {
          metric_name: "tps_l1_l2",
          value: tps,
          status: "ok",
          timestamp: tsMs,
          source: "growthepie /v1/fundamentals.json (backfill)",
          formatted: fmtNum(tps, 1),
          unit: "tx/s",
        });
        counters.tps_l1_l2++;
      }
      for (const point of daaSeries) {
        const tsMs = Date.parse(point.date + "T00:00:00Z");
        await ctx.runMutation(internal.snapshots.insertIfMissing, {
          metric_name: "daa_l1_l2",
          value: point.value,
          status: "ok",
          timestamp: tsMs,
          source: "growthepie /v1/fundamentals.json (backfill)",
          formatted: fmtNum(point.value, 2),
          unit: "addresses",
        });
        counters.daa_l1_l2++;
      }
    } catch {
      /* swallow */
    }

    // Avoid unused import warning if fmtPct is not used in this function yet.
    void fmtPct;

    return counters;
  },
});
