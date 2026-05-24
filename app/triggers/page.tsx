"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { TriggerCard } from "@/components/TriggerCard";
import { StatusBar } from "@/components/StatusBar";

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

type ViewMode = "tier" | "status";

const STATUS_ORDER: Record<string, number> = {
  triggered: 0,
  error: 1,
  warning: 2,
  partial: 3,
  insufficient_data: 4,
  needs_manual: 5,
  ok: 6,
};

const STATUS_LABEL: Record<string, string> = {
  triggered: "TRIPPED",
  error: "ERROR",
  warning: "WARNING",
  partial: "PARTIAL",
  insufficient_data: "INSUFFICIENT DATA",
  needs_manual: "AWAITING MANUAL",
  ok: "OK",
};

const STATUS_TONE: Record<string, string> = {
  triggered: "var(--signal)",
  error: "var(--signal)",
  warning: "var(--ink-soft)",
  partial: "var(--ink-soft)",
  insufficient_data: "var(--muted)",
  needs_manual: "var(--muted)",
  ok: "var(--muted)",
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
        ? "var(--ink-soft)"
        : "var(--ink)";
  return (
    <div className="surface px-4 py-3.5">
      <p className="text-eyebrow">{label}</p>
      <p
        className="mt-2 font-mono tabular text-[28px] font-medium leading-none"
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
  const [view, setView] = useState<ViewMode>("status");
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
  const bundlesQuery = useQuery(api.snapshots.dashboardBundle, {}) as
    | Array<{ snapshot: { status: string }; analytics: { freshnessHours: number } }>
    | undefined;

  const stats = useMemo(() => {
    if (!triggers) return null;
    return {
      triggered: triggers.filter((t) => t.status === "triggered").length,
      warning: triggers.filter((t) => t.status === "warning" || t.status === "partial").length,
      noData: triggers.filter((t) => t.status === "insufficient_data" || t.status === "needs_manual").length,
      ok: triggers.filter((t) => t.status === "ok").length,
    };
  }, [triggers]);

  if (triggers === undefined) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-8">
        <p className="text-eyebrow">› BOOTING</p>
        <h1 className="mt-3 font-display text-4xl text-ink">RISK RADAR</h1>
        <p className="mt-4 font-mono text-xs text-muted">loading evaluations...</p>
      </main>
    );
  }

  if (triggers.length === 0) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-8">
        <h1 className="font-display text-4xl text-ink">RISK RADAR</h1>
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

  const live = bundlesQuery?.filter((b) => b.snapshot.status === "ok").length ?? 0;
  const stale = bundlesQuery?.filter((b) => b.snapshot.status === "stale").length ?? 0;
  const aged =
    bundlesQuery?.filter(
      (b) => b.snapshot.status === "ok" && b.analytics.freshnessHours > 24,
    ).length ?? 0;
  const total = bundlesQuery?.length ?? 11;
  const regimeScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (live / Math.max(1, total)) * 100 -
          stale * 7 -
          aged * 2 -
          (stats?.triggered ?? 0) * 22 -
          (stats?.warning ?? 0) * 10 -
          (stats?.noData ?? 0) * 1.5,
      ),
    ),
  );
  const regimeLabel =
    regimeScore >= 80
      ? "CONSTRUCTIVE"
      : regimeScore >= 65
        ? "HEALTHY"
        : regimeScore >= 50
          ? "MIXED"
          : regimeScore >= 35
            ? "FRAGILE"
            : "HIGH RISK";

  return (
    <>
      <StatusBar
        live={live}
        aged={aged}
        stale={stale}
        total={total}
        regimeScore={regimeScore}
        regimeLabel={regimeLabel}
        triggered={stats?.triggered ?? 0}
        warning={stats?.warning ?? 0}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
        {/* Hero block */}
        <section className="surface">
          <div className="flex flex-col gap-6 px-5 py-7 sm:px-8 sm:py-9 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-eyebrow caret-mark">risk radar</p>
              <h1 className="mt-4 font-display text-[44px] leading-[0.98] text-ink sm:text-[58px]">
                INVALIDATION
                <br />
                <span className="text-signal">TRIGGERS</span>
              </h1>
              <div className="rule mt-5 max-w-[200px]" />
              <p className="mt-5 max-w-xl text-sm leading-relaxed text-ink-soft">
                11 conditions that — if confirmed over their time windows —
                invalidate the long-ETH thesis. Daily Convex eval, Telegram
                alert on transition, manual override for Tier-3.
              </p>
              <Link href="/" className="btn mt-6 inline-flex">
                ← dashboard
              </Link>
            </div>

            <div className="grid w-full grid-cols-2 gap-2 sm:max-w-md">
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
              <HeroKpi
                label="AWAITING"
                value={String(stats?.noData ?? 0).padStart(2, "0")}
              />
              <HeroKpi
                label="CLEAR"
                value={String(stats?.ok ?? 0).padStart(2, "0")}
                tone="ink"
              />
            </div>
          </div>
        </section>

        {/* Risk lane */}
        {stats && (
          <section className="surface mt-4">
            <header className="flex items-center justify-between border-b border-[color:var(--line)] px-4 py-2">
              <p className="text-eyebrow">RISK LANE</p>
              <p className="font-mono text-[10px] tabular text-dim">
                {triggers.length} TOTAL
              </p>
            </header>
            <div className="px-4 py-3">
              <div className="flex h-2 w-full overflow-hidden">
                <Lane width={(stats.triggered / triggers.length) * 100} color="var(--signal)" />
                <Lane width={(stats.warning / triggers.length) * 100} color="var(--ink-soft)" />
                <Lane width={(stats.noData / triggers.length) * 100} color="var(--dim)" />
                <Lane width={(stats.ok / triggers.length) * 100} color="var(--faint)" />
              </div>
              <div className="mt-2 flex flex-wrap gap-4 font-mono text-[10px] tabular text-dim uppercase tracking-[0.12em]">
                <LaneLegend dot="var(--signal)" label={`${stats.triggered} tripped`} />
                <LaneLegend dot="var(--ink-soft)" label={`${stats.warning} warning/partial`} />
                <LaneLegend dot="var(--dim)" label={`${stats.noData} no data/manual`} />
                <LaneLegend dot="var(--faint)" label={`${stats.ok} ok`} />
              </div>
            </div>
          </section>
        )}

        {/* What changed */}
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
                  <div
                    key={c.trigger_name}
                    className="surface-flat px-3 py-2"
                  >
                    <p className="font-mono text-[11px] text-ink">
                      <span className="text-muted">{c.trigger_name}</span>{" "}
                      <span
                        className="px-1 text-dim"
                        style={{ color: STATUS_TONE[c.previous_status] }}
                      >
                        {c.previous_status}
                      </span>
                      <span className="text-dim">→</span>{" "}
                      <span
                        className="px-1 font-semibold"
                        style={{ color: STATUS_TONE[c.current_status] }}
                      >
                        {c.current_status}
                      </span>
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-muted">
                      {c.current_message}
                    </p>
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
              {adminOpen ? "[−] HIDE" : "[+] SHOW"}
            </span>
          </button>
          {adminOpen && (
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
          )}
        </section>

        {/* Sort toggle */}
        <section className="surface mt-5 flex flex-wrap items-center justify-end gap-2 px-4 py-3">
          <span className="text-eyebrow mr-1">SORT BY</span>
          <button
            type="button"
            onClick={() => setView("status")}
            className={`btn ${view === "status" ? "btn-active" : ""}`}
          >
            status
          </button>
          <button
            type="button"
            onClick={() => setView("tier")}
            className={`btn ${view === "tier" ? "btn-active" : ""}`}
          >
            tier
          </button>
        </section>

        {view === "tier"
          ? renderByTier(triggers, adminToken, actorName)
          : renderByStatus(triggers, adminToken, actorName)}
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

function renderByTier(triggers: Trigger[], adminToken: string, actor: string) {
  const byTier = (n: number) => triggers.filter((t) => t.tier === n);
  return (
    <>
      {[1, 2, 3].map((tier) => {
        const cards = byTier(tier);
        const subtitle =
          tier === 1
            ? "1 trigger → full exit"
            : tier === 2
              ? "2 simultaneous → full exit"
              : "manual · binary";
        return (
          <section key={tier} className="mt-6">
            <div className="mb-3 flex items-end justify-between gap-3 border-b border-[color:var(--line)] pb-2">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[11px] font-semibold tracking-[0.14em] text-ink-soft">
                  ▸ T{tier}
                </span>
                <h2 className="font-mono text-base uppercase tracking-tight text-ink">
                  TIER {tier}
                </h2>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
                  {subtitle}
                </p>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
                {cards.length} triggers
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {cards.map((t) => (
                <TriggerCard key={t.trigger_name} t={t} adminToken={adminToken} actor={actor} />
              ))}
              {cards.length === 0 ? (
                <article className="surface px-4 py-6 text-center font-mono text-xs text-muted">
                  no tier-{tier} evaluations yet
                </article>
              ) : null}
            </div>
          </section>
        );
      })}
    </>
  );
}

function renderByStatus(triggers: Trigger[], adminToken: string, actor: string) {
  const grouped = new Map<string, Trigger[]>();
  for (const t of triggers) {
    const k = t.status;
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(t);
  }
  const ordered = [...grouped.entries()].sort(
    (a, b) => (STATUS_ORDER[a[0]] ?? 99) - (STATUS_ORDER[b[0]] ?? 99),
  );
  return (
    <>
      {ordered.map(([status, list]) => (
        <section key={status} className="mt-6">
          <div className="mb-3 flex items-end justify-between gap-3 border-b border-[color:var(--line)] pb-2">
            <div className="flex items-baseline gap-3">
              <span
                className="font-mono text-[11px] font-semibold tracking-[0.16em]"
                style={{ color: STATUS_TONE[status] ?? "var(--muted)" }}
              >
                ▸
              </span>
              <h2 className="font-mono text-base uppercase tracking-tight text-ink">
                {STATUS_LABEL[status] ?? status}
              </h2>
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
              {list.length} triggers
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {list.map((t) => (
              <TriggerCard key={t.trigger_name} t={t} adminToken={adminToken} actor={actor} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
