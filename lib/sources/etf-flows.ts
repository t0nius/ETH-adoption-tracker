/**
 * ETH spot ETF cumulative net flows (6 months) in USD.
 * Primary: CoinGlass v4 (COINGLASS_API_KEY).
 * Secondary: Blockworks (BLOCKWORKS_API_KEY).
 * Fallback: Farside Investors (direct HTML or jina.ai reader proxy).
 */

import { MetricResult, stale } from "../types";
import { fmtUSD } from "../format";

const SOURCE_COINGLASS = "CoinGlass /api/etf/ethereum/flow-history";
const SOURCE_BLOCKWORKS = "Blockworks ETH ETF flows";
const SOURCE_FARSIDE = "Farside Investors /ethereum-etf-flow-all-data";
const FARSIDE_ALL_DATA_URL = "https://farside.co.uk/ethereum-etf-flow-all-data/";
const FARSIDE_ETH_URL = "https://farside.co.uk/eth/";
const FARSIDE_JINA_ALL_DATA = `https://r.jina.ai/${FARSIDE_ALL_DATA_URL}`;
const FARSIDE_JINA_ETH = `https://r.jina.ai/${FARSIDE_ETH_URL}`;
const WINDOW_DAYS = 180;
const DAY_MS = 86_400_000;
const MILLION = 1_000_000;

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

export type FarsideFlowRow = {
  date: string;
  timestamp: number;
  totalUsd: number;
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

function parseFlowCell(raw: string): number | null {
  let totalText = raw.replace(/<[^>]*>/g, "").trim();
  if (!totalText || totalText === "—" || totalText === "-" || totalText === "–") return null;
  if (/^(total|average|maximum|minimum|fee|seed)$/i.test(totalText)) return null;
  if (totalText.includes("(") && totalText.includes(")")) {
    totalText = "-" + totalText.replace(/[()]/g, "");
  }
  totalText = totalText.replace(/,/g, "").replace(/\*/g, "").trim();
  const totalMillions = parseFloat(totalText);
  if (Number.isNaN(totalMillions)) return null;
  return totalMillions * MILLION;
}

/** Parse Farside markdown table (via jina.ai reader proxy). */
export function parseFarsideMarkdown(text: string): FarsideFlowRow[] {
  const rows: FarsideFlowRow[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    const cells = trimmed
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cells.length < 2) continue;
    const dateText = cells[0];
    if (!dateText.match(/^\d{1,2}\s+\w+\s+\d{4}$/)) continue;
    const totalUsd = parseFlowCell(cells[cells.length - 1]);
    if (totalUsd === null) continue;
    const timestamp = Date.parse(dateText);
    if (Number.isNaN(timestamp)) continue;
    rows.push({ date: dateText, timestamp, totalUsd });
  }
  return rows;
}

/** Parse jina.ai plain-text blocks (date line + one value per line). */
export function parseFarsideJinaPlaintext(text: string): FarsideFlowRow[] {
  const rows: FarsideFlowRow[] = [];
  const blocks = text.split(/\n(?=\d{1,2} \w+ \d{4}\t?)/);
  for (const block of blocks) {
    const dateMatch = block.match(/^(\d{1,2} \w+ \d{4})/);
    if (!dateMatch) continue;
    const dateText = dateMatch[1];
    const rest = block.slice(dateMatch[0].length);
    const cells = rest
      .split(/[\n\t]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (cells.length === 0) continue;
    const totalUsd = parseFlowCell(cells[cells.length - 1]);
    if (totalUsd === null) continue;
    const timestamp = Date.parse(dateText);
    if (Number.isNaN(timestamp)) continue;
    rows.push({ date: dateText, timestamp, totalUsd });
  }
  return rows;
}

/** Auto-detect jina.ai response: markdown pipe table or plain-text blocks. */
export function parseFarsideJinaContent(text: string): FarsideFlowRow[] {
  const markdown = parseFarsideMarkdown(text);
  if (markdown.length > 0) return markdown;
  return parseFarsideJinaPlaintext(text);
}

/** Parse Farside all-data HTML table — exported for unit tests. */
export function parseFarsideEtfHtml(html: string): FarsideFlowRow[] {
  const tableRowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  const rows: FarsideFlowRow[] = [];

  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = tableRowRegex.exec(html)) !== null) {
    const rowHtml = rowMatch[1];
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(cellMatch[1]);
    }
    if (cells.length < 2) continue;

    const dateText = cells[0].replace(/<[^>]*>/g, "").trim();
    if (!dateText.match(/\d+\s+\w+\s+\d+/)) continue;
    if (/^(total|average|maximum|minimum)$/i.test(dateText)) continue;

    const totalUsd = parseFlowCell(cells[cells.length - 1]);
    if (totalUsd === null) continue;

    const timestamp = Date.parse(dateText);
    if (Number.isNaN(timestamp)) continue;

    rows.push({ date: dateText, timestamp, totalUsd });
  }
  return rows;
}

/** Sum Farside daily totals within the rolling window. */
export function sumFarside6mUsd(
  rows: FarsideFlowRow[],
  windowDays = WINDOW_DAYS,
  nowMs = Date.now(),
): number | null {
  const cutoff = nowMs - windowDays * DAY_MS;
  let sum = 0;
  let count = 0;
  for (const row of rows) {
    if (row.timestamp < cutoff) continue;
    sum += row.totalUsd;
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

async function fetchFarside6m(): Promise<number> {
  const errors: string[] = [];

  const jinaSources = [
    { label: "all-data", url: FARSIDE_JINA_ALL_DATA },
    { label: "eth", url: FARSIDE_JINA_ETH },
  ];
  for (const { label, url } of jinaSources) {
    try {
      const res = await fetch(url, { headers: { accept: "text/plain" } });
      if (!res.ok) throw new Error(`jina ${label} HTTP ${res.status}`);
      const text = await res.text();
      const rows = parseFarsideJinaContent(text);
      const total = sumFarside6mUsd(rows);
      if (total === null) throw new Error(`jina ${label}: no flows in 6M window (${rows.length} rows)`);
      return total;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  try {
    const res = await fetch(FARSIDE_ALL_DATA_URL, {
      headers: {
        accept: "text/html",
        "user-agent": "ETH-Adoption-Tracker/1.0 (+https://github.com/t0nius/ETH-adoption-tracker)",
      },
    });
    if (!res.ok) throw new Error(`Farside HTTP ${res.status}`);
    const html = await res.text();
    if (html.includes("Just a moment") || html.includes("challenge-platform")) {
      throw new Error("Farside blocked by Cloudflare");
    }
    const rows = parseFarsideEtfHtml(html);
    const total = sumFarside6mUsd(rows);
    if (total === null) throw new Error("Farside HTML returned no flows in 6M window");
    return total;
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  throw new Error(errors.join("; ") || "Farside fetch failed");
}

function okEtfResult(total: number, source: string, provider: string): MetricResult {
  return {
    name: "etf_flows_6m_usd",
    label: "ETF spot net flows (6M cumul.)",
    status: "ok",
    value: total,
    formatted: `${total >= 0 ? "+" : ""}${fmtUSD(total, 2)}`,
    unit: "USD",
    source,
    fetchedAt: new Date().toISOString(),
    meta: { windowDays: WINDOW_DAYS, provider },
  };
}

export async function getEtfFlows6mUsd(): Promise<MetricResult> {
  const NAME = "etf_flows_6m_usd";
  const LABEL = "ETF spot net flows (6M cumul.)";
  const coinGlassKey = process.env.COINGLASS_API_KEY?.trim();
  const blockworksKey = process.env.BLOCKWORKS_API_KEY?.trim();
  const errors: string[] = [];

  if (coinGlassKey) {
    try {
      const total = await fetchCoinGlass6m(coinGlassKey);
      return okEtfResult(total, SOURCE_COINGLASS, "coinglass");
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  if (blockworksKey) {
    try {
      const total = await fetchBlockworks6m(blockworksKey);
      return okEtfResult(total, SOURCE_BLOCKWORKS, "blockworks");
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  try {
    const total = await fetchFarside6m();
    return okEtfResult(total, SOURCE_FARSIDE, "farside");
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  return stale(
    NAME,
    LABEL,
    [SOURCE_COINGLASS, SOURCE_BLOCKWORKS, SOURCE_FARSIDE].join(" | "),
    errors.join("; ") || "ETF fetch failed — use manual input on /triggers",
  );
}

export { WINDOW_DAYS as ETF_FLOW_WINDOW_DAYS, sumFlowsInWindow };
