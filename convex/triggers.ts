import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import {
  T3_DEFINITIONS,
  evalManual,
  evalT11,
  evalT12,
  evalT13,
  evalT14,
  evalT25,
  evalT26,
  evalT27,
  evalT28,
} from "../lib/triggers";
import { findNewlyTriggered } from "../lib/triggers/transitions";
import type { ManualState, Snapshot, TriggerEval } from "../lib/triggers/types";
import {
  formatTriggerAlert,
  sendTelegramAlert,
} from "../lib/integrations/telegram";
import { requireSecretInProduction } from "../lib/production";

const triggerStateShape = v.object({
  _id: v.id("triggers_state"),
  _creationTime: v.number(),
  trigger_name: v.string(),
  tier: v.number(),
  status: v.string(),
  description: v.string(),
  message: v.string(),
  current_value: v.union(v.number(), v.null()),
  threshold_value: v.union(v.number(), v.null()),
  evaluated_at: v.number(),
  metadata: v.optional(v.any()),
});

// -------- Internal: read snapshots for one metric ---------------------------

export const _readHistory = internalQuery({
  args: { metric_name: v.string() },
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
      .withIndex("by_metric_time", (q) => q.eq("metric_name", args.metric_name))
      .collect();
    return rows.map((r) => ({
      timestamp: r.timestamp,
      value: r.value,
      status: r.status,
    }));
  },
});

export const _readManualState = internalQuery({
  args: { trigger_name: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      is_triggered: v.boolean(),
      note: v.optional(v.string()),
      toggled_at: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("triggers_manual")
      .withIndex("by_name", (q) => q.eq("trigger_name", args.trigger_name))
      .first();
    if (!row) return null;
    return {
      is_triggered: row.is_triggered,
      note: row.note,
      toggled_at: row.toggled_at,
    };
  },
});

// -------- Internal: upsert one trigger_state row ----------------------------

export const _upsertState = internalMutation({
  args: {
    trigger_name: v.string(),
    tier: v.number(),
    status: v.string(),
    description: v.string(),
    message: v.string(),
    current_value: v.union(v.number(), v.null()),
    threshold_value: v.union(v.number(), v.null()),
    evaluated_at: v.number(),
    metadata: v.optional(v.any()),
  },
  returns: v.id("triggers_state"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("triggers_state")
      .withIndex("by_name", (q) => q.eq("trigger_name", args.trigger_name))
      .first();
    if (existing) {
      await ctx.db.patch("triggers_state", existing._id, args);
      return existing._id;
    }
    return await ctx.db.insert("triggers_state", args);
  },
});

export const _readOldStatuses = internalQuery({
  args: {},
  returns: v.array(
    v.object({ trigger_name: v.string(), status: v.string() }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db.query("triggers_state").collect();
    return rows.map((r) => ({ trigger_name: r.trigger_name, status: r.status }));
  },
});

export const _appendHistory = internalMutation({
  args: {
    trigger_name: v.string(),
    tier: v.number(),
    status: v.string(),
    message: v.string(),
    current_value: v.union(v.number(), v.null()),
    threshold_value: v.union(v.number(), v.null()),
    evaluated_at: v.number(),
  },
  returns: v.id("triggers_history"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("triggers_history", args);
  },
});

// Internal flat read used by the weekly recap email builder.
export const _readAllForRecap = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      trigger_name: v.string(),
      tier: v.number(),
      status: v.string(),
      description: v.string(),
      message: v.string(),
      current_value: v.union(v.number(), v.null()),
      threshold_value: v.union(v.number(), v.null()),
      evaluated_at: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db.query("triggers_state").collect();
    return rows
      .map((r) => ({
        trigger_name: r.trigger_name,
        tier: r.tier,
        status: r.status,
        description: r.description,
        message: r.message,
        current_value: r.current_value,
        threshold_value: r.threshold_value,
        evaluated_at: r.evaluated_at,
      }))
      .sort((a, b) => {
        if (a.tier !== b.tier) return a.tier - b.tier;
        return a.trigger_name < b.trigger_name ? -1 : 1;
      });
  },
});

// -------- Main daily action: evaluate all 11 triggers, upsert state ---------

export const evaluateAll = internalAction({
  args: {},
  returns: v.object({ evaluated: v.number() }),
  handler: async (ctx): Promise<{ evaluated: number }> => {
    const fetchHistory = (name: string): Promise<Snapshot[]> =>
      ctx.runQuery(internal.triggers._readHistory, { metric_name: name });
    const fetchManual = (name: string): Promise<ManualState> =>
      ctx.runQuery(internal.triggers._readManualState, { trigger_name: name });

    const [
      ethShare,
      // supply history isn't currently a stored metric directly — we'd snapshot
      // total ETH supply separately. For Phase 4 we proxy with staking_ratio's
      // total_supply metadata if available; otherwise mark insufficient.
      stakingHist,
      tpsHist,
      stablesHist,
      blobHist,
      rwaHist,
      serHist,
      etfManual,
      exitQueueManual,
      ...t3Manuals
    ] = await Promise.all([
      fetchHistory("eth_defi_share"),
      fetchHistory("staking_ratio"),
      fetchHistory("tps_l1_l2"),
      fetchHistory("stables_supply_eth"),
      fetchHistory("blob_count_latest"),
      fetchHistory("rwa_eth_share"),
      fetchHistory("ser_total_eth"),
      fetchManual("T1.3_etf_neg_and_ser_drop"),
      fetchManual("T1.4_staking_drop_or_exit_queue"),
      ...T3_DEFINITIONS.map((t) => fetchManual(t.name)),
    ]);

    // T1.2 supply growth — we don't snapshot total ETH supply directly yet.
    // Use staking_ratio's metadata.totalSupply if present (stored in
    // ultrasound.ts source). For Phase 4, mark insufficient_data with a clear
    // message; once a dedicated supply snapshot is added it will start working.
    const supplyHistFromStaking: Snapshot[] = []; // intentionally empty

    const now = Date.now();
    const evaluations: TriggerEval[] = [
      evalT11(ethShare),
      evalT12(supplyHistFromStaking),
      evalT13(serHist, etfManual),
      evalT14(stakingHist, exitQueueManual),
      evalT25(tpsHist),
      evalT26(stablesHist),
      evalT27(blobHist),
      evalT28(rwaHist),
      ...T3_DEFINITIONS.map((def, i) =>
        evalManual(def.name, 3, def.description, t3Manuals[i]),
      ),
    ];

    // Transition detection: read old statuses before writing new ones.
    const oldRows: Array<{ trigger_name: string; status: string }> =
      await ctx.runQuery(internal.triggers._readOldStatuses, {});
    const oldStatusByName = new Map(
      oldRows.map((r) => [r.trigger_name, r.status]),
    );
    const newlyTriggered = findNewlyTriggered(oldStatusByName, evaluations);

    for (const ev of evaluations) {
      await ctx.runMutation(internal.triggers._upsertState, {
        trigger_name: ev.trigger_name,
        tier: ev.tier,
        status: ev.status,
        description: ev.description,
        message: ev.message,
        current_value: ev.current_value,
        threshold_value: ev.threshold_value,
        evaluated_at: now,
        metadata: ev.metadata,
      });
      await ctx.runMutation(internal.triggers._appendHistory, {
        trigger_name: ev.trigger_name,
        tier: ev.tier,
        status: ev.status,
        message: ev.message,
        current_value: ev.current_value,
        threshold_value: ev.threshold_value,
        evaluated_at: now,
      });
    }

    // Send Telegram alerts for each new transition. No-ops if not configured.
    for (const ev of newlyTriggered) {
      await sendTelegramAlert(formatTriggerAlert(ev));
    }

    return { evaluated: evaluations.length };
  },
});

// -------- Public queries / mutations ----------------------------------------

export const listTriggers = query({
  args: {},
  returns: v.array(triggerStateShape),
  handler: async (ctx) => {
    const rows = await ctx.db.query("triggers_state").collect();
    return rows.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      return a.trigger_name < b.trigger_name ? -1 : 1;
    });
  },
});

export const latestChanges = query({
  args: {},
  returns: v.array(
    v.object({
      trigger_name: v.string(),
      tier: v.number(),
      previous_status: v.string(),
      current_status: v.string(),
      previous_message: v.string(),
      current_message: v.string(),
      previous_evaluated_at: v.number(),
      current_evaluated_at: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db.query("triggers_history").collect();
    const evalTimes = Array.from(new Set(rows.map((r) => r.evaluated_at))).sort(
      (a, b) => b - a,
    );
    if (evalTimes.length < 2) return [];
    const currentAt = evalTimes[0];
    const prevAt = evalTimes[1];

    const currentRows = rows.filter((r) => r.evaluated_at === currentAt);
    const prevByName = new Map(
      rows
        .filter((r) => r.evaluated_at === prevAt)
        .map((r) => [r.trigger_name, r]),
    );

    return currentRows
      .map((curr) => {
        const prev = prevByName.get(curr.trigger_name);
        if (!prev || prev.status === curr.status) return null;
        return {
          trigger_name: curr.trigger_name,
          tier: curr.tier,
          previous_status: prev.status,
          current_status: curr.status,
          previous_message: prev.message,
          current_message: curr.message,
          previous_evaluated_at: prev.evaluated_at,
          current_evaluated_at: curr.evaluated_at,
        };
      })
      .filter(
        (
          v,
        ): v is {
          trigger_name: string;
          tier: number;
          previous_status: string;
          current_status: string;
          previous_message: string;
          current_message: string;
          previous_evaluated_at: number;
          current_evaluated_at: number;
        } => v !== null,
      )
      .sort((a, b) => {
        if (a.tier !== b.tier) return a.tier - b.tier;
        return a.trigger_name < b.trigger_name ? -1 : 1;
      });
  },
});

export const setManualTrigger = mutation({
  args: {
    trigger_name: v.string(),
    is_triggered: v.boolean(),
    note: v.optional(v.string()),
    admin_token: v.optional(v.string()),
    actor: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const requiredToken = process.env.MANUAL_TRIGGER_ADMIN_TOKEN;
    requireSecretInProduction(
      "MANUAL_TRIGGER_ADMIN_TOKEN",
      requiredToken,
    );
    if (requiredToken && args.admin_token !== requiredToken) {
      throw new Error("Unauthorized manual trigger action");
    }

    const existing = await ctx.db
      .query("triggers_manual")
      .withIndex("by_name", (q) => q.eq("trigger_name", args.trigger_name))
      .first();
    const wasTriggered = existing?.is_triggered === true;
    const payload = {
      trigger_name: args.trigger_name,
      is_triggered: args.is_triggered,
      note: args.note,
      toggled_at: Date.now(),
    };
    if (existing) {
      await ctx.db.patch("triggers_manual", existing._id, payload);
    } else {
      await ctx.db.insert("triggers_manual", payload);
    }
    await ctx.db.insert("triggers_manual_audit", {
      trigger_name: args.trigger_name,
      is_triggered: args.is_triggered,
      note: args.note,
      actor: args.actor,
      toggled_at: Date.now(),
    });
    // Schedule a re-evaluation so the triggers_state table reflects the toggle
    // (and a Telegram alert fires through the standard transition path).
    if (!wasTriggered && args.is_triggered) {
      await ctx.scheduler.runAfter(0, internal.triggers.evaluateAll, {});
    }
    return null;
  },
});

export const recentManualActions = query({
  args: {},
  returns: v.array(
    v.object({
      trigger_name: v.string(),
      is_triggered: v.boolean(),
      note: v.optional(v.string()),
      actor: v.optional(v.string()),
      toggled_at: v.number(),
    }),
  ),
  handler: async (ctx) => {
    return await ctx.db
      .query("triggers_manual_audit")
      .withIndex("by_time")
      .order("desc")
      .take(20);
  },
});
