import { EmptyMetricCard, MetricBundle, MetricCard } from "@/components/MetricCard";
import { METRIC_DEFINITIONS, MetricName } from "@/lib/metrics";
import type { Period } from "./MetricGridControls";

function metricHealthBucket(
  b: MetricBundle,
): "stale" | "aged" | "weakening" | "stable" | "leading" {
  if (b.snapshot.status === "stale") return "stale";
  if (b.analytics.freshnessHours > 24) return "aged";
  const def = METRIC_DEFINITIONS.find((d) => d.name === (b.metric_name as MetricName));
  const d30 = b.analytics.delta30;
  if (d30 === null) return "stable";
  const preferred = def?.preferredTrend ?? "up";
  if (preferred === "up") {
    if (d30 < -5) return "weakening";
    if (d30 > 5) return "leading";
  } else if (preferred === "down") {
    if (d30 > 5) return "weakening";
    if (d30 < -5) return "leading";
  }
  return "stable";
}

export function MetricGridByStatus({
  bundles,
  period,
  missing,
}: {
  bundles: MetricBundle[];
  period: Period;
  missing: string[];
}) {
  const buckets: Record<string, MetricBundle[]> = {
    stale: [],
    aged: [],
    weakening: [],
    stable: [],
    leading: [],
  };
  for (const b of bundles) {
    buckets[metricHealthBucket(b)].push(b);
  }
  const ORDER: Array<{
    key: keyof typeof buckets;
    label: string;
    tone: string;
    blurb: string;
  }> = [
    { key: "stale", label: "STALE", tone: "var(--signal)", blurb: "fetch failure" },
    { key: "aged", label: "AGED", tone: "var(--ink-soft)", blurb: "snapshot > 24h" },
    {
      key: "weakening",
      label: "WEAKENING",
      tone: "var(--muted)",
      blurb: "30D against preferred trend",
    },
    {
      key: "leading",
      label: "LEADING",
      tone: "var(--ink-soft)",
      blurb: "30D in line with preferred trend",
    },
    { key: "stable", label: "STABLE", tone: "var(--muted)", blurb: "within ±5% over 30D" },
  ];

  return (
    <section className="mt-6 space-y-8">
      {ORDER.map(({ key, label, tone, blurb }) => {
        const cards = buckets[key];
        if (cards.length === 0) return null;
        return (
          <div key={key}>
            <div className="mb-3 flex items-end justify-between gap-3 border-b border-[color:var(--line)] pb-2">
              <div className="flex items-baseline gap-3">
                <span
                  className="h-2 w-2"
                  style={{ background: tone, display: "inline-block" }}
                  aria-hidden="true"
                />
                <h2 className="font-mono text-base uppercase tracking-tight text-ink">
                  {label}
                </h2>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-dim">
                  {blurb}
                </p>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-dim">
                {cards.length} metrics
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {cards.map((b) => (
                <MetricCard key={b.metric_name} bundle={b} selectedPeriod={period} />
              ))}
            </div>
          </div>
        );
      })}
      {missing.length > 0 ? (
        <div>
          <div className="mb-3 flex items-end justify-between gap-3 border-b border-[color:var(--line)] pb-2">
            <h2 className="font-mono text-base uppercase tracking-tight text-ink">AWAITING</h2>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-dim">
              {missing.length} metrics
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {missing.map((m) => (
              <EmptyMetricCard key={m} metric_name={m} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
