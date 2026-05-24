"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyMetricCard, MetricBundle, MetricCard } from "@/components/MetricCard";
import { METRIC_DEFINITIONS, type MetricGroup } from "@/lib/metrics";
import { GROUP_ORDER, GROUP_THEME } from "@/lib/groups";
import type { GridMode, Period } from "./MetricGridControls";
import type { PillarSummary } from "@/lib/pillars";

const COLLAPSE_STORAGE_KEY = "eth-tracker-pillar-collapse";

function defaultOpenForGroup(group: MetricGroup, pillars: PillarSummary[]): boolean {
  const p = pillars.find((x) => x.group === group);
  if (!p) return true;
  return p.watchCount > 0 || p.avgQuality < 70;
}

export function MetricGridByGroup({
  byName,
  period,
  gridMode,
  pillars,
}: {
  byName: Map<string, MetricBundle>;
  period: Period;
  gridMode: GridMode;
  pillars: PillarSummary[];
}) {
  const initial = useMemo(() => {
    const next: Record<string, boolean> = {};
    for (const g of GROUP_ORDER) {
      next[g] = defaultOpenForGroup(g, pillars);
    }
    return next;
  }, [pillars]);

  const [open, setOpen] = useState<Record<string, boolean>>(initial);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLLAPSE_STORAGE_KEY);
      if (raw) setOpen({ ...initial, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, [initial]);

  function toggle(group: string) {
    setOpen((prev) => {
      const next = { ...prev, [group]: !prev[group] };
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <section className="mt-6 space-y-6">
      {GROUP_ORDER.map((group) => {
        const groupMetrics = METRIC_DEFINITIONS.filter((m) => m.group === group);
        const theme = GROUP_THEME[group];
        const isOpen = open[group] ?? true;
        const summary = pillars.find((p) => p.group === group);

        return (
          <div key={group} id={`pillar-${group.toLowerCase()}`} className="scroll-mt-24">
            <button
              type="button"
              onClick={() => toggle(group)}
              className="mb-3 flex w-full items-end justify-between gap-3 border-b border-[color:var(--line)] pb-2 text-left hover:opacity-90"
            >
              <div className="flex flex-wrap items-baseline gap-2 sm:gap-3">
                <span className="font-mono text-[11px] font-semibold tracking-[0.14em] text-dim">
                  {isOpen ? "▼" : "▶"} {theme.glyph}
                </span>
                <h2 className="font-mono text-sm uppercase tracking-tight text-ink sm:text-base">
                  {theme.label}
                </h2>
                <p className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-dim sm:inline">
                  {theme.blurb}
                </p>
                {summary && summary.watchCount > 0 ? (
                  <span className="font-mono text-[10px] text-watch">{summary.watchCount} watch</span>
                ) : null}
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-dim">
                {groupMetrics.length} metrics
              </p>
            </button>
            {isOpen ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {groupMetrics.map((m) => {
                  const bundle = byName.get(m.name);
                  return bundle ? (
                    <MetricCard
                      key={m.name}
                      bundle={bundle}
                      selectedPeriod={period}
                      gridMode={gridMode}
                    />
                  ) : (
                    <EmptyMetricCard key={m.name} metric_name={m.name} />
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
