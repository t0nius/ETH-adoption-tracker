import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  internalQuery,
  internalAction,
} from "./_generated/server";
import { internal } from "./_generated/api";
import {
  DASHBOARD_HISTORY_DAYS,
  SNAPSHOT_RETENTION_DAYS,
  downsampleDaily,
} from "../lib/history";
import { METRIC_ORDER } from "../lib/metrics";
import { fmtUSD } from "../lib/format";
import { requireSecretInProduction } from "../lib/production";
import {
  fundamentalLabel,
  dataHealthLabel,
  computeFundamentalScore,
  computeDataHealthScore,
} from "../lib/regime";

const DISPLAY_METRIC_NAMES = METRIC_ORDER;

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
  "net_issuance_daily",
  "supply_inflation_annualized",
  "staking_ratio",
  "validator_queue_ratio",
  "l2_tvl",
  "eth_btc",
  "daa_l1_l2",
  "rwa_eth_share",
  "blob_count_latest",
  "ser_total_eth",
  "etf_flows_6m_usd",
  "eth_defi_share",
  "eth_total_supply",
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

/** Latest ok snapshot for a metric (used to preserve manual ETF input). */
export const latestOkSnapshot = internalQuery({
  args: { metric_name: v.string() },
  returns: v.union(
    v.object({
      metric_name: v.string(),
      status: v.literal("ok"),
      value: v.union(v.number(), v.null()),
      timestamp: v.number(),
      source: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const recent = await ctx.db
      .query("metrics_snapshots")
      .withIndex("by_metric_time", (q) => q.eq("metric_name", args.metric_name))
      .order("desc")
      .take(48);
    const latest = recent.find((r) => r.status === "ok");
    if (!latest) return null;
    return {
      metric_name: latest.metric_name,
      status: "ok" as const,
      value: latest.value,
      timestamp: latest.timestamp,
      source: latest.source,
    };
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
    const history: HistoryPoint[] = rows.map((r) => ({
      timestamp: r.timestamp,
      value: r.value,
      status: r.status,
    }));
    return downsampleDaily(history);
  },
});

/** Delete snapshots older than SNAPSHOT_RETENTION_DAYS (batched per metric). */
export const purgeOldSnapshots = internalMutation({
  args: {},
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx) => {
    const cutoff = Date.now() - SNAPSHOT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    let deleted = 0;
    for (const name of METRIC_NAMES) {
      const stale = await ctx.db
        .query("metrics_snapshots")
        .withIndex("by_metric_time", (q) => q.eq("metric_name", name))
        .filter((q) => q.lt(q.field("timestamp"), cutoff))
        .take(200);
      for (const row of stale) {
        await ctx.db.delete(row._id);
        deleted += 1;
      }
    }
    return { deleted };
  },
});

export const runPurgeOldSnapshots = internalAction({
  args: {},
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx): Promise<{ deleted: number }> => {
    return await ctx.runMutation(internal.snapshots.purgeOldSnapshots, {});
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
    const sinceMs =
      args.sinceMs ??
      Date.now() - DASHBOARD_HISTORY_DAYS * 24 * 60 * 60 * 1000;
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
        const rawHistory: HistoryPoint[] = historyRows.map((r) => ({
          timestamp: r.timestamp,
          value: r.value,
          status: r.status,
        }));
        const history = downsampleDaily(rawHistory);
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

const triggerBriefShape = v.object({
  trigger_name: v.string(),
  tier: v.number(),
  status: v.string(),
  message: v.string(),
  description: v.string(),
  evaluated_at: v.number(),
});

const sourceHealthShape = v.object({
  metric_name: v.string(),
  staleRate7d: v.number(),
  latestStatus: v.union(v.literal("ok"), v.literal("stale")),
  freshnessHours: v.number(),
  qualityScore: v.number(),
});

const bundleShape = v.object({
  metric_name: v.string(),
  snapshot: latestSnapshotShape,
  history: v.array(historyPointShape),
  analytics: analyticsShape,
});

/** Single round-trip for the home dashboard. */
export const dashboardOverview = query({
  args: {},
  returns: v.object({
    bundles: v.array(bundleShape),
    sourceHealth: v.array(sourceHealthShape),
    triggers: v.array(triggerBriefShape),
    scores: v.object({
      fundamental: v.object({ score: v.number(), label: v.string() }),
      dataHealth: v.object({ score: v.number(), label: v.string() }),
    }),
    fragile: v.array(sourceHealthShape),
  }),
  handler: async (ctx) => {
    const sinceMs = Date.now() - DASHBOARD_HISTORY_DAYS * 24 * 60 * 60 * 1000;
    const total = DISPLAY_METRIC_NAMES.length;

    const allBundles = await Promise.all(
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
        const rawHistory: HistoryPoint[] = historyRows.map((r) => ({
          timestamp: r.timestamp,
          value: r.value,
          status: r.status,
        }));
        const history = downsampleDaily(rawHistory);
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

    const displaySet = new Set<string>(DISPLAY_METRIC_NAMES);
    const bundles = allBundles.filter((b) => displaySet.has(b.metric_name));

    const sourceHealth = bundles.map((b) => ({
      metric_name: b.metric_name,
      staleRate7d: b.analytics.staleRate7d,
      latestStatus: b.snapshot.status,
      freshnessHours: b.analytics.freshnessHours,
      qualityScore: b.analytics.qualityScore,
    }));

    const triggerRows = await ctx.db.query("triggers_state").collect();
    const triggers = triggerRows
      .map((t) => ({
        trigger_name: t.trigger_name,
        tier: t.tier,
        status: t.status,
        message: t.message,
        description: t.description,
        evaluated_at: t.evaluated_at,
      }))
      .sort((a, b) => a.trigger_name.localeCompare(b.trigger_name));

    const okCount = bundles.filter((b) => b.snapshot.status === "ok").length;
    const staleCount = bundles.filter((b) => b.snapshot.status === "stale").length;
    const agedCount = bundles.filter(
      (b) => b.snapshot.status === "ok" && b.analytics.freshnessHours > 24,
    ).length;
    const triggeredCount = triggers.filter((t) => t.status === "triggered").length;
    const warningCount = triggers.filter(
      (t) => t.status === "warning" || t.status === "partial",
    ).length;

    const tier12Triggered = triggers.filter(
      (t) =>
        (t.tier === 1 || t.tier === 2) && t.status === "triggered",
    ).length;

    const dataHealthScore = computeDataHealthScore({
      liveCount: okCount,
      totalMetrics: total,
      staleCount,
      agedCount,
    });

    const fundamentalScore = computeFundamentalScore(
      bundles.map((b) => ({
        metric_name: b.metric_name,
        status: b.snapshot.status,
        delta30: b.analytics.delta30,
      })),
      { tier12Triggered },
    );

    const fragile = [...sourceHealth]
      .filter((s) => s.qualityScore < 70)
      .sort((a, b) => a.qualityScore - b.qualityScore)
      .slice(0, 4);

    return {
      bundles,
      sourceHealth,
      triggers,
      scores: {
        fundamental: {
          score: fundamentalScore,
          label: fundamentalLabel(fundamentalScore),
        },
        dataHealth: {
          score: dataHealthScore,
          label: dataHealthLabel(dataHealthScore),
        },
      },
      fragile,
    };
  },
});

/** Weekly manual ETF 6M cumulative flow (USD) when CoinGlass/Blockworks API unavailable. */
export const submitManualEtfFlows = mutation({
  args: {
    value_usd: v.number(),
    note: v.optional(v.string()),
    admin_token: v.optional(v.string()),
    actor: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const requiredToken = process.env.MANUAL_TRIGGER_ADMIN_TOKEN;
    requireSecretInProduction("MANUAL_TRIGGER_ADMIN_TOKEN", requiredToken);
    if (requiredToken && args.admin_token !== requiredToken) {
      throw new Error("Unauthorized manual metric submission");
    }

    const ts = Date.now();
    const formatted = `${args.value_usd >= 0 ? "+" : ""}${fmtUSD(args.value_usd, 2)}`;
    await ctx.db.insert("metrics_snapshots", {
      metric_name: "etf_flows_6m_usd",
      value: args.value_usd,
      status: "ok",
      timestamp: ts,
      source: "manual weekly input",
      formatted,
      unit: "USD",
      metadata: { note: args.note, actor: args.actor },
    });
    await ctx.scheduler.runAfter(0, internal.triggers.evaluateAll, {});
    return null;
  },
});
