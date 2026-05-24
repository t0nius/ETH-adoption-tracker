/**
 * Source: DeFiLlama /v2/chains — ETH ecosystem share of global DeFi TVL
 *
 * Doc URL: https://defillama.com/docs/api
 * Endpoint: https://api.llama.fi/v2/chains
 * Validated: 2026-05-22 (Phase 4)
 * Rate limit: ~300 req/min (same as other DeFiLlama public endpoints)
 *
 * Réponse: array de chains, chacune avec `name`, `tvl`.
 *
 * Métrique calculée:
 *   (Ethereum L1 + sum of known L2s) / sum of all chains
 *
 * Sert d'input pour le trigger T1.1 "ETH L1+L2 < 40% TVL DeFi global".
 * Pas affichée comme card sur le dashboard (purement underlying trigger).
 */

import { MetricResult, stale } from "../types";
import { fmtPct } from "../format";

const NAME = "eth_defi_share";
const LABEL = "ETH ecosystem share of global DeFi TVL";
const SOURCE = "DeFiLlama /v2/chains (ETH L1 + L2s / global)";

// DeFiLlama chain names for Ethereum L1 + main L2s. Conservative list — adding a
// chain here that's not actually anchored to Ethereum would inflate the share.
const ETH_ECOSYSTEM = new Set<string>([
  "Ethereum",
  "Arbitrum",
  "Base",
  "Optimism",
  "Polygon",
  "Polygon zkEVM",
  "Scroll",
  "Linea",
  "zkSync Era",
  "Mantle",
  "Taiko",
  "Blast",
  "Metis",
  "Mode",
  "Fraxtal",
  "Manta",
  "Starknet",
  "Arbitrum Nova",
  "Soneium",
  "Worldchain",
  "Ink",
  "Lisk",
  "Loopring",
  "Plume",
  "Unichain",
  "Zircuit",
]);

type Chain = { name?: string; tvl?: number | null };

export async function getEthDefiShare(): Promise<MetricResult> {
  try {
    const res = await fetch("https://api.llama.fi/v2/chains");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Chain[];
    let ethSum = 0;
    let globalSum = 0;
    const breakdown: Record<string, number> = {};
    for (const c of data) {
      const tvl = c.tvl ?? 0;
      if (tvl <= 0) continue;
      globalSum += tvl;
      if (c.name && ETH_ECOSYSTEM.has(c.name)) {
        ethSum += tvl;
        breakdown[c.name] = tvl;
      }
    }
    if (globalSum <= 0) throw new Error("global TVL <= 0");
    const sharePct = (ethSum / globalSum) * 100;
    return {
      name: NAME,
      label: LABEL,
      status: "ok",
      value: sharePct,
      formatted: fmtPct(sharePct, 1),
      unit: "%",
      source: SOURCE,
      fetchedAt: new Date().toISOString(),
      meta: { ethSum, globalSum, breakdown },
    };
  } catch (e) {
    return stale(NAME, LABEL, SOURCE, e instanceof Error ? e.message : String(e));
  }
}
