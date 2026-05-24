/**
 * Source: Strategic ETH Reserve (SΞR) — total ETH held by tracked entities
 *
 * URL: https://www.strategicethreserve.xyz/
 * Validated: 2026-05-22 (Phase 3)
 * No public API. Data is embedded server-side in the Next.js App Router
 * RSC payload (`self.__next_f.push([N, "<escaped JSON>"])`). We extract the
 * `"companies":[...]` array directly from the HTML — no Playwright needed.
 *
 * Each company entry has:
 *   { id, name, category, status, currentReserve, ... }
 *
 * Filters applied:
 *   - status === "ACTIVE"  (drops INACTIVE / IN_REVIEW / PENDING)
 *   - currentReserve <= 10_000_000 ETH  (sanity cap — total ETH supply ~120M)
 *
 * As of 2026-05-22 validation: 67 active entities, 7.37M ETH total.
 * Top holders: Bitmine Immersion (4.6M), SharpLink Gaming (863k),
 * The Ether Machine (497k), Ethereum Foundation (250k), Coinbase (151k).
 */

import { MetricResult, stale } from "../types";
import { fmtNum } from "../format";

const NAME = "ser_total_eth";
const LABEL = "Strategic ETH Reserve (total)";
const SOURCE = "strategicethreserve.xyz (RSC payload scrape)";

const SUPPLY_CAP_PER_ENTITY = 10_000_000;

type Company = {
  id?: string;
  name?: string;
  category?: string;
  status?: string;
  currentReserve?: number;
};

function extractRscPayload(html: string): string {
  const re = /self\.__next_f\.push\(\[\d+,"((?:[^"\\]|\\.)*)"\]\)/g;
  let combined = "";
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    combined += JSON.parse(`"${m[1]}"`);
  }
  return combined;
}

function findCompaniesArray(rsc: string): Company[] {
  const m = rsc.match(/"companies"\s*:\s*\[/);
  if (!m || m.index === undefined) {
    throw new Error('"companies" array not found in RSC payload');
  }
  const start = m.index + m[0].length - 1; // position of '['
  let depth = 0;
  let end = -1;
  for (let i = start; i < rsc.length; i++) {
    const c = rsc[i];
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) throw new Error('"companies" array close bracket not found');
  return JSON.parse(rsc.slice(start, end)) as Company[];
}

export type SerBreakdown = {
  totalEth: number;
  activeCount: number;
  byCategory: Record<string, number>;
  top5: Array<{ name: string; category: string; currentReserve: number }>;
};

export function aggregate(companies: Company[]): SerBreakdown {
  const active = companies.filter(
    (c) =>
      c.status === "ACTIVE" &&
      typeof c.currentReserve === "number" &&
      c.currentReserve >= 0 &&
      c.currentReserve <= SUPPLY_CAP_PER_ENTITY,
  );
  const byCategory: Record<string, number> = {};
  let total = 0;
  for (const c of active) {
    total += c.currentReserve as number;
    const cat = c.category ?? "Unknown";
    byCategory[cat] = (byCategory[cat] ?? 0) + (c.currentReserve as number);
  }
  const top5 = [...active]
    .sort((a, b) => (b.currentReserve ?? 0) - (a.currentReserve ?? 0))
    .slice(0, 5)
    .map((c) => ({
      name: c.name ?? "?",
      category: c.category ?? "?",
      currentReserve: c.currentReserve as number,
    }));
  return { totalEth: total, activeCount: active.length, byCategory, top5 };
}

export async function getSerTotalEth(): Promise<MetricResult> {
  try {
    const res = await fetch("https://www.strategicethreserve.xyz/", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; eth-adoption-tracker/0.1)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const rsc = extractRscPayload(html);
    const companies = findCompaniesArray(rsc);
    const agg = aggregate(companies);
    if (agg.totalEth <= 0) throw new Error("total ETH <= 0 (empty aggregation)");

    return {
      name: NAME,
      label: LABEL,
      status: "ok",
      value: agg.totalEth,
      formatted: fmtNum(agg.totalEth, 2),
      unit: "ETH",
      source: SOURCE,
      fetchedAt: new Date().toISOString(),
      meta: {
        activeCount: agg.activeCount,
        byCategory: agg.byCategory,
        top5: agg.top5,
      },
    };
  } catch (e) {
    return stale(NAME, LABEL, SOURCE, e instanceof Error ? e.message : String(e));
  }
}
