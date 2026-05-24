import type { Snapshot } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Keep only "ok" snapshots with numeric value, sorted ascending by timestamp. */
export function clean(history: Snapshot[]): Array<{ timestamp: number; value: number }> {
  return history
    .filter((s): s is { timestamp: number; value: number; status: "ok" } =>
      s.status === "ok" && typeof s.value === "number",
    )
    .map((s) => ({ timestamp: s.timestamp, value: s.value }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

/** Bucket snapshots into one entry per UTC day, value = last observation of the day. */
export function bucketDailyLast(
  points: Array<{ timestamp: number; value: number }>,
): Array<{ day: string; value: number; timestamp: number }> {
  const byDay = new Map<string, { value: number; timestamp: number }>();
  for (const p of points) {
    const day = new Date(p.timestamp).toISOString().slice(0, 10);
    const prev = byDay.get(day);
    if (!prev || p.timestamp > prev.timestamp) {
      byDay.set(day, { value: p.value, timestamp: p.timestamp });
    }
  }
  return [...byDay.entries()]
    .map(([day, v]) => ({ day, value: v.value, timestamp: v.timestamp }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));
}

/** Number of distinct days covered by the points. */
export function daysCovered(
  points: Array<{ timestamp: number; value: number }>,
): number {
  const days = new Set(
    points.map((p) => new Date(p.timestamp).toISOString().slice(0, 10)),
  );
  return days.size;
}

/** Find first point >= a target timestamp (or null). */
export function pointAtOrAfter(
  points: Array<{ timestamp: number; value: number }>,
  targetMs: number,
): { timestamp: number; value: number } | null {
  for (const p of points) {
    if (p.timestamp >= targetMs) return p;
  }
  return null;
}

export const ONE_DAY_MS = DAY_MS;
