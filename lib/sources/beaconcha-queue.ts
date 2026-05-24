/**
 * Validator exit vs entry queue ratio via beaconcha.in V2 API.
 * Requires BEACONCHAIN_API_KEY (free tier: 10 req/min).
 *
 * POST https://beaconcha.in/api/v2/ethereum/queues
 * ratio = exit_queue.balance / deposit_queue.balance (wei strings)
 */

import { MetricResult, stale } from "../types";
import { fmtNum } from "../format";

const SOURCE = "beaconcha.in /api/v2/ethereum/queues";

type QueueStats = {
  data?: {
    deposit_queue?: { balance?: string | null };
    exit_queue?: { balance?: string | null };
  };
};

function weiToEth(wei: string | null | undefined): number | null {
  if (!wei || wei === "0") return 0;
  try {
    return Number(BigInt(wei)) / 1e18;
  } catch {
    return null;
  }
}

export async function getValidatorQueueRatio(): Promise<MetricResult> {
  const NAME = "validator_queue_ratio";
  const LABEL = "Exit queue / entry queue";
  const apiKey = process.env.BEACONCHAIN_API_KEY?.trim();
  if (!apiKey) {
    return stale(
      NAME,
      LABEL,
      SOURCE,
      "BEACONCHAIN_API_KEY not set — add free key at beaconcha.in",
    );
  }

  try {
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
    const ratio = depositEth > 0 ? exitEth / depositEth : exitEth > 0 ? Infinity : 0;
    const displayRatio = Number.isFinite(ratio) ? ratio : 99.99;
    return {
      name: NAME,
      label: LABEL,
      status: "ok",
      value: displayRatio,
      formatted: `${fmtNum(displayRatio, 2)}×`,
      unit: "ratio",
      source: SOURCE,
      fetchedAt: new Date().toISOString(),
      meta: { exitEth, depositEth, depositWei, exitWei },
    };
  } catch (e) {
    return stale(NAME, LABEL, SOURCE, e instanceof Error ? e.message : String(e));
  }
}
