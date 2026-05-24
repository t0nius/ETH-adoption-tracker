"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { EmptyMetricCard, MetricBundle, MetricCard } from "@/components/MetricCard";
import { BootScreen } from "@/components/BootScreen";
import { StatusBar } from "@/components/StatusBar";
import { UrgencyBanner } from "@/components/UrgencyBanner";
import { TopMoves } from "@/components/TopMoves";
import { METRIC_DEFINITIONS, METRIC_ORDER } from "@/lib/metrics";
import { GROUP_ORDER, GROUP_THEME } from "@/lib/groups";

type Trigger = {
  trigger_name: string;
  tier: number;
  status: string;
  message: string;
};

type SourceHealth = {
  metric_name: string;
  staleRate7d: number;
  latestStatus: "ok" | "stale";
  freshnessHours: number;
  qualityScore: number;
};

type Period = 7 | 30 | 90 | 365;
type SortMode = "group" | "status";

function regimeLabel(score: number) {
  if (score >= 80) return "CONSTRUCTIVE";
  if (score >= 65) return "HEALTHY";
  if (score >= 50) return "MIXED";
  if (score >= 35) return "FRAGILE";
  return "HIGH RISK";
}

function periodLabel(p: Period) {
  if (p === 7) return "7D";
  if (p === 30) return "30D";
  if (p === 90) return "90D";
  return "1Y";
}

function HeroKpi({
  label,
  value,
  sub,
  tone = "ink",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "ink" | "signal";
}) {
  const color = tone === "signal" ? "var(--signal)" : "var(--ink)";
  return (
    <div className="surface px-4 py-3.5">
      <p className="text-eyebrow">{label}</p>
      <p
        className="mt-2 font-mono tabular text-[28px] font-medium leading-none"
        style={{ color }}
      >
        {value}
      </p>
      {sub ? (
        <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
          {sub}
        </p>
      ) : null}
    </div>
  );
}

export default function Page() {
  const [period, setPeriod] = useState<Period>(30);
  const [sortMode, setSortMode] = useState<SortMode>("group");

  const bundles = useQuery(api.snapshots.dashboardBundle, {}) as
    | MetricBundle[]
    | undefined;
  const sourceHealth = useQuery(api.snapshots.sourceHealth, {}) as
    | SourceHealth[]
    | undefined;
  const triggers = useQuery(api.triggers.listTriggers, {}) as Trigger[] | undefined;

  const computed = useMemo(() => {
    if (!bundles || !sourceHealth) return null;
    const byName = new Map(bundles.map((b) => [b.metric_name, b]));
    const okCount = bundles.filter((b) => b.snapshot.status === "ok").length;
    const staleCount = bundles.filter((b) => b.snapshot.status === "stale").length;
    const agedCount = bundles.filter(
      (b) => b.snapshot.status === "ok" && b.analytics.freshnessHours > 24,
    ).length;
    const missing = METRIC_ORDER.filter((n) => !byName.has(n));

    const triggerCounts = {
      triggered: triggers?.filter((t) => t.status === "triggered").length ?? 0,
      warning:
        triggers?.filter((t) => t.status === "warning" || t.status === "partial")
          .length ?? 0,
      noData:
        triggers?.filter(
          (t) => t.status === "insufficient_data" || t.status === "needs_manual",
        ).length ?? 0,
    };
    const triggeredList =
      triggers?.filter((t) => t.status === "triggered").map((t) => ({
        trigger_name: t.trigger_name,
        tier: t.tier,
        message: t.message,
      })) ?? [];

    const coverageRatio = okCount / METRIC_ORDER.length;
    const triggerPenalty =
      triggerCounts.triggered * 22 +
      triggerCounts.warning * 10 +
      triggerCounts.noData * 1.5;
    const regimeScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(coverageRatio * 100 - staleCount * 7 - agedCount * 2 - triggerPenalty),
      ),
    );
    const avgQuality =
      bundles.reduce((acc, b) => acc + b.analytics.qualityScore, 0) /
      Math.max(1, bundles.length);
    const fragile = [...sourceHealth]
      .filter((s) => s.qualityScore < 70)
      .sort((a, b) => a.qualityScore - b.qualityScore)
      .slice(0, 4);

    return {
      byName,
      okCount,
      staleCount,
      agedCount,
      missing,
      triggerCounts,
      triggeredList,
      regimeScore,
      avgQuality,
      fragile,
    };
  }, [bundles, sourceHealth, triggers]);

  if (bundles === undefined || sourceHealth === undefined || !computed) {
    return <BootScreen />;
  }

  return (
    <>
      <StatusBar
        live={computed.okCount}
        aged={computed.agedCount}
        stale={computed.staleCount}
        total={METRIC_ORDER.length}
        regimeScore={computed.regimeScore}
        regimeLabel={regimeLabel(computed.regimeScore)}
        triggered={computed.triggerCounts.triggered}
        warning={computed.triggerCounts.warning}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
        {(computed.triggerCounts.triggered > 0 || computed.triggerCounts.warning > 0) && (
          <div className="mb-5">
            <UrgencyBanner
              triggered={computed.triggeredList}
              warning={computed.triggerCounts.warning}
            />
          </div>
        )}

        {/* Hero block — terminal masthead */}
        <section className="surface">
          <div className="flex flex-col gap-6 px-5 py-7 sm:px-8 sm:py-9 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-eyebrow">LONG-ETH THESIS MONITOR</p>
              <h1 className="mt-4 font-display text-[44px] leading-[0.98] text-ink sm:text-[58px]">
                ETH ADOPTION
                <br />
                TRACKER
              </h1>
              <div className="rule mt-5 max-w-[200px]" />
              <p className="mt-5 max-w-xl text-sm leading-relaxed text-ink-soft">
                11 fundamentals · 11 invalidation triggers · daily evaluation.
                Designed to tell you{" "}
                <span className="text-ink">when to stop being long ETH</span>, not
                when to enter.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <Link href="/triggers" className="btn">
                  trigger radar →
                </Link>
                <a href="/api/export" download className="btn">
                  export json
                </a>
                <Link href="/methodology" className="btn">
                  methodology
                </Link>
              </div>
            </div>

            <div className="grid w-full grid-cols-2 gap-2 sm:max-w-md">
              <HeroKpi
                label="REGIME"
                value={String(computed.regimeScore).padStart(3, "0")}
                sub={regimeLabel(computed.regimeScore)}
              />
              <HeroKpi
                label="COVERAGE"
                value={`${computed.okCount}/${METRIC_ORDER.length}`}
                sub="live metrics"
              />
              <HeroKpi
                label="QUALITY"
                value={`${computed.avgQuality.toFixed(0)}`}
                sub="avg / 100"
              />
              <HeroKpi
                label="TRIGGERS"
                value={
                  computed.triggerCounts.triggered > 0
                    ? String(computed.triggerCounts.triggered).padStart(2, "0")
                    : computed.triggerCounts.warning > 0
                      ? String(computed.triggerCounts.warning).padStart(2, "0")
                      : "00"
                }
                sub={
                  computed.triggerCounts.triggered > 0
                    ? "tripped"
                    : computed.triggerCounts.warning > 0
                      ? "warning"
                      : "all clear"
                }
                tone={computed.triggerCounts.triggered > 0 ? "signal" : "ink"}
              />
            </div>
          </div>
        </section>

        {/* Top moves */}
        <TopMoves bundles={bundles} />

        {/* Source watchlist when degraded */}
        {computed.fragile.length > 0 ? (
          <section className="surface mt-4">
            <header className="flex items-center justify-between border-b border-[color:var(--line)] px-4 py-2">
              <p className="text-eyebrow">SOURCE WATCHLIST · QUALITY &lt; 70</p>
              <p className="font-mono text-[10px] text-dim">
                {computed.fragile.length} FRAGILE
              </p>
            </header>
            <table className="w-full font-mono text-xs">
              <thead>
                <tr className="border-b border-[color:var(--line-dim)] text-dim">
                  <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-[0.14em]">METRIC</th>
                  <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-[0.14em]">QUALITY</th>
                  <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-[0.14em]">STALE 7D</th>
                  <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-[0.14em]">FRESHNESS</th>
                </tr>
              </thead>
              <tbody>
                {computed.fragile.map((s) => (
                  <tr key={s.metric_name} className="border-b border-[color:var(--line-dim)] hover:bg-[color:var(--bg-2)]">
                    <td className="px-4 py-2 text-ink">{s.metric_name}</td>
                    <td className="px-4 py-2 text-right tabular text-ink-soft">
                      {s.qualityScore}/100
                    </td>
                    <td className="px-4 py-2 text-right tabular text-muted">
                      {s.staleRate7d}%
                    </td>
                    <td className="px-4 py-2 text-right tabular text-muted">
                      {s.freshnessHours.toFixed(1)}h
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {/* Controls */}
        <section className="surface mt-5 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="w-full font-mono text-[10px] text-dim sm:w-auto">
            Viewing <span className="text-ink-soft">{periodLabel(period)}</span> on all metric charts
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-eyebrow mr-1">WINDOW</span>
            {[7, 30, 90, 365].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p as Period)}
                className={`btn ${period === p ? "btn-active" : ""}`}
              >
                {periodLabel(p as Period)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-eyebrow mr-1">SORT</span>
            <button
              type="button"
              onClick={() => setSortMode("group")}
              className={`btn ${sortMode === "group" ? "btn-active" : ""}`}
            >
              by group
            </button>
            <button
              type="button"
              onClick={() => setSortMode("status")}
              className={`btn ${sortMode === "status" ? "btn-active" : ""}`}
            >
              by status
            </button>
          </div>
        </section>

        {/* Metric grid */}
        {sortMode === "group" ? (
          <section className="mt-6 space-y-8">
            {GROUP_ORDER.map((group) => {
              const groupMetrics = METRIC_DEFINITIONS.filter((m) => m.group === group);
              const theme = GROUP_THEME[group];
              return (
                <div key={group}>
                  <div className="mb-3 flex items-end justify-between gap-3 border-b border-[color:var(--line)] pb-2">
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-[11px] font-semibold tracking-[0.16em] text-dim">
                        {theme.glyph}
                      </span>
                      <h2 className="font-mono text-base tracking-tight text-ink uppercase">
                        {theme.label}
                      </h2>
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
                        {theme.blurb}
                      </p>
                    </div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
                      {groupMetrics.length} metrics
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {groupMetrics.map((m) => {
                      const bundle = computed.byName.get(m.name);
                      return bundle ? (
                        <MetricCard
                          key={m.name}
                          bundle={bundle}
                          selectedPeriod={period}
                        />
                      ) : (
                        <EmptyMetricCard key={m.name} metric_name={m.name} />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        ) : (
          <SortedByStatus
            bundles={bundles}
            period={period}
            missing={computed.missing}
          />
        )}
      </main>
    </>
  );
}

function metricHealthBucket(
  b: MetricBundle,
): "stale" | "aged" | "weakening" | "stable" | "leading" {
  if (b.snapshot.status === "stale") return "stale";
  if (b.analytics.freshnessHours > 24) return "aged";
  const def = METRIC_DEFINITIONS.find((d) => d.name === (b.metric_name as never));
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

function SortedByStatus({
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
    { key: "weakening", label: "WEAKENING", tone: "var(--muted)", blurb: "30D against preferred trend" },
    { key: "leading", label: "LEADING", tone: "var(--ink-soft)", blurb: "30D in line with preferred trend" },
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
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
                  {blurb}
                </p>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
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
            <h2 className="font-mono text-base uppercase tracking-tight text-ink">
              AWAITING
            </h2>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
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
