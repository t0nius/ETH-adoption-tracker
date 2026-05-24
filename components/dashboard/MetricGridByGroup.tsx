import { EmptyMetricCard, MetricBundle, MetricCard } from "@/components/MetricCard";
import { METRIC_DEFINITIONS } from "@/lib/metrics";
import { GROUP_ORDER, GROUP_THEME } from "@/lib/groups";
import type { Period } from "./MetricGridControls";

export function MetricGridByGroup({
  byName,
  period,
}: {
  byName: Map<string, MetricBundle>;
  period: Period;
}) {
  return (
    <section className="mt-6 space-y-8">
      {GROUP_ORDER.map((group) => {
        const groupMetrics = METRIC_DEFINITIONS.filter((m) => m.group === group);
        const theme = GROUP_THEME[group];
        return (
          <div key={group}>
            <div className="mb-3 flex items-end justify-between gap-3 border-b border-[color:var(--line)] pb-2">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[11px] font-semibold tracking-[0.14em] text-dim">
                  {theme.glyph}
                </span>
                <h2 className="font-mono text-base uppercase tracking-tight text-ink">
                  {theme.label}
                </h2>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-dim">
                  {theme.blurb}
                </p>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-dim">
                {groupMetrics.length} metrics
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {groupMetrics.map((m) => {
                const bundle = byName.get(m.name);
                return bundle ? (
                  <MetricCard key={m.name} bundle={bundle} selectedPeriod={period} />
                ) : (
                  <EmptyMetricCard key={m.name} metric_name={m.name} />
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}
