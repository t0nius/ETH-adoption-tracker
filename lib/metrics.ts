export type MetricName =
  | "tps_l1_l2"
  | "stables_supply_eth"
  | "burn_24h"
  | "staking_ratio"
  | "l2_tvl"
  | "eth_btc"
  | "daa_l1_l2"
  | "rwa_eth_share"
  | "blob_count_latest"
  | "ser_total_eth"
  | "eth_defi_share";

export type MetricGroup =
  | "Usage"
  | "Monetary"
  | "Institutional"
  | "Infrastructure";

export type ThresholdDirection = "below" | "above";

export type MetricDefinition = {
  name: MetricName;
  label: string;
  group: MetricGroup;
  detailTitle: string;
  whyItMatters: string;
  interpretationHint: string;
  threshold?: {
    label: string;
    value: number;
    direction: ThresholdDirection;
  };
  preferredTrend: "up" | "down" | "stable";
};

export type HistoryPoint = {
  timestamp: number;
  value: number | null;
  status: "ok" | "stale";
};

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  {
    name: "tps_l1_l2",
    label: "TPS (L1 + L2 aggregated)",
    group: "Usage",
    detailTitle: "Transaction throughput",
    whyItMatters: "Sustained throughput growth confirms real user demand.",
    interpretationHint: "Falling throughput over long windows can flag adoption slowdown.",
    preferredTrend: "up",
  },
  {
    name: "daa_l1_l2",
    label: "Daily active addresses (L1 + L2)",
    group: "Usage",
    detailTitle: "Active user footprint",
    whyItMatters: "Address activity is a proxy for network reach and utility.",
    interpretationHint: "A stable or rising base supports long-term ecosystem resilience.",
    preferredTrend: "up",
  },
  {
    name: "l2_tvl",
    label: "L2 TVL (aggregated)",
    group: "Usage",
    detailTitle: "Capital committed to L2s",
    whyItMatters: "TVL concentration on Ethereum L2s indicates economic depth.",
    interpretationHint: "Large drawdowns can precede weaker on-chain engagement.",
    preferredTrend: "up",
  },
  {
    name: "stables_supply_eth",
    label: "Stablecoin supply (Ethereum L1)",
    group: "Monetary",
    detailTitle: "Settlement liquidity on Ethereum",
    whyItMatters: "Stablecoin supply supports payments, trading, and DeFi usage.",
    interpretationHint: "Trigger T2.6 watches a strong 12-month contraction.",
    preferredTrend: "up",
  },
  {
    name: "burn_24h",
    label: "ETH burned (last 24h)",
    group: "Monetary",
    detailTitle: "Fee burn intensity",
    whyItMatters: "Burn reflects network demand and offsets issuance.",
    interpretationHint: "Persistent burn weakness can weaken ETH monetary premium.",
    preferredTrend: "up",
  },
  {
    name: "staking_ratio",
    label: "Staking ratio",
    group: "Monetary",
    detailTitle: "Share of ETH staked",
    whyItMatters: "Higher staking participation usually strengthens security alignment.",
    interpretationHint: "Trigger T1.4 monitors major degradation from cycle highs.",
    preferredTrend: "up",
  },
  {
    name: "eth_btc",
    label: "ETH/BTC ratio",
    group: "Monetary",
    detailTitle: "Relative market strength vs BTC",
    whyItMatters: "This ratio captures relative demand for ETH risk and utility.",
    interpretationHint: "Strong downtrends suggest weaker ETH leadership.",
    preferredTrend: "up",
  },
  {
    name: "rwa_eth_share",
    label: "RWA share on Ethereum",
    group: "Institutional",
    detailTitle: "Ethereum share of tokenized RWA value",
    whyItMatters: "Institutional tokenization share shows platform preference.",
    interpretationHint: "Trigger T2.8 alerts when Ethereum RWA share drops below 50%.",
    threshold: {
      label: "Trigger T2.8 level",
      value: 50,
      direction: "below",
    },
    preferredTrend: "up",
  },
  {
    name: "ser_total_eth",
    label: "Strategic ETH Reserve (total)",
    group: "Institutional",
    detailTitle: "ETH held by strategic reserve entities",
    whyItMatters: "Institutional and treasury accumulation can reinforce conviction.",
    interpretationHint: "Large multi-month drawdowns can indicate weakening sponsorship.",
    preferredTrend: "up",
  },
  {
    name: "eth_defi_share",
    label: "ETH ecosystem share of DeFi TVL",
    group: "Institutional",
    detailTitle: "Ethereum + L2 share of global DeFi",
    whyItMatters: "Share retention reflects ecosystem competitiveness.",
    interpretationHint: "Trigger T1.1 alerts on a prolonged collapse below 40%.",
    threshold: {
      label: "Trigger T1.1 level",
      value: 40,
      direction: "below",
    },
    preferredTrend: "up",
  },
  {
    name: "blob_count_latest",
    label: "Blobs in latest block",
    group: "Infrastructure",
    detailTitle: "Blobspace utilization",
    whyItMatters: "Blob demand reflects rollup throughput pressure.",
    interpretationHint: "Trigger T2.7 watches for long-run stagnation or decline.",
    preferredTrend: "up",
  },
];

export const METRIC_ORDER: MetricName[] = METRIC_DEFINITIONS.map((m) => m.name);

export const METRIC_BY_NAME: Record<MetricName, MetricDefinition> =
  METRIC_DEFINITIONS.reduce(
    (acc, m) => {
      acc[m.name] = m;
      return acc;
    },
    {} as Record<MetricName, MetricDefinition>,
  );

function nearestValue(points: Array<{ timestamp: number; value: number }>, days: number) {
  const target = Date.now() - days * 24 * 60 * 60 * 1000;
  let best: { timestamp: number; value: number } | null = null;
  for (const p of points) {
    if (p.timestamp <= target) {
      if (!best || p.timestamp > best.timestamp) best = p;
    }
  }
  return best;
}

export function formatCompact(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(2)}k`;
  if (abs >= 10) return value.toFixed(2);
  return value.toFixed(4);
}

export function metricDelta(
  history: HistoryPoint[],
  days: 7 | 30 | 90 | 365,
): number | null {
  const points = history
    .filter((p): p is { timestamp: number; value: number; status: "ok" | "stale" } => p.value !== null)
    .sort((a, b) => a.timestamp - b.timestamp);
  if (points.length < 2) return null;
  const latest = points[points.length - 1];
  const base = nearestValue(points, days);
  if (!base || base.value === 0) return null;
  return ((latest.value - base.value) / Math.abs(base.value)) * 100;
}

export function metricAverage(history: HistoryPoint[], days: 30 | 90) {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const values = history
    .filter((p): p is { timestamp: number; value: number; status: "ok" | "stale" } => p.value !== null)
    .filter((p) => p.timestamp >= since)
    .map((p) => p.value);
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
}

export function describeThreshold(def: MetricDefinition, value: number | null) {
  if (!def.threshold || value === null) return null;
  const gap = value - def.threshold.value;
  if (def.threshold.direction === "below") {
    return {
      breached: value < def.threshold.value,
      text:
        value < def.threshold.value
          ? `${def.threshold.label}: breached by ${Math.abs(gap).toFixed(2)}`
          : `${def.threshold.label}: buffer +${gap.toFixed(2)}`,
    };
  }
  return {
    breached: value > def.threshold.value,
    text:
      value > def.threshold.value
        ? `${def.threshold.label}: breached by +${gap.toFixed(2)}`
        : `${def.threshold.label}: buffer ${Math.abs(gap).toFixed(2)}`,
  };
}

export function describeTrend(
  def: MetricDefinition,
  delta30: number | null,
): { tone: "good" | "watch" | "neutral"; text: string } {
  if (delta30 === null) {
    return { tone: "neutral", text: "Need more history to infer trend." };
  }
  const abs = Math.abs(delta30);
  if (abs < 2) {
    return { tone: "neutral", text: "Sideways regime over 30 days." };
  }

  if (def.preferredTrend === "up") {
    if (delta30 > 0) {
      return { tone: "good", text: `Up ${delta30.toFixed(1)}% over 30 days.` };
    }
    return { tone: "watch", text: `Down ${Math.abs(delta30).toFixed(1)}% over 30 days.` };
  }

  if (def.preferredTrend === "down") {
    if (delta30 < 0) {
      return { tone: "good", text: `Cooling ${Math.abs(delta30).toFixed(1)}% over 30 days.` };
    }
    return { tone: "watch", text: `Rising ${delta30.toFixed(1)}% over 30 days.` };
  }

  if (abs > 8) {
    return { tone: "watch", text: `High volatility: ${delta30.toFixed(1)}% in 30 days.` };
  }
  return { tone: "neutral", text: `Moderate move: ${delta30.toFixed(1)}% in 30 days.` };
}
