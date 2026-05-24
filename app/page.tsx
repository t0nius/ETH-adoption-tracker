"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BootScreen } from "@/components/BootScreen";
import { StatusBar } from "@/components/StatusBar";
import { UrgencyBanner } from "@/components/UrgencyBanner";
import { TopMoves } from "@/components/TopMoves";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { SourceWatchlist } from "@/components/dashboard/SourceWatchlist";
import { VerdictStrip } from "@/components/dashboard/VerdictStrip";
import { AppFooter } from "@/components/AppFooter";
import {
  MetricGridControls,
  GRID_MODE_STORAGE_KEY,
  type GridMode,
  type Period,
  type SortMode,
} from "@/components/dashboard/MetricGridControls";
import { MetricGridByGroup } from "@/components/dashboard/MetricGridByGroup";
import { MetricGridByStatus } from "@/components/dashboard/MetricGridByStatus";
import { MonetaryHealth } from "@/components/dashboard/MonetaryHealth";
import { PillarSummaryGrid } from "@/components/dashboard/PillarSummaryGrid";
import { METRIC_ORDER } from "@/lib/metrics";
import { computePillarSummaries } from "@/lib/pillars";

export default function Page() {
  const [period, setPeriod] = useState<Period>(30);
  const [sortMode, setSortMode] = useState<SortMode>("group");
  const [gridMode, setGridMode] = useState<GridMode>("compact");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(GRID_MODE_STORAGE_KEY);
      if (stored === "compact" || stored === "detailed") setGridMode(stored);
    } catch {
      /* ignore */
    }
  }, []);

  function handleGridMode(m: GridMode) {
    setGridMode(m);
    try {
      localStorage.setItem(GRID_MODE_STORAGE_KEY, m);
    } catch {
      /* ignore */
    }
  }

  const overview = useQuery(api.snapshots.dashboardOverview, {});

  const derived = useMemo(() => {
    if (!overview) return null;
    const byName = new Map(overview.bundles.map((b) => [b.metric_name, b]));
    const okCount = overview.bundles.filter((b) => b.snapshot.status === "ok").length;
    const staleCount = overview.bundles.filter((b) => b.snapshot.status === "stale").length;
    const agedCount = overview.bundles.filter(
      (b) => b.snapshot.status === "ok" && b.analytics.freshnessHours > 24,
    ).length;
    const triggeredList = overview.triggers
      .filter((t) => t.status === "triggered")
      .map((t) => ({
        trigger_name: t.trigger_name,
        tier: t.tier,
        message: t.message,
        description: t.description,
      }));
    const triggerCounts = {
      triggered: triggeredList.length,
      warning: overview.triggers.filter(
        (t) => t.status === "warning" || t.status === "partial",
      ).length,
    };
    const missing = METRIC_ORDER.filter((n) => !byName.has(n));
    const pillars = computePillarSummaries(overview.bundles);
    const lastEvaluatedAt = Math.max(
      0,
      ...overview.triggers.map((t) => t.evaluated_at),
    );
    return {
      byName,
      okCount,
      staleCount,
      agedCount,
      triggeredList,
      triggerCounts,
      missing,
      pillars,
      lastEvaluatedAt: lastEvaluatedAt || undefined,
    };
  }, [overview]);

  if (!overview || !derived) {
    return <BootScreen />;
  }

  return (
    <>
      <StatusBar
        live={derived.okCount}
        aged={derived.agedCount}
        stale={derived.staleCount}
        total={METRIC_ORDER.length}
        fundamentalScore={overview.scores.fundamental.score}
        fundamentalLabel={overview.scores.fundamental.label}
        dataHealthScore={overview.scores.dataHealth.score}
        dataHealthLabel={overview.scores.dataHealth.label}
        triggered={derived.triggerCounts.triggered}
        warning={derived.triggerCounts.warning}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
        <VerdictStrip
          triggers={overview.triggers}
          fundamentalScore={overview.scores.fundamental.score}
          fundamentalLabel={overview.scores.fundamental.label}
          dataHealthScore={overview.scores.dataHealth.score}
          dataHealthLabel={overview.scores.dataHealth.label}
          lastEvaluatedAt={derived.lastEvaluatedAt}
        />

        {(derived.triggerCounts.triggered > 0 || derived.triggerCounts.warning > 0) && (
          <div className="section-gap">
            <UrgencyBanner
              triggered={derived.triggeredList}
              warning={derived.triggerCounts.warning}
            />
          </div>
        )}

        <div className="section-gap">
          <DashboardHero
            fundamental={overview.scores.fundamental}
            dataHealth={overview.scores.dataHealth}
            triggeredCount={derived.triggerCounts.triggered}
            warningCount={derived.triggerCounts.warning}
          />
        </div>

        <PillarSummaryGrid pillars={derived.pillars} />

        <MonetaryHealth byName={derived.byName} />

        <TopMoves bundles={overview.bundles} />

        <SourceWatchlist fragile={overview.fragile} />

        <MetricGridControls
          period={period}
          sortMode={sortMode}
          gridMode={gridMode}
          onPeriod={setPeriod}
          onSort={setSortMode}
          onGridMode={handleGridMode}
        />

        {sortMode === "group" ? (
          <MetricGridByGroup
            byName={derived.byName}
            period={period}
            gridMode={gridMode}
            pillars={derived.pillars}
          />
        ) : (
          <MetricGridByStatus
            bundles={overview.bundles}
            period={period}
            missing={derived.missing}
            gridMode={gridMode}
          />
        )}
      </main>

      <AppFooter lastEvaluatedAt={derived.lastEvaluatedAt} />
    </>
  );
}
