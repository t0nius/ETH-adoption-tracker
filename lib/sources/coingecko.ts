/**
 * Source: CoinGecko Public API — ETH/BTC ratio
 *
 * Doc URL: https://www.coingecko.com/api/documentation
 * Endpoint: https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin&vs_currencies=usd,btc
 * Validated: 2026-05-22 (Phase 0)
 * Rate limit: ~30 req/min sans clé (free, demo plan)
 *
 * Réponse observée:
 * { "bitcoin": { "usd": 76810, "btc": 1.0 },
 *   "ethereum": { "usd": 2117.91, "btc": 0.02757738 } }
 */

import { MetricResult, stale } from "../types";

const NAME = "eth_btc";
const LABEL = "ETH/BTC ratio";
const SOURCE = "CoinGecko /simple/price";

export async function getEthBtc(): Promise<MetricResult> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin&vs_currencies=usd,btc",
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      ethereum?: { usd?: number; btc?: number };
      bitcoin?: { usd?: number };
    };
    const ratio = data.ethereum?.btc;
    if (typeof ratio !== "number") throw new Error("missing ethereum.btc field");

    return {
      name: NAME,
      label: LABEL,
      status: "ok",
      value: ratio,
      formatted: ratio.toFixed(5),
      unit: "BTC",
      source: SOURCE,
      fetchedAt: new Date().toISOString(),
      meta: {
        ethUsd: data.ethereum?.usd ?? null,
        btcUsd: data.bitcoin?.usd ?? null,
      },
    };
  } catch (e) {
    return stale(NAME, LABEL, SOURCE, e instanceof Error ? e.message : String(e));
  }
}
