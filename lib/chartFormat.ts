/** Shared axis, tooltip, and series helpers for Recharts. */

export type ChartPeriod = 7 | 30 | 90 | 365;

export function formatAxisValue(value: number, unit?: string) {
  const abs = Math.abs(value);
  let core: string;
  if (abs >= 1e9) core = `${(value / 1e9).toFixed(1)}B`;
  else if (abs >= 1e6) core = `${(value / 1e6).toFixed(1)}M`;
  else if (abs >= 1e3) core = `${(value / 1e3).toFixed(1)}k`;
  else if (abs >= 100) core = value.toFixed(0);
  else if (abs >= 10) core = value.toFixed(1);
  else core = value.toFixed(2);
  if (!unit) return core;
  if (unit === "%") return `${core}%`;
  return `${core} ${unit}`;
}

export function formatTooltipDate(ts: number, period?: ChartPeriod) {
  const d = new Date(ts);
  if (period === 365) {
    return d.toLocaleDateString("en-GB", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  if (period === 90) {
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  }
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function formatDeltaPct(value: number) {
  const abs = Math.abs(value);
  const n = abs >= 100 ? abs.toFixed(0) : abs.toFixed(1);
  if (value > 0) return `+${n}%`;
  if (value < 0) return `−${n}%`;
  return `${n}%`;
}

export function filterHistoryByDays<T extends { timestamp: number }>(
  points: T[],
  days: number,
): T[] {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  return points.filter((p) => p.timestamp >= since);
}

/** Keep chart performant — uniform step through sorted series. */
export function downsamplePoints<T extends { timestamp: number }>(
  points: T[],
  maxPoints = 90,
): T[] {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  const out: T[] = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]);
  const last = points[points.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

export function chartDomain(values: number[], padRatio = 0.12): [number, number] {
  if (values.length === 0) return [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || Math.max(Math.abs(max) * 0.04, 1);
  const pad = range * padRatio;
  return [min - pad, max + pad];
}

export function seriesStats(values: number[]) {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const last = values[values.length - 1];
  return { min, max, last };
}
