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
import {
  getBurnRateDaily,
  getEthTotalSupply,
  getStakingRatio,
} from "../lib/sources/ultrasound";
import {
  getNetIssuanceDaily,
  getSupplyInflationAnnualized,
  annualizedFromWindow,
} from "../lib/sources/supply-metrics";
import { getValidatorQueueRatio } from "../lib/sources/beaconcha-queue";
import { getEtfFlows6mUsd } from "../lib/sources/etf-flows";
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

// Hourly snapshot: fetch all board metrics in parallel, write rows to Convex.
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
      netIssuance,
      supplyInflation,
      staking,
      validatorQueue,
      blob,
      ser,
      etfFlows,
      ethShare,
      ethSupply,
      fundamentals,
    ] = await Promise.all([
      getEthBtc(),
      getStablecoinSupplyEthereum(),
      getRwaShareEthereum(),
      getL2Tvl(),
      getBurnRateDaily(),
      getNetIssuanceDaily(),
      getSupplyInflationAnnualized(),
      getStakingRatio(),
      getValidatorQueueRatio(),
      getBlobCountLatest(),
      getSerTotalEth(),
      getEtfFlows6mUsd(),
      getEthDefiShare(),
      getEthTotalSupply(),
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
      netIssuance,
      supplyInflation,
      staking,
      validatorQueue,
      l2tvl,
      eth_btc,
      daa,
      rwa,
      blob,
      ser,
      etfFlows,
      ethShare,
      ethSupply,
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
    eth_total_supply: v.number(),
    net_issuance_daily: v.number(),
    supply_inflation_annualized: v.number(),
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
    eth_total_supply: number;
    net_issuance_daily: number;
    supply_inflation_annualized: number;
  }> => {
    const days = args.days ?? 30;
    const counters = {
      eth_btc: 0,
      stables_supply_eth: 0,
      l2_tvl: 0,
      tps_l1_l2: 0,
      daa_l1_l2: 0,
      eth_total_supply: 0,
      net_issuance_daily: 0,
      supply_inflation_annualized: 0,
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

    // Ultrasound — ETH total supply (for T1.2). d1 is hourly (~2 days only);
    // since_merge is daily from the merge (2022+) — required for 180d trigger window.
    try {
      const res = await fetch(
        "https://ultrasound.money/api/v2/fees/supply-over-time",
      );
      if (res.ok) {
        const data = (await res.json()) as {
          since_merge?: Array<{ supply?: number; timestamp?: string }>;
        };
        const cutoff = Date.now() - days * 86400 * 1000;
        const seenDay = new Set<string>();
        const dailyPoints: Array<{ ts: number; supply: number }> = [];
        for (const row of data.since_merge ?? []) {
          if (typeof row.supply !== "number" || !row.timestamp) continue;
          const tsMs = Date.parse(row.timestamp);
          if (Number.isNaN(tsMs) || tsMs < cutoff) continue;
          const day = new Date(tsMs).toISOString().slice(0, 10);
          if (seenDay.has(day)) continue;
          seenDay.add(day);
          dailyPoints.push({ ts: tsMs, supply: row.supply });
          await ctx.runMutation(internal.snapshots.insertIfMissing, {
            metric_name: "eth_total_supply",
            value: row.supply,
            status: "ok",
            timestamp: tsMs,
            source: "ultrasound.money supply-over-time since_merge (backfill)",
            formatted: fmtNum(row.supply, 0),
            unit: "ETH",
          });
          counters.eth_total_supply++;
        }

        dailyPoints.sort((a, b) => a.ts - b.ts);
        for (let i = 1; i < dailyPoints.length; i++) {
          const prev = dailyPoints[i - 1];
          const curr = dailyPoints[i];
          const daySpan = (curr.ts - prev.ts) / 86400000;
          if (daySpan <= 0) continue;
          const netDaily = (curr.supply - prev.supply) / daySpan;
          await ctx.runMutation(internal.snapshots.insertIfMissing, {
            metric_name: "net_issuance_daily",
            value: netDaily,
            status: "ok",
            timestamp: curr.ts,
            source: "ultrasound.money supply delta (backfill)",
            formatted: `${netDaily >= 0 ? "+" : ""}${fmtNum(netDaily, 1)}`,
            unit: "ETH/day",
          });
          counters.net_issuance_daily++;
        }

        const windowDays = 180;
        for (let i = windowDays; i < dailyPoints.length; i++) {
          const start = dailyPoints[i - windowDays];
          const end = dailyPoints[i];
          const annualized = annualizedFromWindow(start.supply, end.supply, windowDays);
          if (annualized === null) continue;
          await ctx.runMutation(internal.snapshots.insertIfMissing, {
            metric_name: "supply_inflation_annualized",
            value: annualized,
            status: "ok",
            timestamp: end.ts,
            source: "ultrasound.money supply annualized (backfill)",
            formatted: `${annualized >= 0 ? "+" : ""}${fmtPct(annualized, 2)}`,
            unit: "%/yr",
          });
          counters.supply_inflation_annualized++;
        }
      }
    } catch {
      /* swallow */
    }

    // Avoid unused import warning if fmtPct is not used in this function yet.
    void fmtPct;

    return counters;
  },
});
