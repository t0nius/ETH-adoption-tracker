"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { GLOSSARY } from "@/lib/glossary";
import {
  BOARD_METRIC_COUNT,
  INVALIDATION_TRIGGER_COUNT,
} from "@/lib/product";

type Trigger = {
  trigger_name: string;
  tier: number;
  status: string;
  description: string;
  message: string;
  current_value: number | null;
  threshold_value: number | null;
};

type Bundle = {
  metric_name: string;
  snapshot: { status: "ok" | "stale" };
  analytics: { qualityScore: number; freshnessHours: number; staleRate7d: number };
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

export default function MethodologyPage() {
  const triggers = useQuery(api.triggers.listTriggers, {}) as Trigger[] | undefined;
  const bundles = useQuery(api.snapshots.dashboardBundle, {}) as Bundle[] | undefined;

  const exampleT1 = triggers?.find((t) => t.tier === 1) ?? null;
  const exampleT2 =
    triggers?.find((t) => t.tier === 2 && t.status === "ok") ??
    triggers?.find((t) => t.tier === 2) ??
    null;
  const exampleT3 = triggers?.find((t) => t.tier === 3) ?? null;

  const lowestQuality =
    bundles && bundles.length > 0
      ? [...bundles].sort((a, b) => a.analytics.qualityScore - b.analytics.qualityScore)[0]
      : null;
  const highestQuality =
    bundles && bundles.length > 0
      ? [...bundles].sort((a, b) => b.analytics.qualityScore - a.analytics.qualityScore)[0]
      : null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-8">
      <section className="surface">
        <div className="px-5 py-7 sm:px-8 sm:py-8">
          <p className="text-eyebrow caret-mark">methodology</p>
          <h1 className="mt-4 font-display text-[44px] leading-[0.98] text-ink sm:text-[52px]">
            HOW THIS
            <br />
            <span className="text-ink-soft">TRACKER WORKS</span>
          </h1>
          <div className="rule mt-5 max-w-[200px]" />
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-ink-soft">
            This is a <span className="text-ink">thesis-monitoring system</span>, not
            a trading signal generator. The {INVALIDATION_TRIGGER_COUNT} triggers below define when the
            long-ETH thesis would be invalidated. The {BOARD_METRIC_COUNT} board metrics feed those
            triggers; sparklines and deltas are decoration around the real
            deliverable: <span className="text-ink">trigger state</span>.
          </p>
          <Link href="/" className="btn mt-6 inline-flex">
            ← dashboard
          </Link>
        </div>
      </section>

      {/* Glossary */}
      <section id="glossary" className="surface mt-4 scroll-mt-24">
        <header className="border-b border-[color:var(--line)] px-4 py-2">
          <p className="text-eyebrow">GLOSSARY</p>
        </header>
        <dl className="divide-y divide-[color:var(--line)]">
          {GLOSSARY.map((entry) => (
            <div key={entry.term} className="px-4 py-3">
              <dt className="font-mono text-sm font-semibold text-ink">{entry.term}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-ink-soft">{entry.def}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Reading order */}
      <section className="surface mt-4">
        <header className="border-b border-[color:var(--line)] px-4 py-2">
          <p className="text-eyebrow">READING ORDER · CHECK THE BOARD</p>
        </header>
        <ol className="grid grid-cols-1 md:grid-cols-3">
          {[
            {
              n: "01",
              title: "TRIGGER STATUS",
              body: "Any Tier-1 tripped ⇒ act. Two Tier-2 simultaneous ⇒ act. Otherwise keep monitoring.",
            },
            {
              n: "02",
              title: "DATA HEALTH",
              body: "Check the DATA score and stale count before reacting. A weak fundamental read may just mean missing API keys.",
            },
            {
              n: "03",
              title: "LONG-WINDOW DELTAS",
              body: "Verify 90D and 1Y trend consistency before acting. Short-term moves are noise on these metrics.",
            },
          ].map((s) => (
            <li
              key={s.n}
              className="border-b border-[color:var(--line)] px-4 py-4 md:border-b-0 md:border-r md:last:border-r-0"
            >
              <p className="font-mono text-[10px] tabular text-dim">
                {s.n}
              </p>
              <p className="mt-2 font-mono text-sm font-semibold tracking-tight text-ink">
                {s.title}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Scores */}
      <section className="surface mt-4">
        <header className="border-b border-[color:var(--line)] px-4 py-2">
          <p className="text-eyebrow">DASHBOARD SCORES (0–100)</p>
        </header>
        <div className="px-4 py-4 space-y-4">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ink">
              Fundamentals
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Weighted 30-day trends on <strong className="text-ink">live</strong> metrics
              only (stale sources excluded — they belong in Data). Pillar weights:
              Monetary 35% · Institutional 35% · Usage 20% · Infrastructure 10%.
              ETH/BTC excluded (market ratio, not adoption). Minus 15 pts per tripped
              Tier-1/2 trigger. Labels: ≥80 STRONG · ≥65 STEADY · ≥50 MIXED · ≥
              35 SOFT · &lt;35 WEAK.
            </p>
          </div>
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ink">
              Data health
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Coverage × 100 on the {BOARD_METRIC_COUNT} board metrics, minus stale
              (−10 each), aged &gt;24h (−3 each). Does <strong className="text-ink">not</strong>{" "}
              penalize trigger state — use the Triggers card for invalidation.
              Labels: ≥85 SOLID · ≥70 OK · ≥50 PATCHY · &lt;50 GAPS.
            </p>
          </div>
          <p className="text-xs text-dim">
            Implementation: <code className="text-ink-soft">lib/regime.ts</code>.
            Neither score is a price forecast.
          </p>
        </div>
      </section>

      {/* Trigger eval modes */}
      <section className="surface mt-4">
        <header className="border-b border-[color:var(--line)] px-4 py-2">
          <p className="text-eyebrow">TRIGGER DATA MODES</p>
        </header>
        <div className="px-4 py-4 text-sm text-ink-soft">
          <p className="leading-relaxed">
            Each rule shows a badge: <span className="text-ink">AUTO</span> (fully
            computed), <span className="text-ink">PARTIAL</span> (some sub-conditions
            manual), <span className="text-ink">MANUAL</span> (Tier-3 discretionary).
            T1.2 uses hidden <code className="text-[10px]">eth_total_supply</code>{" "}
            snapshots from ultrasound.money.
          </p>
        </div>
      </section>

      {/* Quality model */}
      <section className="surface mt-4">
        <header className="border-b border-[color:var(--line)] px-4 py-2">
          <p className="text-eyebrow">DATA QUALITY MODEL</p>
        </header>
        <div className="px-4 py-4">
          <p className="text-sm leading-relaxed text-ink-soft">
            Each metric carries a 0–100 quality score: <span className="text-ink">freshness</span> penalty
            (oldness of the latest snapshot),{" "}
            <span className="text-ink">7-day stale rate</span> penalty (how often
            the source has failed), and{" "}
            <span className="text-ink">completeness</span> penalty (missing daily
            points over 30 days).
          </p>
          <div className="mt-4 grid grid-cols-1 gap-px border border-[color:var(--line)] bg-[color:var(--line)] md:grid-cols-2">
            {highestQuality ? (
              <div className="bg-[color:var(--bg-1)] px-4 py-3">
                <p className="text-eyebrow">LIVE · BEST</p>
                <p className="mt-2 font-mono text-base text-ink">
                  {highestQuality.metric_name}
                </p>
                <p className="mt-1 font-mono tabular text-[11px] text-muted">
                  Q
                  <span className="font-semibold text-ink-soft">
                    {" "}
                    {highestQuality.analytics.qualityScore}/100
                  </span>{" "}
                  · fresh {highestQuality.analytics.freshnessHours.toFixed(1)}h · stale7d{" "}
                  {highestQuality.analytics.staleRate7d}%
                </p>
              </div>
            ) : null}
            {lowestQuality ? (
              <div className="bg-[color:var(--bg-1)] px-4 py-3">
                <p className="text-eyebrow">LIVE · WEAKEST</p>
                <p className="mt-2 font-mono text-base text-ink">
                  {lowestQuality.metric_name}
                </p>
                <p className="mt-1 font-mono tabular text-[11px] text-muted">
                  Q
                  <span
                    className="font-semibold"
                    style={{
                      color:
                        lowestQuality.analytics.qualityScore < 70
                          ? "var(--signal)"
                          : "var(--ink-soft)",
                    }}
                  >
                    {" "}
                    {lowestQuality.analytics.qualityScore}/100
                  </span>{" "}
                  · fresh {lowestQuality.analytics.freshnessHours.toFixed(1)}h · stale7d{" "}
                  {lowestQuality.analytics.staleRate7d}%
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Trigger governance */}
      <section className="surface mt-4">
        <header className="border-b border-[color:var(--line)] px-4 py-2">
          <p className="text-eyebrow">
            TRIGGER GOVERNANCE · {INVALIDATION_TRIGGER_COUNT} RULES · 3 TIERS
          </p>
        </header>
        <div className="px-4 py-4">
          <p className="text-sm leading-relaxed text-ink-soft">
            <span className="text-ink">Tier 1</span> needs only one breach for a full
            exit. <span className="text-ink">Tier 2</span> requires two simultaneous
            breaches. <span className="text-ink">Tier 3</span> is binary, observed
            manually (regulation, cryptographic break, protocol capture).
            Transitions are tracked so the Telegram alert fires once per status
            change.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-px border border-[color:var(--line)] bg-[color:var(--line)] md:grid-cols-3">
            {[
              { ex: exampleT1, tag: "TIER 1" },
              { ex: exampleT2, tag: "TIER 2" },
              { ex: exampleT3, tag: "TIER 3" },
            ].map(({ ex, tag }) =>
              ex ? (
                <div key={ex.trigger_name} className="bg-[color:var(--bg-1)] px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-eyebrow">{tag}</span>
                    <span
                      className="font-mono text-[10px] uppercase tracking-[0.14em]"
                      style={{ color: STATUS_TONE[ex.status] ?? "var(--muted)" }}
                    >
                      {ex.status}
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-[10px] text-muted">
                    {ex.trigger_name}
                  </p>
                  <p className="mt-2 text-xs leading-snug text-ink">
                    {ex.description}
                  </p>
                  <p className="mt-2 font-mono text-[10px] leading-snug text-muted">
                    {ex.message}
                  </p>
                </div>
              ) : (
                <div
                  key={tag}
                  className="bg-[color:var(--bg-1)] px-4 py-3 text-muted"
                >
                  <p className="text-eyebrow">{tag}</p>
                  <p className="mt-2 font-mono text-xs">no evaluation yet.</p>
                </div>
              ),
            )}
          </div>
          <Link
            href="/triggers"
            className="btn mt-4 inline-flex"
          >
            open trigger radar →
          </Link>
        </div>
      </section>

      {/* Known gaps */}
      <section id="manual-data" className="surface mt-4 scroll-mt-24">
        <header className="border-b border-[color:var(--line)] px-4 py-2">
          <p className="text-eyebrow">KNOWN GAPS · MANUAL SUB-CONDITIONS</p>
        </header>
        <div className="px-4 py-4">
          <p className="text-sm leading-relaxed text-ink-soft">
            Some inputs from the original spec are not auto-fetched because the
            source requires a paid plan or has no usable public surface. Documented
            in <code className="border border-[color:var(--line)] bg-[color:var(--bg-2)] px-1.5 py-0.5 font-mono text-[10px]">MISSING_METRICS.md</code>{" "}
            and surface as <em>data unavailable</em> in trigger messages.
          </p>
          <ul className="mt-3 space-y-2 font-mono text-xs">
            {[
              {
                tone: "var(--muted)",
                name: "VALIDATOR_QUEUE",
                body: "beaconcha.in gates entry/exit queue behind an API key. Workaround: manual toggle on T1.4.",
              },
              {
                tone: "var(--muted)",
                name: "ETF_FLOWS",
                body: "Farside is behind Cloudflare and Sosovalue returns empty without a private header. Workaround: manual toggle on T1.3.",
              },
              {
                tone: "var(--dim)",
                name: "CEX_SUPPLY",
                body: "Glassnode paid, Dune requires a personal API key. No trigger depends on this; informational only.",
              },
            ].map((row) => (
              <li
                key={row.name}
                className="surface-flat flex items-start gap-3 px-3 py-2"
              >
                <span className="h-1.5 w-1.5 shrink-0 translate-y-1.5" style={{ background: row.tone }} />
                <div>
                  <p className="font-semibold text-ink">{row.name}</p>
                  <p className="mt-1 text-muted">{row.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Stack */}
      <section className="surface mt-4">
        <header className="border-b border-[color:var(--line)] px-4 py-2">
          <p className="text-eyebrow">STACK · WHAT RUNS WHERE</p>
        </header>
        <div className="grid grid-cols-1 gap-px border-x border-b border-[color:var(--line)] bg-[color:var(--line)] md:grid-cols-2">
          <div className="bg-[color:var(--bg-1)] px-4 py-3">
            <p className="text-eyebrow">FRONTEND</p>
            <p className="mt-2 font-mono text-xs leading-relaxed text-ink-soft">
              Next.js 14 (App Router) · Tailwind · Recharts · Syne + IBM Plex
              Sans + IBM Plex Mono · terminal palette · hairline grid.
            </p>
          </div>
          <div className="bg-[color:var(--bg-1)] px-4 py-3">
            <p className="text-eyebrow">BACKEND</p>
            <p className="mt-2 font-mono text-xs leading-relaxed text-ink-soft">
              Convex (2 indexed tables). Hourly cron snapshots {BOARD_METRIC_COUNT} board metrics
              (+ hidden supply for T1.2). Daily cron re-evaluates {INVALIDATION_TRIGGER_COUNT} triggers.
              Weekly cron pushes Resend
              recap. Telegram on transition only.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
