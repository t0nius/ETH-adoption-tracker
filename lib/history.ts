/** Retention and chart history limits (shared with Convex via import). */

export const SNAPSHOT_RETENTION_DAYS = 180;
export const DASHBOARD_HISTORY_DAYS = 400;

export type HistoryPoint = {
  timestamp: number;
  value: number | null;
  status: "ok" | "stale";
};

/** One point per UTC day (latest snapshot that day) — caps payload for charts. */
export function downsampleDaily(points: HistoryPoint[]): HistoryPoint[] {
  const byDay = new Map<number, HistoryPoint>();
  for (const p of points) {
    const day = Math.floor(p.timestamp / 86_400_000);
    const prev = byDay.get(day);
    if (!prev || p.timestamp > prev.timestamp) {
      byDay.set(day, p);
    }
  }
  return [...byDay.values()].sort((a, b) => a.timestamp - b.timestamp);
}
