/**
 * ETH spot ETF cumulative net flows (6 months) in USD.
 * Primary: CoinGlass v4 (COINGLASS_API_KEY, header CG-API-KEY).
 * Fallback: Blockworks public API if BLOCKWORKS_API_KEY is set.
 */

import { MetricResult, stale } from "../types";
import { fmtUSD } from "../format";

const SOURCE_COINGLASS = "CoinGlass /api/etf/ethereum/flow-history";
const SOURCE_BLOCKWORKS = "Blockworks ETH ETF flows";
const WINDOW_DAYS = 180;
const DAY_MS = 86_400_000;

type CoinGlassRow = {
  timestamp?: number;
  flow_usd?: number;
  change_usd?: number;
};

type CoinGlassResponse = {
  code?: string;
  msg?: string;
  data?: CoinGlassRow[];
};

function sumFlowsInWindow(rows: CoinGlassRow[], windowMs: number): number | null {
  const cutoff = Date.now() - windowMs;
  let sum = 0;
  let count = 0;
  for (const row of rows) {
    if (typeof row.timestamp !== "number" || row.timestamp < cutoff) continue;
    const flow = row.flow_usd ?? row.change_usd;
    if (typeof flow !== "number") continue;
    sum += flow;
    count++;
  }
  return count > 0 ? sum : null;
}

async function fetchCoinGlass6m(apiKey: string): Promise<number> {
  const res = await fetch(
    "https://open-api-v4.coinglass.com/api/etf/ethereum/flow-history",
    {
      headers: {
        accept: "application/json",
        "CG-API-KEY": apiKey,
      },
    },
  );
  if (!res.ok) throw new Error(`CoinGlass HTTP ${res.status}`);
  const json = (await res.json()) as CoinGlassResponse;
  if (json.code !== "0" && json.code !== undefined) {
    throw new Error(json.msg ?? `CoinGlass code ${json.code}`);
  }
  const total = sumFlowsInWindow(json.data ?? [], WINDOW_DAYS * DAY_MS);
  if (total === null) throw new Error("CoinGlass returned no flows in 6M window");
  return total;
}

async function fetchBlockworks6m(apiKey: string): Promise<number> {
  const res = await fetch(
    "https://api.blockworks.co/v1/analytics/etf/ethereum/flows",
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  if (!res.ok) throw new Error(`Blockworks HTTP ${res.status}`);
  const json = (await res.json()) as { data?: Array<{ date?: string; netFlow?: number }> };
  const cutoff = Date.now() - WINDOW_DAYS * DAY_MS;
  let sum = 0;
  let count = 0;
  for (const row of json.data ?? []) {
    if (!row.date) continue;
    const ts = Date.parse(row.date);
    if (Number.isNaN(ts) || ts < cutoff) continue;
    if (typeof row.netFlow !== "number") continue;
    sum += row.netFlow;
    count++;
  }
  if (count === 0) throw new Error("Blockworks returned no flows in 6M window");
  return sum;
}

export async function getEtfFlows6mUsd(): Promise<MetricResult> {
  const NAME = "etf_flows_6m_usd";
  const LABEL = "ETF spot net flows (6M cumul.)";
  const coinGlassKey = process.env.COINGLASS_API_KEY?.trim();
  const blockworksKey = process.env.BLOCKWORKS_API_KEY?.trim();

  if (!coinGlassKey && !blockworksKey) {
    return stale(
      NAME,
      LABEL,
      `${SOURCE_COINGLASS} | ${SOURCE_BLOCKWORKS}`,
      "COINGLASS_API_KEY or BLOCKWORKS_API_KEY not set — use manual ETF input on /triggers",
    );
  }

  const errors: string[] = [];
  if (coinGlassKey) {
    try {
      const total = await fetchCoinGlass6m(coinGlassKey);
      return {
        name: NAME,
        label: LABEL,
        status: "ok",
        value: total,
        formatted: `${total >= 0 ? "+" : ""}${fmtUSD(total, 2)}`,
        unit: "USD",
        source: SOURCE_COINGLASS,
        fetchedAt: new Date().toISOString(),
        meta: { windowDays: WINDOW_DAYS, provider: "coinglass" },
      };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  if (blockworksKey) {
    try {
      const total = await fetchBlockworks6m(blockworksKey);
      return {
        name: NAME,
        label: LABEL,
        status: "ok",
        value: total,
        formatted: `${total >= 0 ? "+" : ""}${fmtUSD(total, 2)}`,
        unit: "USD",
        source: SOURCE_BLOCKWORKS,
        fetchedAt: new Date().toISOString(),
        meta: { windowDays: WINDOW_DAYS, provider: "blockworks" },
      };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  return stale(
    NAME,
    LABEL,
    coinGlassKey ? SOURCE_COINGLASS : SOURCE_BLOCKWORKS,
    errors.join("; ") || "ETF fetch failed",
  );
}

export { WINDOW_DAYS as ETF_FLOW_WINDOW_DAYS, sumFlowsInWindow };
