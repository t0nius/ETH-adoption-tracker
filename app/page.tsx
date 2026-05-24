"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BootScreen } from "@/components/BootScreen";
import { StatusBar } from "@/components/StatusBar";
import { UrgencyBanner } from "@/components/UrgencyBanner";
import { TopMoves } from "@/components/TopMoves";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { SourceWatchlist } from "@/components/dashboard/SourceWatchlist";
import {
  MetricGridControls,
  type Period,
  type SortMode,
} from "@/components/dashboard/MetricGridControls";
import { MetricGridByGroup } from "@/components/dashboard/MetricGridByGroup";
import { MetricGridByStatus } from "@/components/dashboard/MetricGridByStatus";
import { METRIC_ORDER } from "@/lib/metrics";

export default function Page() {
  const [period, setPeriod] = useState<Period>(30);
  const [sortMode, setSortMode] = useState<SortMode>("group");

  const overview = useQuery(api.snapshots.dashboardOverview, {});

  const derived = useMemo(() => {
    if (!overview) return null;
    const byName = new Map(overview.bundles.map((b) => [b.metric_name, b]));
    const okCount = overview.bundles.filter((b) => b.snapshot.status === "ok").length;
    const staleCount = overview.bundles.filter((b) => b.snapshot.status === "stale").length;
    const agedCount = overview.bundles.filter(
      (b) => b.snapshot.status === "ok" && b.analytics.freshnessHours > 24,
    ).length;
    const avgQuality =
      overview.bundles.reduce((acc, b) => acc + b.analytics.qualityScore, 0) /
      Math.max(1, overview.bundles.length);
    const triggeredList = overview.triggers
      .filter((t) => t.status === "triggered")
      .map((t) => ({
        trigger_name: t.trigger_name,
        tier: t.tier,
        message: t.message,
      }));
    const triggerCounts = {
      triggered: triggeredList.length,
      warning: overview.triggers.filter(
        (t) => t.status === "warning" || t.status === "partial",
      ).length,
    };
    const missing = METRIC_ORDER.filter((n) => !byName.has(n));
    return {
      byName,
      okCount,
      staleCount,
      agedCount,
      avgQuality,
      triggeredList,
      triggerCounts,
      missing,
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
        regimeScore={overview.regime.score}
        regimeLabel={overview.regime.label}
        triggered={derived.triggerCounts.triggered}
        warning={derived.triggerCounts.warning}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
        {(derived.triggerCounts.triggered > 0 || derived.triggerCounts.warning > 0) && (
          <div className="mb-5">
            <UrgencyBanner
              triggered={derived.triggeredList}
              warning={derived.triggerCounts.warning}
            />
          </div>
        )}

        <DashboardHero
          regimeScore={overview.regime.score}
          regimeLabel={overview.regime.label}
          okCount={derived.okCount}
          totalMetrics={METRIC_ORDER.length}
          avgQuality={derived.avgQuality}
          triggeredCount={derived.triggerCounts.triggered}
          warningCount={derived.triggerCounts.warning}
        />

        <TopMoves bundles={overview.bundles} />

        <SourceWatchlist fragile={overview.fragile} />

        <MetricGridControls
          period={period}
          sortMode={sortMode}
          onPeriod={setPeriod}
          onSort={setSortMode}
        />

        {sortMode === "group" ? (
          <MetricGridByGroup byName={derived.byName} period={period} />
        ) : (
          <MetricGridByStatus
            bundles={overview.bundles}
            period={period}
            missing={derived.missing}
          />
        )}
      </main>
    </>
  );
}
