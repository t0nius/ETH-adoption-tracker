/**
 * Pure trigger evaluation logic. Each function takes the relevant snapshot
 * history (and optional manual state) and returns a TriggerEval.
 *
 * Convex bindings in convex/triggers.ts call these after fetching from DB.
 *
 * Status semantics:
 *   - "ok"                — condition not met
 *   - "warning"           — condition currently met but not yet sustained for the
 *                           full confirmation period (e.g. 60 of 180 days under
 *                           threshold)
 *   - "triggered"         — condition sustained for the full confirmation period
 *   - "insufficient_data" — not enough history to evaluate the period
 *   - "needs_manual"      — depends on data we can't auto-fetch (e.g. ETF flows)
 *   - "partial"           — one of two AND/OR sub-conditions evaluable, the other
 *                           missing data
 *   - "error"             — evaluation crashed (caught and surfaced)
 */

import { bucketDailyLast, clean, daysCovered } from "./helpers";
import type { ManualState, Snapshot, TriggerEval } from "./types";

const DAY_MS = 86_400_000;

// -------- T1.1 — ETH L1+L2 < 40% TVL DeFi global for 2 consecutive quarters --

export function evalT11(history: Snapshot[]): TriggerEval {
  const base = {
    trigger_name: "T1.1_eth_defi_share_drop",
    tier: 1,
    description:
      "ETH L1+L2 < 40% of global DeFi TVL for 2 consecutive quarters (180 days).",
    threshold_value: 40,
  };
  const points = clean(history);
  const daily = bucketDailyLast(points);
  const latest = daily[daily.length - 1];
  const current = latest?.value ?? null;

  if (daysCovered(points) < 180) {
    return {
      ...base,
      status: "insufficient_data",
      message: `Have ${daysCovered(points)} / 180 days of history. Latest share: ${current?.toFixed(1) ?? "—"}%.`,
      current_value: current,
      metadata: { days_covered: daysCovered(points) },
    };
  }
  const last180 = daily.slice(-180);
  const allUnder = last180.every((d) => d.value < 40);
  if (allUnder) {
    return {
      ...base,
      status: "triggered",
      message: `ETH share < 40% throughout the last 180 days. Latest: ${current!.toFixed(1)}%.`,
      current_value: current,
    };
  }
  if (current !== null && current < 40) {
    const consecutive = countTailUnder(last180, 40);
    return {
      ...base,
      status: "warning",
      message: `Currently ${current.toFixed(1)}% (< 40%). Sustained for ${consecutive} / 180 days.`,
      current_value: current,
      metadata: { consecutive_days_under: consecutive },
    };
  }
  return {
    ...base,
    status: "ok",
    message: `ETH share ${current?.toFixed(1) ?? "—"}% (> 40% threshold).`,
    current_value: current,
  };
}

function countTailUnder(
  daily: Array<{ value: number }>,
  threshold: number,
): number {
  let count = 0;
  for (let i = daily.length - 1; i >= 0; i--) {
    if (daily[i].value < threshold) count++;
    else break;
  }
  return count;
}

// -------- T1.2 — Supply growth annualized > +1% for 6 months ------------------

export function evalT12(supplyHistory: Snapshot[]): TriggerEval {
  const base = {
    trigger_name: "T1.2_supply_inflationary",
    tier: 1,
    description:
      "ETH supply growth annualized > +1% for 6 consecutive months (180 days).",
    threshold_value: 1,
  };
  const points = clean(supplyHistory);
  if (daysCovered(points) < 180) {
    return {
      ...base,
      status: "insufficient_data",
      message: `Have ${daysCovered(points)} / 180 days of supply history.`,
      current_value: null,
      metadata: { days_covered: daysCovered(points) },
    };
  }
  // For each day in the last 180, compute annualized growth vs 180 days earlier.
  const daily = bucketDailyLast(points);
  const recent = daily.slice(-180);
  if (recent.length < 180) {
    return {
      ...base,
      status: "insufficient_data",
      message: "Not enough daily buckets in window.",
      current_value: null,
    };
  }
  const start = recent[0];
  const end = recent[recent.length - 1];
  // Annualized growth: ((end/start)^(365/180) - 1) * 100
  const ratio = end.value / start.value;
  const annualizedPct = (Math.pow(ratio, 365 / 180) - 1) * 100;
  const allDaysInflationary = recent.every((_, i) => {
    if (i === 0) return false;
    return recent[i].value > recent[i - 1].value;
  });
  if (annualizedPct > 1 && allDaysInflationary) {
    return {
      ...base,
      status: "triggered",
      message: `Annualized supply growth ${annualizedPct.toFixed(2)}% > 1% and supply rose every day in window.`,
      current_value: annualizedPct,
    };
  }
  if (annualizedPct > 1) {
    return {
      ...base,
      status: "warning",
      message: `Annualized supply growth ${annualizedPct.toFixed(2)}% > 1% but interrupted (not strictly monotonic).`,
      current_value: annualizedPct,
    };
  }
  return {
    ...base,
    status: "ok",
    message: `Annualized supply growth ${annualizedPct.toFixed(2)}% (≤ 1%).`,
    current_value: annualizedPct,
  };
}

function countTailOver(
  daily: Array<{ value: number }>,
  threshold: number,
): number {
  let count = 0;
  for (let i = daily.length - 1; i >= 0; i--) {
    if (daily[i].value > threshold) count++;
    else break;
  }
  return count;
}

// -------- T1.3 — ETF flows negative 6m AND SER -25% 6m -----------------------

export function evalT13(
  serHistory: Snapshot[],
  etfManual: ManualState,
  etfHistory?: Snapshot[],
): TriggerEval {
  const base = {
    trigger_name: "T1.3_etf_neg_and_ser_drop",
    tier: 1,
    description:
      "ETF cumulative net flows negative AND SER down >25% over the last 6 months.",
    threshold_value: -25,
  };
  const serPoints = clean(serHistory);
  const daily = bucketDailyLast(serPoints);
  const etfPoints = clean(etfHistory ?? []);
  const etfLatest =
    etfPoints.length > 0 ? etfPoints[etfPoints.length - 1].value : null;
  const etfAutoNeg = etfLatest !== null && etfLatest < 0;
  const etfManualNeg = etfManual?.is_triggered === true;
  const etfNeg = etfAutoNeg || etfManualNeg;
  const etfSource = etfAutoNeg ? "auto" : etfManualNeg ? "manual" : "none";

  if (daysCovered(serPoints) < 180) {
    return {
      ...base,
      status: "insufficient_data",
      message: `SER history ${daysCovered(serPoints)} / 180 days. ETF 6M: ${etfLatest !== null ? fmtEtf(etfLatest) : etfManualNeg ? "manual negative" : "awaiting data"}.`,
      current_value: null,
      metadata: { etf_manual: etfManualNeg, etf_flows_6m_usd: etfLatest, etf_source: etfSource },
    };
  }
  const recent = daily.slice(-180);
  const start = recent[0].value;
  const end = recent[recent.length - 1].value;
  const serDropPct = ((end - start) / start) * 100;
  const serDropMet = serDropPct <= -25;

  if (etfNeg && serDropMet) {
    return {
      ...base,
      status: "triggered",
      message: `ETF 6M ${etfAutoNeg ? fmtEtf(etfLatest!) : "manual negative"} + SER dropped ${serDropPct.toFixed(1)}%.`,
      current_value: serDropPct,
      metadata: { etf_source: etfSource, etf_flows_6m_usd: etfLatest, ser_drop_pct: serDropPct },
    };
  }
  if (etfNeg || serDropMet) {
    return {
      ...base,
      status: "partial",
      message: `Only one sub-condition met. ETF negative (${etfSource}): ${etfNeg}, SER drop: ${serDropPct.toFixed(1)}%.`,
      current_value: serDropPct,
      metadata: { etf_manual: etfManualNeg, etf_flows_6m_usd: etfLatest, etf_source: etfSource, ser_drop_pct: serDropPct },
    };
  }
  return {
    ...base,
    status: "ok",
    message: `Neither sub-condition met. ETF 6M: ${etfLatest !== null ? fmtEtf(etfLatest) : "n/a"}, SER change 6m: ${serDropPct.toFixed(1)}%.`,
    current_value: serDropPct,
    metadata: { etf_flows_6m_usd: etfLatest, etf_source: etfSource },
  };
}

function fmtEtf(usd: number) {
  const abs = Math.abs(usd);
  const sign = usd >= 0 ? "+" : "-";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(0)}M`;
  return `${sign}$${abs.toFixed(0)}`;
}

// -------- T1.4 — Staking ratio drop >25% from peak OR exit queue > 2x entry --

export function evalT14(
  stakingHistory: Snapshot[],
  exitQueueManual: ManualState,
  queueRatioHistory?: Snapshot[],
): TriggerEval {
  const base = {
    trigger_name: "T1.4_staking_drop_or_exit_queue",
    tier: 1,
    description:
      "Staking ratio down >25% from all-time peak, OR exit queue > 2x entry queue for 3 months.",
    threshold_value: -25,
  };
  const points = clean(stakingHistory);
  if (points.length === 0) {
    return {
      ...base,
      status: "insufficient_data",
      message: "No staking ratio snapshots yet.",
      current_value: null,
    };
  }
  const peak = Math.max(...points.map((p) => p.value));
  const current = points[points.length - 1].value;
  const dropPct = ((current - peak) / peak) * 100;
  const ratioCondition = dropPct <= -25;

  const queuePoints = clean(queueRatioHistory ?? []);
  const queueDaily = bucketDailyLast(queuePoints);
  const queueConsecutive =
    queueDaily.length > 0 ? countTailOver(queueDaily, 2) : 0;
  const queueAutoMet = queueConsecutive >= 90;
  const queueManualMet = exitQueueManual?.is_triggered === true;
  const queueCondition = queueAutoMet || queueManualMet;
  const latestQueueRatio =
    queueDaily.length > 0 ? queueDaily[queueDaily.length - 1].value : null;

  if (ratioCondition || queueCondition) {
    const queueNote = queueAutoMet
      ? `exit queue ${latestQueueRatio?.toFixed(2) ?? "—"}× for ${queueConsecutive}d`
      : queueManualMet
        ? "exit-queue manual flag set"
        : "";
    return {
      ...base,
      status: "triggered",
      message: `Triggered. Staking drop from peak: ${dropPct.toFixed(1)}%${queueNote ? ` · ${queueNote}` : ""}.`,
      current_value: dropPct,
      metadata: {
        peak,
        current,
        exit_queue_manual: queueManualMet,
        queue_ratio: latestQueueRatio,
        queue_consecutive_days: queueConsecutive,
        queue_source: queueAutoMet ? "auto" : queueManualMet ? "manual" : "none",
      },
    };
  }

  if (queueConsecutive > 0 && queueConsecutive < 90) {
    return {
      ...base,
      status: "warning",
      message: `Exit queue ${latestQueueRatio?.toFixed(2) ?? "—"}× > 2× for ${queueConsecutive} / 90 days. Staking drop: ${dropPct.toFixed(1)}%.`,
      current_value: dropPct,
      metadata: {
        peak,
        current,
        queue_ratio: latestQueueRatio,
        queue_consecutive_days: queueConsecutive,
      },
    };
  }

  return {
    ...base,
    status: "ok",
    message: `Staking ${current.toFixed(1)}% vs peak ${peak.toFixed(1)}% (drop ${dropPct.toFixed(1)}%). Exit/entry queue: ${latestQueueRatio !== null ? `${latestQueueRatio.toFixed(2)}×` : "awaiting API key"}.`,
    current_value: dropPct,
    metadata: { peak, current, queue_ratio: latestQueueRatio },
  };
}

// -------- T2.5 — TPS -40% over 12 months -------------------------------------

export function evalT25(history: Snapshot[]): TriggerEval {
  const base = {
    trigger_name: "T2.5_tps_drop_12m",
    tier: 2,
    description: "Aggregated TPS down >40% over 12 months (rolling).",
    threshold_value: -40,
  };
  const points = clean(history);
  if (daysCovered(points) < 365) {
    return {
      ...base,
      status: "insufficient_data",
      message: `Have ${daysCovered(points)} / 365 days of TPS history.`,
      current_value: null,
    };
  }
  const daily = bucketDailyLast(points);
  const oneYearAgo = daily[daily.length - 365];
  const latest = daily[daily.length - 1];
  const dropPct = ((latest.value - oneYearAgo.value) / oneYearAgo.value) * 100;
  if (dropPct <= -40) {
    return {
      ...base,
      status: "triggered",
      message: `TPS dropped ${dropPct.toFixed(1)}% vs 12 months ago.`,
      current_value: dropPct,
    };
  }
  return {
    ...base,
    status: "ok",
    message: `TPS change 12m: ${dropPct.toFixed(1)}% (> -40% threshold).`,
    current_value: dropPct,
  };
}

// -------- T2.6 — Stablecoin supply -30% over 12 months ------------------------

export function evalT26(history: Snapshot[]): TriggerEval {
  const base = {
    trigger_name: "T2.6_stables_drop_12m",
    tier: 2,
    description: "Stablecoin supply on Ethereum down >30% over 12 months.",
    threshold_value: -30,
  };
  const points = clean(history);
  if (daysCovered(points) < 365) {
    return {
      ...base,
      status: "insufficient_data",
      message: `Have ${daysCovered(points)} / 365 days of stablecoin history.`,
      current_value: null,
    };
  }
  const daily = bucketDailyLast(points);
  const oneYearAgo = daily[daily.length - 365];
  const latest = daily[daily.length - 1];
  const dropPct = ((latest.value - oneYearAgo.value) / oneYearAgo.value) * 100;
  if (dropPct <= -30) {
    return {
      ...base,
      status: "triggered",
      message: `Stables on Ethereum dropped ${dropPct.toFixed(1)}% vs 12 months ago.`,
      current_value: dropPct,
    };
  }
  return {
    ...base,
    status: "ok",
    message: `Stables change 12m: ${dropPct.toFixed(1)}% (> -30% threshold).`,
    current_value: dropPct,
  };
}

// -------- T2.7 — Blob count plateau/decline for 9 months ---------------------

export function evalT27(history: Snapshot[]): TriggerEval {
  const base = {
    trigger_name: "T2.7_blobs_plateau_9m",
    tier: 2,
    description: "Blob count per block in plateau or decline for 9 months.",
    threshold_value: 0,
  };
  const points = clean(history);
  if (daysCovered(points) < 270) {
    return {
      ...base,
      status: "insufficient_data",
      message: `Have ${daysCovered(points)} / 270 days of blob history.`,
      current_value: null,
    };
  }
  const daily = bucketDailyLast(points);
  const recent = daily.slice(-270);
  const first = recent[0].value;
  const last = recent[recent.length - 1].value;
  const changePct = ((last - first) / Math.max(first, 1)) * 100;
  // Plateau or decline = change <= 5% over the window
  if (changePct <= 5) {
    return {
      ...base,
      status: "triggered",
      message: `Blob count change over 9 months: ${changePct.toFixed(1)}% (plateau/decline).`,
      current_value: changePct,
    };
  }
  return {
    ...base,
    status: "ok",
    message: `Blob count growing: ${changePct.toFixed(1)}% over 9 months.`,
    current_value: changePct,
  };
}

// -------- T2.8 — RWA Ethereum share < 50% ------------------------------------

export function evalT28(history: Snapshot[]): TriggerEval {
  const base = {
    trigger_name: "T2.8_rwa_share_below_50",
    tier: 2,
    description: "Ethereum share of total RWA tokenized below 50%.",
    threshold_value: 50,
  };
  const points = clean(history);
  if (points.length === 0) {
    return {
      ...base,
      status: "insufficient_data",
      message: "No RWA share snapshots yet.",
      current_value: null,
    };
  }
  const current = points[points.length - 1].value;
  if (current < 50) {
    return {
      ...base,
      status: "triggered",
      message: `RWA share on Ethereum = ${current.toFixed(1)}% (< 50%).`,
      current_value: current,
    };
  }
  return {
    ...base,
    status: "ok",
    message: `RWA share on Ethereum = ${current.toFixed(1)}% (above 50% threshold).`,
    current_value: current,
  };
}

// -------- T3 manual triggers -------------------------------------------------

export function evalManual(
  trigger_name: string,
  tier: number,
  description: string,
  state: ManualState,
): TriggerEval {
  if (state?.is_triggered === true) {
    return {
      trigger_name,
      tier,
      description,
      status: "triggered",
      message: `Manually flagged${state.note ? `: ${state.note}` : ""} (toggled ${new Date(state.toggled_at).toISOString().slice(0, 10)}).`,
      current_value: 1,
      threshold_value: 1,
    };
  }
  return {
    trigger_name,
    tier,
    description,
    status: "needs_manual",
    message: state
      ? `Marked not triggered (last toggle ${new Date(state.toggled_at).toISOString().slice(0, 10)}).`
      : "Awaiting manual review (no toggle yet).",
    current_value: 0,
    threshold_value: 1,
  };
}

export const T3_DEFINITIONS: Array<{
  name: string;
  description: string;
}> = [
  {
    name: "T3.9_crypto_break",
    description:
      "Existential cryptographic failure on Ethereum (e.g. SNARK/BLS break).",
  },
  {
    name: "T3.10_regulation_existential",
    description: "Existential regulatory action (e.g. US/EU outright ban on staking).",
  },
  {
    name: "T3.11_protocol_capture",
    description:
      "Protocol capture (governance / client / validator concentration to a hostile actor).",
  },
];

export { DAY_MS };
