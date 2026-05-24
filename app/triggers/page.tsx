"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { TriggerCard } from "@/components/TriggerCard";
import { StatusBar } from "@/components/StatusBar";
import { dataHealthLabel, fundamentalLabel } from "@/lib/regime";
import { METRIC_ORDER } from "@/lib/metrics";
import { ManualDataBanner } from "@/components/ManualDataBanner";
import { ManualEtfInput } from "@/components/ManualEtfInput";
import { WeeklyManualChecklist } from "@/components/WeeklyManualChecklist";
import { sortTriggersByGravity } from "@/lib/triggerSort";
import { INVALIDATION_TRIGGER_COUNT } from "@/lib/product";

type Trigger = {
  trigger_name: string;
  tier: number;
  status: string;
  description: string;
  message: string;
  current_value: number | null;
  threshold_value: number | null;
  evaluated_at: number;
  metadata?: unknown;
};

type TriggerChange = {
  trigger_name: string;
  tier: number;
  previous_status: string;
  current_status: string;
  previous_message: string;
  current_message: string;
  previous_evaluated_at: number;
  current_evaluated_at: number;
};

type ManualAudit = {
  trigger_name: string;
  is_triggered: boolean;
  note?: string;
  actor?: string;
  toggled_at: number;
};

type TierTab = 1 | 2 | 3;

const STATUS_TONE: Record<string, string> = {
  triggered: "var(--signal)",
  error: "var(--signal)",
  warning: "var(--watch)",
  partial: "var(--watch)",
  insufficient_data: "var(--muted)",
  needs_manual: "var(--muted)",
  ok: "var(--muted)",
};

const TIER_SUB: Record<TierTab, string> = {
  1: "1 trigger → full exit",
  2: "2 simultaneous → full exit",
  3: "manual · binary",
};

function HeroKpi({
  label,
  value,
  tone = "ink",
}: {
  label: string;
  value: number | string;
  tone?: "ink" | "soft" | "signal";
}) {
  const color =
    tone === "signal"
      ? "var(--signal)"
      : tone === "soft"
        ? "var(--watch)"
        : "var(--ink)";
  return (
    <div className="surface px-3 py-2.5">
      <p className="text-eyebrow">{label}</p>
      <p
        className="mt-1.5 font-mono tabular text-[22px] font-medium leading-none"
        style={{ color }}
      >
        {value}
      </p>
    </div>
  );
}

export default function TriggersPage() {
  const [adminToken, setAdminToken] = useState("");
  const [actorName, setActorName] = useState("");
  const [tierTab, setTierTab] = useState<TierTab>(1);
  const [adminOpen, setAdminOpen] = useState(false);

  useEffect(() => {
    setAdminToken(window.localStorage.getItem("manual_admin_token") ?? "");
    setActorName(window.localStorage.getItem("manual_actor_name") ?? "");
  }, []);
  useEffect(() => {
    window.localStorage.setItem("manual_admin_token", adminToken);
  }, [adminToken]);
  useEffect(() => {
    window.localStorage.setItem("manual_actor_name", actorName);
  }, [actorName]);

  const triggers = useQuery(api.triggers.listTriggers, {}) as Trigger[] | undefined;
  const changes = useQuery(api.triggers.latestChanges, {}) as TriggerChange[] | undefined;
  const manualAudit = useQuery(api.triggers.recentManualActions, {}) as ManualAudit[] | undefined;
  const overview = useQuery(api.snapshots.dashboardOverview, {});

  const stats = useMemo(() => {
    if (!triggers) return null;
    return {
      triggered: triggers.filter((t) => t.status === "triggered").length,
      warning: triggers.filter((t) => t.status === "warning" || t.status === "partial").length,
      noData: triggers.filter((t) => t.status === "insufficient_data" || t.status === "needs_manual").length,
      ok: triggers.filter((t) => t.status === "ok").length,
    };
  }, [triggers]);

  const tierCounts = useMemo(() => {
    if (!triggers) return { 1: 0, 2: 0, 3: 0 };
    return {
      1: triggers.filter((t) => t.tier === 1).length,
      2: triggers.filter((t) => t.tier === 2).length,
      3: triggers.filter((t) => t.tier === 3).length,
    };
  }, [triggers]);

  const tierCards = useMemo(() => {
    if (!triggers) return [];
    return sortTriggersByGravity(triggers.filter((t) => t.tier === tierTab));
  }, [triggers, tierTab]);

  if (triggers === undefined) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-8">
        <p className="text-eyebrow">› LOADING</p>
        <div className="mt-4 skeleton h-10 w-64 rounded-none" />
        <div className="mt-3 skeleton h-4 w-full max-w-md rounded-none" />
      </main>
    );
  }

  if (triggers.length === 0) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-8">
        <h1 className="font-display text-3xl text-ink">TRIGGERS</h1>
        <p className="mt-4 font-mono text-xs text-muted">
          no evaluations yet. run{" "}
          <code className="border border-[color:var(--line)] bg-[color:var(--bg-2)] px-2 py-1">
            npx convex run triggers:evaluateAll &apos;{}&apos;
          </code>{" "}
          to seed.
        </p>
      </main>
    );
  }

  const bundles = overview?.bundles ?? [];
  const live = bundles.filter((b) => b.snapshot.status === "ok").length;
  const stale = bundles.filter((b) => b.snapshot.status === "stale").length;
  const aged = bundles.filter(
    (b) => b.snapshot.status === "ok" && b.analytics.freshnessHours > 24,
  ).length;
  const total = METRIC_ORDER.length;
  const fundamentalScore = overview?.scores.fundamental.score ?? 0;
  const dataHealthScore = overview?.scores.dataHealth.score ?? 0;
  const etfStale =
    bundles.find((b) => b.metric_name === "etf_flows_6m_usd")?.snapshot.status !== "ok";
  const queueStale =
    bundles.find((b) => b.metric_name === "validator_queue_ratio")?.snapshot.status !== "ok";

  return (
    <>
      <StatusBar
        live={live}
        aged={aged}
        stale={stale}
        total={total}
        fundamentalScore={fundamentalScore}
        fundamentalLabel={fundamentalLabel(fundamentalScore)}
        dataHealthScore={dataHealthScore}
        dataHealthLabel={dataHealthLabel(dataHealthScore)}
        triggered={stats?.triggered ?? 0}
        warning={stats?.warning ?? 0}
      />

      {/* Sticky tier tabs */}
      <div className="sticky top-[42px] z-20 border-b border-[color:var(--line)] bg-[color:var(--bg-0)]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-2 sm:px-8">
          {([1, 2, 3] as const).map((tier) => {
            const trippedInTier = triggers.filter(
              (t) => t.tier === tier && t.status === "triggered",
            ).length;
            return (
              <button
                key={tier}
                type="button"
                onClick={() => setTierTab(tier)}
                className={`nav-pill shrink-0 ${tierTab === tier ? "nav-pill-active" : ""}`}
              >
                Tier {tier}
                <span className="ml-1.5 font-mono text-[10px] tabular text-dim">
                  {tierCounts[tier]}
                  {trippedInTier > 0 ? (
                    <span className="ml-1 text-signal">· {trippedInTier} tripped</span>
                  ) : null}
                </span>
              </button>
            );
          })}
          <span className="ml-auto hidden font-mono text-[10px] uppercase tracking-[0.12em] text-dim sm:inline">
            {TIER_SUB[tierTab]}
          </span>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-8">
        {/* Compact hero */}
        <section className="surface">
          <div className="flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
            <div>
              <p className="text-eyebrow">invalidation triggers</p>
              <h1 className="mt-2 font-display text-[32px] leading-tight text-ink sm:text-[40px]">
                RISK RADAR
              </h1>
              <p className="mt-2 max-w-xl text-sm text-ink-soft">
                {INVALIDATION_TRIGGER_COUNT} conditions that invalidate the long-ETH thesis if confirmed over their windows.
              </p>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:max-w-xs">
              <HeroKpi
                label="TRIPPED"
                value={String(stats?.triggered ?? 0).padStart(2, "0")}
                tone={stats?.triggered ? "signal" : "ink"}
              />
              <HeroKpi
                label="WARNING"
                value={String(stats?.warning ?? 0).padStart(2, "0")}
                tone={stats?.warning ? "soft" : "ink"}
              />
            </div>
          </div>
        </section>

        <ManualDataBanner etfStale={etfStale} queueStale={queueStale} />
        <ManualEtfInput
          adminToken={adminToken}
          actorName={actorName}
          etfStale={etfStale}
        />

        {/* Trigger cards for active tier */}
        <section className="mt-4">
          <header className="mb-3 flex items-end justify-between gap-3 border-b border-[color:var(--line)] pb-2">
            <div>
              <h2 className="font-mono text-sm uppercase tracking-tight text-ink">
                Tier {tierTab}
              </h2>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-dim">
                {TIER_SUB[tierTab]} · sorted by severity
              </p>
            </div>
            <p className="font-mono text-[10px] tabular text-dim">
              {tierCards.length} triggers
            </p>
          </header>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {tierCards.map((t) => (
              <TriggerCard
                key={t.trigger_name}
                t={t}
                adminToken={adminToken}
                actor={actorName}
              />
            ))}
            {tierCards.length === 0 ? (
              <article className="surface px-4 py-6 text-center font-mono text-xs text-muted">
                no tier-{tierTab} evaluations yet
              </article>
            ) : null}
          </div>
        </section>

        {/* Risk lane — context below tabs */}
        {stats ? (
          <section className="surface mt-5">
            <header className="flex items-center justify-between border-b border-[color:var(--line)] px-4 py-2">
              <p className="text-eyebrow">RISK LANE · ALL TIERS</p>
              <p className="font-mono text-[10px] tabular text-dim">
                {triggers.length} TOTAL
              </p>
            </header>
            <div className="px-4 py-3">
              <div className="flex h-2 w-full overflow-hidden">
                <Lane width={(stats.triggered / triggers.length) * 100} color="var(--signal)" />
                <Lane width={(stats.warning / triggers.length) * 100} color="var(--watch)" />
                <Lane width={(stats.noData / triggers.length) * 100} color="var(--dim)" />
                <Lane width={(stats.ok / triggers.length) * 100} color="var(--faint)" />
              </div>
              <div className="mt-2 flex flex-wrap gap-4 font-mono text-[10px] tabular text-dim uppercase tracking-[0.12em]">
                <LaneLegend dot="var(--signal)" label={`${stats.triggered} tripped`} />
                <LaneLegend dot="var(--watch)" label={`${stats.warning} warning/partial`} />
                <LaneLegend dot="var(--dim)" label={`${stats.noData} no data/manual`} />
                <LaneLegend dot="var(--faint)" label={`${stats.ok} ok`} />
              </div>
            </div>
          </section>
        ) : null}

        <WeeklyManualChecklist />

        {/* Change log */}
        <section className="surface mt-4">
          <header className="flex items-center justify-between border-b border-[color:var(--line)] px-4 py-2">
            <p className="text-eyebrow">CHANGE LOG · LAST 2 EVALUATIONS</p>
            <p className="font-mono text-[10px] tabular text-dim">
              {(changes?.length ?? 0).toString().padStart(2, "0")} EVENTS
            </p>
          </header>
          <div className="px-4 py-3">
            {changes === undefined ? (
              <p className="font-mono text-xs text-muted">loading transitions...</p>
            ) : changes.length === 0 ? (
              <p className="font-mono text-xs text-muted">
                no status transition between the two most recent runs.
              </p>
            ) : (
              <div className="space-y-2">
                {changes.map((c) => (
                  <div key={c.trigger_name} className="surface-flat px-3 py-2">
                    <p className="font-mono text-[11px] text-ink">
                      <span className="text-muted">{c.trigger_name}</span>{" "}
                      <span style={{ color: STATUS_TONE[c.previous_status] }}>
                        {c.previous_status}
                      </span>
                      <span className="text-dim"> → </span>
                      <span
                        className="font-semibold"
                        style={{ color: STATUS_TONE[c.current_status] }}
                      >
                        {c.current_status}
                      </span>
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-muted">{c.current_message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Manual admin */}
        <section className="surface mt-4">
          <button
            type="button"
            onClick={() => setAdminOpen((o) => !o)}
            className="flex w-full items-center justify-between border-b border-[color:var(--line)] px-4 py-2 text-left hover:bg-[color:var(--bg-2)]"
          >
            <p className="text-eyebrow">MANUAL CONTROLS</p>
            <span className="font-mono text-[10px] tabular text-muted">
              {adminOpen ? "[−]" : "[+]"}
            </span>
          </button>
          {adminOpen ? (
            <div className="px-4 py-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="text-eyebrow">ADMIN TOKEN</span>
                  <input
                    type="password"
                    value={adminToken}
                    onChange={(e) => setAdminToken(e.target.value)}
                    className="input mt-2"
                    placeholder="MANUAL_TRIGGER_ADMIN_TOKEN"
                  />
                </label>
                <label className="block">
                  <span className="text-eyebrow">ACTOR</span>
                  <input
                    type="text"
                    value={actorName}
                    onChange={(e) => setActorName(e.target.value)}
                    className="input mt-2"
                    placeholder="e.g. antoine"
                  />
                </label>
              </div>
              {manualAudit && manualAudit.length > 0 ? (
                <div className="mt-5">
                  <p className="text-eyebrow">RECENT AUDIT TRAIL</p>
                  <div className="mt-2 space-y-1.5">
                    {manualAudit.slice(0, 5).map((row, i) => (
                      <div
                        key={`${row.trigger_name}-${row.toggled_at}-${i}`}
                        className="surface-flat px-3 py-2 font-mono text-[10px]"
                      >
                        <p className="text-ink">
                          <span className="text-muted">{row.trigger_name}</span>{" "}
                          <span className="text-dim">→</span>{" "}
                          <span
                            style={{
                              color: row.is_triggered ? "var(--signal)" : "var(--muted)",
                            }}
                          >
                            {row.is_triggered ? "TRIPPED" : "CLEAR"}
                          </span>
                        </p>
                        <p className="mt-1 text-dim tabular">
                          {row.actor ?? "unknown"} ·{" "}
                          {new Date(row.toggled_at).toISOString().replace("T", " ").slice(0, 16)} UTC
                        </p>
                        {row.note ? <p className="mt-1 text-muted">{row.note}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </main>
    </>
  );
}

function Lane({ width, color }: { width: number; color: string }) {
  return <div className="h-full" style={{ width: `${width}%`, background: color }} />;
}

function LaneLegend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-1.5 w-1.5" style={{ background: dot }} />
      {label}
    </span>
  );
}
