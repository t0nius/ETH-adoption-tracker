/**
 * Source: ultrasound.money — Burn rate / Net issuance / Staking ratio
 *
 * Doc URL: pas de doc officielle, API observée via DevTools sur ultrasound.money
 * Endpoints:
 *   - https://ultrasound.money/api/v2/fees/burn-sums
 *   - https://ultrasound.money/api/v2/fees/supply-over-time
 *   - https://ultrasound.money/api/v2/fees/effective-balance-sum
 * Validated: 2026-05-22 (Phase 0)
 * Rate limit: non documenté, pas d'auth
 *
 * burn-sums response:
 * { "d1":{"sum":{"eth":30.51,"usd":64964.45},"timestamp":"..."},
 *   "d7":{...},"d30":{...},"h1":{...},"m5":{...},
 *   "since_burn":{"sum":{"eth":4633604.23, ...}},
 *   "since_merge":{"sum":{"eth":2010294.89, ...}} }
 *
 * supply-over-time response:
 * { "block_number":..., "d1":[{"supply":121713509.10,"timestamp":"..."}, ...] }
 *
 * effective-balance-sum response:
 * { "slot":..., "sum":39076901000000000, "timestamp":"..." }
 *   -> sum en gwei. ETH staked = sum / 1e9
 *
 * Staking ratio = staked_eth / total_supply.
 * Net issuance (ETH/day) = (supply[now] - supply[24h ago]) — approximé par burn d30/30 et le baseline.
 *  Pour Phase 1 on affiche le burn d1 et la supply totale. Net issuance computé en Phase 2 quand on a la DB.
 */

import { MetricResult, stale } from "../types";
import { fmtNum, fmtPct } from "../format";

const SOURCE_BURN = "ultrasound.money /v2/fees/burn-sums";
const SOURCE_SUPPLY = "ultrasound.money /v2/fees/supply-over-time";
const SOURCE_STAKED = "ultrasound.money /v2/fees/effective-balance-sum";

type BurnSums = {
  d1?: { sum?: { eth?: number; usd?: number } };
  d7?: { sum?: { eth?: number; usd?: number } };
  d30?: { sum?: { eth?: number; usd?: number } };
};

type SupplyOverTime = {
  d1?: Array<{ supply?: number; timestamp?: string }>;
};

type EffectiveBalanceSum = {
  sum?: number;
  timestamp?: string;
};

export async function fetchSupply(): Promise<number> {
  const res = await fetch("https://ultrasound.money/api/v2/fees/supply-over-time");
  if (!res.ok) throw new Error(`supply HTTP ${res.status}`);
  const data = (await res.json()) as SupplyOverTime;
  const last = data.d1?.[data.d1.length - 1];
  const supply = last?.supply;
  if (typeof supply !== "number") throw new Error("supply.d1[-1].supply missing");
  return supply;
}

export async function getBurnRateDaily(): Promise<MetricResult> {
  const NAME = "burn_24h";
  const LABEL = "ETH burned (last 24h)";
  try {
    const res = await fetch("https://ultrasound.money/api/v2/fees/burn-sums");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as BurnSums;
    const burned = data.d1?.sum?.eth;
    if (typeof burned !== "number") throw new Error("d1.sum.eth missing");
    return {
      name: NAME,
      label: LABEL,
      status: "ok",
      value: burned,
      formatted: fmtNum(burned, 1),
      unit: "ETH",
      source: SOURCE_BURN,
      fetchedAt: new Date().toISOString(),
      meta: {
        usd24h: data.d1?.sum?.usd ?? null,
        d7Eth: data.d7?.sum?.eth ?? null,
        d30Eth: data.d30?.sum?.eth ?? null,
      },
    };
  } catch (e) {
    return stale(NAME, LABEL, SOURCE_BURN, e instanceof Error ? e.message : String(e));
  }
}

/** Total ETH supply (L1) — used for T1.2 supply-growth trigger; not shown on the board (see `eth_total_supply`). */
export async function getEthTotalSupply(): Promise<MetricResult> {
  const NAME = "eth_total_supply";
  const LABEL = "ETH total supply";
  try {
    const supply = await fetchSupply();
    return {
      name: NAME,
      label: LABEL,
      status: "ok",
      value: supply,
      formatted: fmtNum(supply, 0),
      unit: "ETH",
      source: SOURCE_SUPPLY,
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    return stale(NAME, LABEL, SOURCE_SUPPLY, e instanceof Error ? e.message : String(e));
  }
}

export async function getStakingRatio(): Promise<MetricResult> {
  const NAME = "staking_ratio";
  const LABEL = "Staking ratio";
  try {
    const [stakedRes, totalSupply] = await Promise.all([
      fetch("https://ultrasound.money/api/v2/fees/effective-balance-sum"),
      fetchSupply(),
    ]);
    if (!stakedRes.ok) throw new Error(`staked HTTP ${stakedRes.status}`);
    const stakedJson = (await stakedRes.json()) as EffectiveBalanceSum;
    const sumGwei = stakedJson.sum;
    if (typeof sumGwei !== "number") throw new Error("effective-balance-sum.sum missing");
    const stakedEth = sumGwei / 1e9;
    const ratio = (stakedEth / totalSupply) * 100;
    return {
      name: NAME,
      label: LABEL,
      status: "ok",
      value: ratio,
      formatted: fmtPct(ratio, 1),
      unit: "%",
      source: `${SOURCE_STAKED} + ${SOURCE_SUPPLY}`,
      fetchedAt: new Date().toISOString(),
      meta: { stakedEth, totalSupply },
    };
  } catch (e) {
    return stale(
      NAME,
      LABEL,
      `${SOURCE_STAKED} + ${SOURCE_SUPPLY}`,
      e instanceof Error ? e.message : String(e),
    );
  }
}
