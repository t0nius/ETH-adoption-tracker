/**
 * Source: Public Ethereum RPC — Blob count per latest block
 *
 * Doc URL: https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getblockbynumber
 * Endpoint: https://ethereum-rpc.publicnode.com (POST, JSON-RPC)
 * Validated: 2026-05-22 (Phase 0)
 * Rate limit: PublicNode généreux, fallback eth.llamarpc.com / cloudflare-eth.com
 *
 * Méthode: eth_getBlockByNumber(["latest", false])
 * Réponse observée (champs pertinents):
 *   { "result": { "number":"0x17fca36", "blobGasUsed":"0x20000",
 *                  "excessBlobGas":"0xad29aa2", ... } }
 *
 * Calcul: blob_count = int(blobGasUsed, 16) / 131072  (1 blob = 131,072 gas)
 *
 * NB: pour la moyenne quotidienne il faudra sampler N blocks (Phase 2 + DB).
 * Phase 1 montre la valeur du dernier block.
 */

import { MetricResult, stale } from "../types";

const NAME = "blob_count_latest";
const LABEL = "Blobs in latest block";
const SOURCE = "PublicNode eth_getBlockByNumber";

const RPC_URLS = [
  "https://ethereum-rpc.publicnode.com",
  "https://eth.llamarpc.com",
  "https://cloudflare-eth.com",
];

const GAS_PER_BLOB = 131072n;

async function rpcCall(url: string): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_getBlockByNumber",
      params: ["latest", false],
      id: 1,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getBlobCountLatest(): Promise<MetricResult> {
  const errors: string[] = [];
  for (const url of RPC_URLS) {
    try {
      const data = (await rpcCall(url)) as {
        result?: { blobGasUsed?: string; number?: string };
      };
      const blobGasUsedHex = data.result?.blobGasUsed;
      if (!blobGasUsedHex) throw new Error("blobGasUsed missing");
      const blobs = Number(BigInt(blobGasUsedHex) / GAS_PER_BLOB);
      return {
        name: NAME,
        label: LABEL,
        status: "ok",
        value: blobs,
        formatted: blobs.toString(),
        unit: "blobs",
        source: `${SOURCE} @ ${new URL(url).hostname}`,
        fetchedAt: new Date().toISOString(),
        meta: { blockHex: data.result?.number ?? null },
      };
    } catch (e) {
      errors.push(`${url}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return stale(NAME, LABEL, SOURCE, errors.join(" | "));
}
