/**
 * Source: DeFiLlama /protocols — Part Ethereum dans le RWA tokenisé
 *
 * Doc URL: https://defillama.com/docs/api
 * Endpoint: https://api.llama.fi/protocols
 * Validated: 2026-05-22 (Phase 0)
 * Rate limit: idem stablecoins (~300 req/min)
 * Payload ~8 MB JSON — caché 5 min côté Next.
 *
 * Réponse: array de protocols, on filtre category === "RWA"
 * Chaque entrée a `chainTvls: { Ethereum: number, Polygon: number, ... }` et `tvl: number`.
 * Métrique calculée: (somme chainTvls.Ethereum sur RWA) / (somme tvl RWA) en %.
 * Au 2026-05-22 : 14.92B / 26.91B = 55.4 %.
 */

import { MetricResult, stale } from "../types";
import { fmtPct } from "../format";

const NAME = "rwa_eth_share";
const LABEL = "RWA share on Ethereum";
const SOURCE = "DeFiLlama /protocols (category=RWA)";

type Protocol = {
  name?: string;
  category?: string;
  tvl?: number | null;
  chainTvls?: Record<string, number>;
};

export async function getRwaShareEthereum(): Promise<MetricResult> {
  try {
    const res = await fetch("https://api.llama.fi/protocols");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Protocol[];
    const rwa = data.filter((p) => p.category === "RWA");
    if (rwa.length === 0) throw new Error("no RWA protocols found");

    const totalTvl = rwa.reduce((s, p) => s + (p.tvl ?? 0), 0);
    const ethTvl = rwa.reduce((s, p) => s + (p.chainTvls?.Ethereum ?? 0), 0);
    if (totalTvl <= 0) throw new Error("RWA total tvl <= 0");

    const sharePct = (ethTvl / totalTvl) * 100;

    return {
      name: NAME,
      label: LABEL,
      status: "ok",
      value: sharePct,
      formatted: fmtPct(sharePct, 1),
      unit: "%",
      source: SOURCE,
      fetchedAt: new Date().toISOString(),
      meta: { totalTvl, ethTvl, protocolCount: rwa.length },
    };
  } catch (e) {
    return stale(NAME, LABEL, SOURCE, e instanceof Error ? e.message : String(e));
  }
}
