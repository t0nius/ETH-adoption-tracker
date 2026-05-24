/** How each invalidation rule is fed — shown on trigger cards. */

export type TriggerEvalMode = "auto" | "partial" | "manual" | "blocked";

export type TriggerEvalMeta = {
  mode: TriggerEvalMode;
  hint?: string;
};

export const TRIGGER_EVAL_META: Record<string, TriggerEvalMeta> = {
  "T1.1_eth_defi_share_drop": { mode: "auto" },
  "T1.2_supply_inflationary": {
    mode: "auto",
    hint: "ETH total supply from ultrasound.money (daily snapshots)",
  },
  "T1.3_etf_neg_and_ser_drop": {
    mode: "partial",
    hint: "SER auto · ETF 6M from CoinGlass API or manual weekly USD input",
  },
  "T1.4_staking_drop_or_exit_queue": {
    mode: "partial",
    hint: "Staking ratio auto · exit/entry queue from beaconcha.in API (free key)",
  },
  "T2.5_tps_drop_12m": { mode: "auto" },
  "T2.6_stables_drop_12m": { mode: "auto" },
  "T2.7_blobs_plateau_9m": { mode: "auto" },
  "T2.8_rwa_share_below_50": { mode: "auto" },
  "T3.9_crypto_break": { mode: "manual", hint: "Tier-3 — discretionary override" },
  "T3.10_regulation_existential": {
    mode: "manual",
    hint: "Tier-3 — discretionary override",
  },
  "T3.11_protocol_capture": { mode: "manual", hint: "Tier-3 — discretionary override" },
};

export function getTriggerEvalMeta(triggerName: string): TriggerEvalMeta {
  return TRIGGER_EVAL_META[triggerName] ?? { mode: "auto" };
}

export const EVAL_MODE_LABEL: Record<TriggerEvalMode, string> = {
  auto: "AUTO",
  partial: "PARTIAL",
  manual: "MANUAL",
  blocked: "BLOCKED",
};
