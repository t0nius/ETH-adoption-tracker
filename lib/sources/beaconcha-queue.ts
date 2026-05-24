/**
 * Validator exit vs entry queue ratio.
 * Primary: beaconcha.in V2 (BEACONCHAIN_API_KEY).
 * Fallback: PublicNode Beacon API — no key (pending_initialized + pending_queued vs active_exiting).
 */

import { MetricResult, stale } from "../types";
import { fmtNum } from "../format";

const SOURCE_BEACONCHA = "beaconcha.in /api/v2/ethereum/queues";
const SOURCE_PUBLICNODE = "PublicNode Beacon API (validator queues)";

const BEACON_BASE = "https://ethereum-beacon-api.publicnode.com";

type QueueStats = {
  data?: {
    deposit_queue?: { balance?: string | null };
    exit_queue?: { balance?: string | null };
  };
};

type BeaconValidatorRow = {
  balance?: string;
  status?: string;
};

type BeaconValidatorsResponse = {
  data?: BeaconValidatorRow[];
};

function weiToEth(wei: string | null | undefined): number | null {
  if (!wei || wei === "0") return 0;
  try {
    return Number(BigInt(wei)) / 1e18;
  } catch {
    return null;
  }
}

function gweiToEth(gwei: string | null | undefined): number {
  if (!gwei || gwei === "0") return 0;
  const n = Number(gwei);
  return Number.isFinite(n) ? n / 1e9 : 0;
}

function ratioFromBalances(depositEth: number, exitEth: number): number {
  const ratio = depositEth > 0 ? exitEth / depositEth : exitEth > 0 ? Infinity : 0;
  return Number.isFinite(ratio) ? ratio : 99.99;
}

function okResult(
  depositEth: number,
  exitEth: number,
  source: string,
  meta: Record<string, unknown>,
): MetricResult {
  const displayRatio = ratioFromBalances(depositEth, exitEth);
  return {
    name: "validator_queue_ratio",
    label: "Exit queue / entry queue",
    status: "ok",
    value: displayRatio,
    formatted: `${fmtNum(displayRatio, 2)}×`,
    unit: "ratio",
    source,
    fetchedAt: new Date().toISOString(),
    meta: { exitEth, depositEth, ...meta },
  };
}

async function fetchBeaconchaRatio(apiKey: string): Promise<MetricResult> {
  const res = await fetch("https://beaconcha.in/api/v2/ethereum/queues", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ chain: "mainnet" }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
  }
  const json = (await res.json()) as QueueStats;
  const depositWei = json.data?.deposit_queue?.balance;
  const exitWei = json.data?.exit_queue?.balance;
  const depositEth = weiToEth(depositWei);
  const exitEth = weiToEth(exitWei);
  if (depositEth === null || exitEth === null) {
    throw new Error("deposit_queue.balance or exit_queue.balance missing");
  }
  return okResult(depositEth, exitEth, SOURCE_BEACONCHA, { depositWei, exitWei });
}

async function fetchValidatorsByStatus(status: string): Promise<BeaconValidatorRow[]> {
  const url = `${BEACON_BASE}/eth/v1/beacon/states/head/validators?status=${encodeURIComponent(status)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PublicNode ${status} HTTP ${res.status}`);
  const json = (await res.json()) as BeaconValidatorsResponse;
  return json.data ?? [];
}

function sumBalanceGwei(rows: BeaconValidatorRow[]): number {
  let sum = 0;
  for (const row of rows) {
    sum += gweiToEth(row.balance);
  }
  return sum;
}

async function fetchPublicNodeRatio(): Promise<MetricResult> {
  const [pendingInit, pendingQueued, exiting] = await Promise.all([
    fetchValidatorsByStatus("pending_initialized"),
    fetchValidatorsByStatus("pending_queued"),
    fetchValidatorsByStatus("active_exiting"),
  ]);
  const depositEth = sumBalanceGwei(pendingInit) + sumBalanceGwei(pendingQueued);
  const exitEth = sumBalanceGwei(exiting);
  return okResult(depositEth, exitEth, SOURCE_PUBLICNODE, {
    provider: "publicnode",
    pending_initialized: pendingInit.length,
    pending_queued: pendingQueued.length,
    active_exiting: exiting.length,
  });
}

export async function getValidatorQueueRatio(): Promise<MetricResult> {
  const NAME = "validator_queue_ratio";
  const LABEL = "Exit queue / entry queue";
  const apiKey = process.env.BEACONCHAIN_API_KEY?.trim();
  const errors: string[] = [];

  if (apiKey) {
    try {
      return await fetchBeaconchaRatio(apiKey);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  try {
    return await fetchPublicNodeRatio();
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  return stale(
    NAME,
    LABEL,
    apiKey ? SOURCE_BEACONCHA : SOURCE_PUBLICNODE,
    errors.join("; ") || "Validator queue fetch failed",
  );
}
