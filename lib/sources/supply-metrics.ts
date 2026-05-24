/**
 * Derived supply metrics from ultrasound.money supply-over-time.
 * - net_issuance_daily: ETH/day (supply delta vs ~24h ago)
 * - supply_inflation_annualized: %/year from 180d supply window
 */

import { MetricResult, stale } from "../types";
import { fmtNum, fmtPct } from "../format";

const SOURCE = "ultrasound.money /v2/fees/supply-over-time";

type SupplyRow = { supply?: number; timestamp?: string };

type SupplyOverTime = {
  d1?: SupplyRow[];
  since_merge?: SupplyRow[];
};

const DAY_MS = 86_400_000;

function parseSupplySeries(rows: SupplyRow[] | undefined) {
  return (rows ?? [])
    .filter(
      (r): r is { supply: number; timestamp: string } =>
        typeof r.supply === "number" && typeof r.timestamp === "string",
    )
    .map((r) => ({ supply: r.supply, ts: Date.parse(r.timestamp) }))
    .filter((r) => !Number.isNaN(r.ts))
    .sort((a, b) => a.ts - b.ts);
}

function dailyLast(rows: SupplyRow[] | undefined) {
  const byDay = new Map<string, { supply: number; ts: number }>();
  for (const r of parseSupplySeries(rows)) {
    const day = new Date(r.ts).toISOString().slice(0, 10);
    const prev = byDay.get(day);
    if (!prev || r.ts >= prev.ts) byDay.set(day, { supply: r.supply, ts: r.ts });
  }
  return [...byDay.values()].sort((a, b) => a.ts - b.ts);
}

function netIssuanceFromHourly(series: ReturnType<typeof parseSupplySeries>) {
  if (series.length < 2) return null;
  const latest = series[series.length - 1];
  const target = latest.ts - DAY_MS;
  let base = series[0];
  for (const p of series) {
    if (p.ts <= target && p.ts >= base.ts) base = p;
  }
  if (base.ts === latest.ts) return null;
  const days = (latest.ts - base.ts) / DAY_MS;
  if (days < 0.5) return null;
  return (latest.supply - base.supply) / days;
}

function annualizedFromWindow(startSupply: number, endSupply: number, days: number) {
  if (startSupply <= 0 || days <= 0) return null;
  const ratio = endSupply / startSupply;
  return (Math.pow(ratio, 365 / days) - 1) * 100;
}

export async function fetchSupplyOverTime(): Promise<SupplyOverTime> {
  const res = await fetch("https://ultrasound.money/api/v2/fees/supply-over-time");
  if (!res.ok) throw new Error(`supply HTTP ${res.status}`);
  return (await res.json()) as SupplyOverTime;
}

export async function getNetIssuanceDaily(): Promise<MetricResult> {
  const NAME = "net_issuance_daily";
  const LABEL = "Net ETH issuance (daily)";
  try {
    const data = await fetchSupplyOverTime();
    const hourly = parseSupplySeries(data.d1);
    const net = netIssuanceFromHourly(hourly);
    if (net === null) throw new Error("insufficient hourly supply for 24h delta");
    return {
      name: NAME,
      label: LABEL,
      status: "ok",
      value: net,
      formatted: `${net >= 0 ? "+" : ""}${fmtNum(net, 1)}`,
      unit: "ETH/day",
      source: SOURCE,
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    return stale(NAME, LABEL, SOURCE, e instanceof Error ? e.message : String(e));
  }
}

export async function getSupplyInflationAnnualized(): Promise<MetricResult> {
  const NAME = "supply_inflation_annualized";
  const LABEL = "Supply inflation (annualized)";
  try {
    const data = await fetchSupplyOverTime();
    const daily = dailyLast(data.since_merge ?? data.d1);
    if (daily.length < 2) throw new Error("insufficient daily supply history");
    const end = daily[daily.length - 1];
    const windowDays = Math.min(180, daily.length - 1);
    const start = daily[daily.length - 1 - windowDays];
    const annualized = annualizedFromWindow(start.supply, end.supply, windowDays);
    if (annualized === null) throw new Error("could not compute annualized inflation");
    return {
      name: NAME,
      label: LABEL,
      status: "ok",
      value: annualized,
      formatted: `${annualized >= 0 ? "+" : ""}${fmtPct(annualized, 2)}`,
      unit: "%/yr",
      source: SOURCE,
      fetchedAt: new Date().toISOString(),
      meta: { windowDays, startSupply: start.supply, endSupply: end.supply },
    };
  } catch (e) {
    return stale(NAME, LABEL, SOURCE, e instanceof Error ? e.message : String(e));
  }
}

export { annualizedFromWindow, dailyLast, netIssuanceFromHourly, parseSupplySeries };
