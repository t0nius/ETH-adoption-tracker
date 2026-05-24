import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  metrics_snapshots: defineTable({
    metric_name: v.string(),
    value: v.union(v.number(), v.null()),
    status: v.union(v.literal("ok"), v.literal("stale")),
    timestamp: v.number(),
    source: v.string(),
    formatted: v.string(),
    unit: v.optional(v.string()),
    error: v.optional(v.string()),
    metadata: v.optional(v.any()),
  }).index("by_metric_time", ["metric_name", "timestamp"]),

  triggers_state: defineTable({
    trigger_name: v.string(),
    tier: v.number(),
    status: v.string(), // ok | warning | triggered | insufficient_data | needs_manual | partial | error
    description: v.string(),
    message: v.string(),
    current_value: v.union(v.number(), v.null()),
    threshold_value: v.union(v.number(), v.null()),
    evaluated_at: v.number(),
    metadata: v.optional(v.any()),
  }).index("by_name", ["trigger_name"]),

  triggers_history: defineTable({
    trigger_name: v.string(),
    tier: v.number(),
    status: v.string(),
    message: v.string(),
    current_value: v.union(v.number(), v.null()),
    threshold_value: v.union(v.number(), v.null()),
    evaluated_at: v.number(),
  }).index("by_trigger_time", ["trigger_name", "evaluated_at"]),

  triggers_manual: defineTable({
    trigger_name: v.string(),
    is_triggered: v.boolean(),
    note: v.optional(v.string()),
    toggled_at: v.number(),
  }).index("by_name", ["trigger_name"]),

  triggers_manual_audit: defineTable({
    trigger_name: v.string(),
    is_triggered: v.boolean(),
    note: v.optional(v.string()),
    actor: v.optional(v.string()),
    toggled_at: v.number(),
  }).index("by_time", ["toggled_at"]),
});
