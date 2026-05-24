/**
 * Source: DeFiLlama Stablecoins — Supply on Ethereum L1
 *
 * Doc URL: https://defillama.com/docs/api
 * Endpoint: https://stablecoins.llama.fi/stablecoinchains
 * Validated: 2026-05-22 (Phase 0)
 * Rate limit: ~300 req/min (annoncé via Discord, non auth)
 *
 * Réponse observée (filtrée Ethereum):
 * [{ "name": "Ethereum",
 *    "totalCirculatingUSD": { "peggedUSD": 162841595814.97, "peggedEUR": 480958773.56, ... } }]
 *
 * On utilise `peggedUSD` comme métrique principale.
 */

import { MetricResult, stale } from "../types";
import { fmtUSD } from "../format";

const NAME = "stables_supply_eth";
const LABEL = "Stablecoin supply (Ethereum L1)";
const SOURCE = "DeFiLlama /stablecoinchains";

type ChainEntry = {
  name?: string;
  totalCirculatingUSD?: Record<string, number>;
};

export async function getStablecoinSupplyEthereum(): Promise<MetricResult> {
  try {
    const res = await fetch("https://stablecoins.llama.fi/stablecoinchains");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as ChainEntry[];
    const eth = data.find((c) => c.name === "Ethereum");
    const supply = eth?.totalCirculatingUSD?.peggedUSD;
    if (typeof supply !== "number") throw new Error("Ethereum.peggedUSD not found");

    return {
      name: NAME,
      label: LABEL,
      status: "ok",
      value: supply,
      formatted: fmtUSD(supply, 2),
      unit: "USD",
      source: SOURCE,
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    return stale(NAME, LABEL, SOURCE, e instanceof Error ? e.message : String(e));
  }
}
