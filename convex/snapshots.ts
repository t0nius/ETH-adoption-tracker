import { v } from "convex/values";
import { query, internalMutation, internalQuery } from "./_generated/server";

const snapshotShape = v.object({
  _id: v.id("metrics_snapshots"),
  _creationTime: v.number(),
  metric_name: v.string(),
  value: v.union(v.number(), v.null()),
  status: v.union(v.literal("ok"), v.literal("stale")),
  timestamp: v.number(),
  source: v.string(),
  formatted: v.string(),
  unit: v.optional(v.string()),
  error: v.optional(v.string()),
  metadata: v.optional(v.any()),
});

const historyPointShape = v.object({
  timestamp: v.number(),
  value: v.union(v.number(), v.null()),
  status: v.union(v.literal("ok"), v.literal("stale")),
});

const latestSnapshotShape = v.object({
  metric_name: v.string(),
  status: v.union(v.literal("ok"), v.literal("stale")),
  value: v.union(v.number(), v.null()),
  formatted: v.string(),
  unit: v.optional(v.string()),
  source: v.string(),
  timestamp: v.number(),
  error: v.optional(v.string()),
});

const analyticsShape = v.object({
  delta7: v.union(v.number(), v.null()),
  delta30: v.union(v.number(), v.null()),
  delta90: v.union(v.number(), v.null()),
  delta365: v.union(v.number(), v.null()),
  avg30: v.union(v.number(), v.null()),
  avg90: v.union(v.number(), v.null()),
  volatility30: v.union(v.number(), v.null()),
  completeness30: v.number(),
  completeness90: v.number(),
  freshnessHours: v.number(),
  staleRate7d: v.number(),
  qualityScore: v.number(),
});

// Known metric names — used by latestPerMetric to fetch the latest row per metric.
export const METRIC_NAMES = [
  "tps_l1_l2",
  "stables_supply_eth",
  "burn_24h",
  "staking_ratio",
  "l2_tvl",
  "eth_btc",
  "daa_l1_l2",
  "rwa_eth_share",
  "blob_count_latest",
  "ser_total_eth",
  "eth_defi_share",
] as const;

type HistoryPoint = {
  timestamp: number;
  value: number | null;
  status: "ok" | "stale";
};

function nonNullPoints(points: HistoryPoint[]) {
  return points
    .filter(
      (p): p is { timestamp: number; value: number; status: "ok" | "stale" } =>
        p.value !== null,
    )
    .sort((a, b) => a.timestamp - b.timestamp);
}

function nearestAtOrBefore(
  points: Array<{ timestamp: number; value: number }>,
  target: number,
) {
  let best: { timestamp: number; value: number } | null = null;
  for (const p of points) {
    if (p.timestamp <= target && (!best || p.timestamp > best.timestamp)) {
      best = p;
    }
  }
  return best;
}

function deltaPct(points: HistoryPoint[], days: number) {
  const clean = nonNullPoints(points);
  if (clean.length < 2) return null;
  const latest = clean[clean.length - 1];
  const base = nearestAtOrBefore(
    clean,
    Date.now() - days * 24 * 60 * 60 * 1000,
  );
  if (!base || base.value === 0) return null;
  return ((latest.value - base.value) / Math.abs(base.value)) * 100;
}

function avg(points: HistoryPoint[], days: number) {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const values = points
    .filter(
      (p): p is { timestamp: number; value: number; status: "ok" | "stale" } =>
        p.value !== null,
    )
    .filter((p) => p.timestamp >= since)
    .map((p) => p.value);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function volatility(points: HistoryPoint[], days: number) {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const clean = nonNullPoints(points).filter((p) => p.timestamp >= since);
  if (clean.length < 3) return null;
  const returns: number[] = [];
  for (let i = 1; i < clean.length; i++) {
    const prev = clean[i - 1].value;
    if (prev === 0) continue;
    returns.push((clean[i].value - prev) / Math.abs(prev));
  }
  if (returns.length < 2) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((acc, r) => acc + (r - mean) ** 2, 0) /
    (returns.length - 1);
  return Math.sqrt(variance) * 100;
}

function completeness(points: HistoryPoint[], days: number) {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const set = new Set<number>();
  for (const p of points) {
    if (p.timestamp < since) continue;
    set.add(Math.floor(p.timestamp / 86_400_000));
  }
  return Math.min(100, Math.round((set.size / days) * 100));
}

function staleRate(points: HistoryPoint[], days: number) {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const window = points.filter((p) => p.timestamp >= since);
  if (window.length === 0) return 0;
  const stale = window.filter((p) => p.status === "stale").length;
  return Math.round((stale / window.length) * 100);
}

function qualityScore(input: {
  freshnessHours: number;
  completeness30: number;
  staleRate7d: number;
}) {
  const freshnessPenalty = Math.min(35, Math.floor(input.freshnessHours / 6) * 4);
  const completenessPenalty = Math.max(0, 30 - Math.floor(input.completeness30 * 0.3));
  const stalePenalty = Math.min(35, Math.floor(input.staleRate7d * 0.5));
  return Math.max(0, Math.min(100, 100 - freshnessPenalty - completenessPenalty - stalePenalty));
}

export const insert = internalMutation({
  args: {
    metric_name: v.string(),
    value: v.union(v.number(), v.null()),
    status: v.union(v.literal("ok"), v.literal("stale")),
    timestamp: v.number(),
    source: v.string(),
    formatted: v.string(),
    unit: v.optional(v.string()),
    error: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  returns: v.id("metrics_snapshots"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("metrics_snapshots", args);
  },
});

export const insertIfMissing = internalMutation({
  args: {
    metric_name: v.string(),
    value: v.union(v.number(), v.null()),
    status: v.union(v.literal("ok"), v.literal("stale")),
    timestamp: v.number(),
    source: v.string(),
    formatted: v.string(),
    unit: v.optional(v.string()),
    error: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  returns: v.union(v.id("metrics_snapshots"), v.null()),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("metrics_snapshots")
      .withIndex("by_metric_time", (q) =>
        q.eq("metric_name", args.metric_name).eq("timestamp", args.timestamp),
      )
      .first();
    if (existing) return null;
    return await ctx.db.insert("metrics_snapshots", args);
  },
});

export const listMetricNames = internalQuery({
  args: {},
  returns: v.array(v.string()),
  handler: async () => {
    return [...METRIC_NAMES];
  },
});

// Internal flat read used by the weekly recap email builder.
export const _readLatestForRecap = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      metric_name: v.string(),
      status: v.union(v.literal("ok"), v.literal("stale")),
      value: v.union(v.number(), v.null()),
      formatted: v.string(),
      unit: v.optional(v.string()),
      source: v.string(),
      timestamp: v.number(),
      error: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const results = await Promise.all(
      METRIC_NAMES.map(async (name) => {
        const rows = await ctx.db
          .query("metrics_snapshots")
          .withIndex("by_metric_time", (q) => q.eq("metric_name", name))
          .order("desc")
          .take(1);
        const r = rows[0];
        if (!r) return null;
        return {
          metric_name: r.metric_name,
          status: r.status,
          value: r.value,
          formatted: r.formatted,
          unit: r.unit,
          source: r.source,
          timestamp: r.timestamp,
          error: r.error,
        };
      }),
    );
    return results.filter((r): r is NonNullable<typeof r> => r !== null);
  },
});

export const latestPerMetric = query({
  args: {},
  returns: v.array(snapshotShape),
  handler: async (ctx) => {
    const results = await Promise.all(
      METRIC_NAMES.map(async (name) => {
        const rows = await ctx.db
          .query("metrics_snapshots")
          .withIndex("by_metric_time", (q) => q.eq("metric_name", name))
          .order("desc")
          .take(1);
        return rows[0] ?? null;
      }),
    );
    return results.filter((r): r is NonNullable<typeof r> => r !== null);
  },
});

export const historyForMetric = query({
  args: {
    metric_name: v.string(),
    sinceMs: v.number(),
  },
  returns: v.array(
    v.object({
      timestamp: v.number(),
      value: v.union(v.number(), v.null()),
      status: v.union(v.literal("ok"), v.literal("stale")),
    }),
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("metrics_snapshots")
      .withIndex("by_metric_time", (q) =>
        q.eq("metric_name", args.metric_name).gte("timestamp", args.sinceMs),
      )
      .collect();
    return rows.map((r) => ({
      timestamp: r.timestamp,
      value: r.value,
      status: r.status,
    }));
  },
});

export const dashboardBundle = query({
  args: {
    sinceMs: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      metric_name: v.string(),
      snapshot: latestSnapshotShape,
      history: v.array(historyPointShape),
      analytics: analyticsShape,
    }),
  ),
  handler: async (ctx, args) => {
    const sinceMs = args.sinceMs ?? Date.now() - 365 * 24 * 60 * 60 * 1000;
    const rowsByMetric = await Promise.all(
      METRIC_NAMES.map(async (name) => {
        const [latestRows, historyRows] = await Promise.all([
          ctx.db
            .query("metrics_snapshots")
            .withIndex("by_metric_time", (q) => q.eq("metric_name", name))
            .order("desc")
            .take(1),
          ctx.db
            .query("metrics_snapshots")
            .withIndex("by_metric_time", (q) =>
              q.eq("metric_name", name).gte("timestamp", sinceMs),
            )
            .collect(),
        ]);

        const latest = latestRows[0];
        const history: HistoryPoint[] = historyRows.map((r) => ({
          timestamp: r.timestamp,
          value: r.value,
          status: r.status,
        }));
        const freshnessHours = latest
          ? (Date.now() - latest.timestamp) / (60 * 60 * 1000)
          : 999;
        const completeness30 = completeness(history, 30);
        const staleRate7d = staleRate(history, 7);
        const snapshot = latest
          ? {
              metric_name: latest.metric_name,
              status: latest.status,
              value: latest.value,
              formatted: latest.formatted,
              unit: latest.unit,
              source: latest.source,
              timestamp: latest.timestamp,
              error: latest.error,
            }
          : {
              metric_name: name,
              status: "stale" as const,
              value: null,
              formatted: "—",
              source: "no snapshots yet",
              timestamp: 0,
              error: "No snapshot available",
            };

        return {
          metric_name: name,
          snapshot,
          history,
          analytics: {
            delta7: deltaPct(history, 7),
            delta30: deltaPct(history, 30),
            delta90: deltaPct(history, 90),
            delta365: deltaPct(history, 365),
            avg30: avg(history, 30),
            avg90: avg(history, 90),
            volatility30: volatility(history, 30),
            completeness30,
            completeness90: completeness(history, 90),
            freshnessHours,
            staleRate7d,
            qualityScore: qualityScore({
              freshnessHours,
              completeness30,
              staleRate7d,
            }),
          },
        };
      }),
    );
    return rowsByMetric;
  },
});

export const sourceHealth = query({
  args: {},
  returns: v.array(
    v.object({
      metric_name: v.string(),
      staleRate7d: v.number(),
      latestStatus: v.union(v.literal("ok"), v.literal("stale")),
      freshnessHours: v.number(),
      qualityScore: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const sinceMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const rows = await Promise.all(
      METRIC_NAMES.map(async (name) => {
        const [latestRows, windowRows] = await Promise.all([
          ctx.db
            .query("metrics_snapshots")
            .withIndex("by_metric_time", (q) => q.eq("metric_name", name))
            .order("desc")
            .take(1),
          ctx.db
            .query("metrics_snapshots")
            .withIndex("by_metric_time", (q) =>
              q.eq("metric_name", name).gte("timestamp", sinceMs),
            )
            .collect(),
        ]);
        const latest = latestRows[0];
        const history: HistoryPoint[] = windowRows.map((r) => ({
          timestamp: r.timestamp,
          value: r.value,
          status: r.status,
        }));
        const freshnessHours = latest
          ? (Date.now() - latest.timestamp) / (60 * 60 * 1000)
          : 999;
        const staleRate7d = staleRate(history, 7);
        const quality = qualityScore({
          freshnessHours,
          completeness30: Math.min(100, windowRows.length * 15),
          staleRate7d,
        });
        return {
          metric_name: name,
          staleRate7d,
          latestStatus: latest?.status ?? "stale",
          freshnessHours,
          qualityScore: quality,
        };
      }),
    );
    return rows;
  },
});
