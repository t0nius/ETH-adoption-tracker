import { METRIC_ORDER } from "./metrics";
import { ADOPTION_METRIC_NAMES } from "./regime";
import { T3_DEFINITIONS } from "./triggers";

/** Metrics shown on the dashboard board (excludes hidden `eth_total_supply`). */
export const BOARD_METRIC_COUNT = METRIC_ORDER.length;

/** Fundamentals in the thesis score (board minus ETH/BTC). */
export const ADOPTION_FUNDAMENTAL_COUNT = ADOPTION_METRIC_NAMES.length;

/** Auto-evaluated T1/T2 rules plus Tier-3 manual flags. */
export const AUTO_TRIGGER_COUNT = 8;
export const INVALIDATION_TRIGGER_COUNT = AUTO_TRIGGER_COUNT + T3_DEFINITIONS.length;

export const PRODUCT_SUBTITLE = `${BOARD_METRIC_COUNT} fundamentals · ${INVALIDATION_TRIGGER_COUNT} invalidation triggers · hourly snapshots · daily trigger evaluation.`;
