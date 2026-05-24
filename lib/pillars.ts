import {
  METRIC_BY_NAME,
  METRIC_DEFINITIONS,
  type MetricName,
  describeTrend,
  type MetricGroup,
} from "./metrics";
import { GROUP_ORDER, GROUP_THEME } from "./groups";

export type PillarMetricBundle = {
  metric_name: string;
  snapshot: { status: "ok" | "stale"; formatted: string };
  analytics: {
    qualityScore: number;
    delta30: number | null;
    freshnessHours: number;
  };
};

export type PillarSummary = {
  group: MetricGroup;
  glyph: string;
  label: string;
  blurb: string;
  metricCount: number;
  liveCount: number;
  avgQuality: number;
  watchCount: number;
  headlineMetric: string | null;
  headlineText: string;
};

export function computePillarSummaries(
  bundles: PillarMetricBundle[],
): PillarSummary[] {
  const byGroup = new Map<MetricGroup, PillarMetricBundle[]>();
  for (const def of METRIC_DEFINITIONS) {
    if (!byGroup.has(def.group)) byGroup.set(def.group, []);
  }
  for (const b of bundles) {
    const def = METRIC_BY_NAME[b.metric_name as MetricName];
    if (!def) continue;
    byGroup.get(def.group)?.push(b);
  }

  return GROUP_ORDER.map((group) => {
    const theme = GROUP_THEME[group];
    const items = byGroup.get(group) ?? [];
    const live = items.filter((i) => i.snapshot.status === "ok");
    const avgQuality =
      live.length > 0
        ? live.reduce((a, i) => a + i.analytics.qualityScore, 0) / live.length
        : 0;

    let watchCount = 0;
    let worst: { name: string; delta: number } | null = null;
    for (const item of live) {
      const def = METRIC_BY_NAME[item.metric_name as MetricName];
      if (!def) continue;
      const trend = describeTrend(def, item.analytics.delta30);
      if (trend.tone === "watch") watchCount += 1;
      if (item.analytics.delta30 !== null) {
        if (
          !worst ||
          (def.preferredTrend === "up"
            ? item.analytics.delta30 < worst.delta
            : item.analytics.delta30 > worst.delta)
        ) {
          worst = { name: item.metric_name, delta: item.analytics.delta30 };
        }
      }
    }

    let headlineMetric: string | null = null;
    let headlineText = "No live metrics in this pillar.";
    if (worst) {
      headlineMetric = worst.name;
      const def = METRIC_BY_NAME[worst.name as MetricName];
      headlineText = def
        ? describeTrend(def, worst.delta).text
        : `${worst.name} Δ30 ${worst.delta.toFixed(1)}%`;
    } else if (live.length > 0) {
      headlineMetric = live[0].metric_name;
      headlineText = "Stable across 30-day window.";
    }

    return {
      group,
      glyph: theme.glyph,
      label: theme.label,
      blurb: theme.blurb,
      metricCount: items.length,
      liveCount: live.length,
      avgQuality,
      watchCount,
      headlineMetric,
      headlineText,
    };
  });
}
