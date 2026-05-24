export type MetricStatus = "ok" | "stale";

export type MetricResult = {
  name: string;
  label: string;
  status: MetricStatus;
  value: number | null;
  formatted: string;
  unit?: string;
  delta?: number | null;
  deltaLabel?: string;
  source: string;
  fetchedAt: string;
  error?: string;
  meta?: Record<string, unknown>;
};

export const stale = (
  name: string,
  label: string,
  source: string,
  error: string,
): MetricResult => ({
  name,
  label,
  status: "stale",
  value: null,
  formatted: "—",
  source,
  fetchedAt: new Date().toISOString(),
  error,
});
