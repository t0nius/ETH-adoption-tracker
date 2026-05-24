import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Tier A metrics polled every hour at minute 0.
crons.hourly(
  "snapshot-all-metrics-hourly",
  { minuteUTC: 0 },
  internal.jobs.snapshotAll,
  {},
);

// Triggers evaluated daily at 01:30 UTC (after a few hourly snapshots have
// landed) — writes one row per trigger to triggers_state. Telegram alerts
// fire when a trigger newly enters the "triggered" state.
crons.daily(
  "evaluate-triggers-daily",
  { hourUTC: 1, minuteUTC: 30 },
  internal.triggers.evaluateAll,
  {},
);

// Weekly Resend email recap — Mondays 09:00 UTC.
crons.weekly(
  "weekly-recap-email",
  { dayOfWeek: "monday", hourUTC: 9, minuteUTC: 0 },
  internal.notifications.sendWeeklyRecap,
  {},
);

// Drop hourly snapshots older than 180 days (batched per metric per run).
crons.weekly(
  "purge-old-snapshots",
  { dayOfWeek: "sunday", hourUTC: 3, minuteUTC: 0 },
  internal.snapshots.runPurgeOldSnapshots,
  {},
);

export default crons;
