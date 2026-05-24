"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

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
            a trading signal generator. The 11 triggers below define when the
            long-ETH thesis would be invalidated. The 11 metrics feed those
            triggers; sparklines and deltas are decoration around the real
            deliverable: <span className="text-ink">trigger state</span>.
          </p>
          <Link href="/" className="btn mt-6 inline-flex">
            ← dashboard
          </Link>
        </div>
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
              title: "DATA QUALITY",
              body: "Quality < 70 means the underlying source is unreliable. Don't react to a single signal from a fragile source.",
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

      {/* Regime score */}
      <section className="surface mt-4">
        <header className="border-b border-[color:var(--line)] px-4 py-2">
          <p className="text-eyebrow">REGIME SCORE (0–100)</p>
        </header>
        <div className="px-4 py-4">
          <p className="text-sm leading-relaxed text-ink-soft">
            The dashboard regime score is computed server-side from live metric
            coverage, data freshness, and trigger state. It is not a price
            forecast — it summarizes whether the adoption stack looks
            constructive or fragile.
          </p>
          <ul className="mt-4 space-y-2 font-mono text-xs text-muted">
            <li>· Live metrics (all 11 OK): up to 40 pts</li>
            <li>· No stale sources: up to 20 pts</li>
            <li>· No aged (&gt;24h) OK metrics: up to 15 pts</li>
            <li>· No tripped triggers: up to 15 pts</li>
            <li>· No warning/partial triggers: up to 10 pts</li>
          </ul>
          <p className="mt-4 text-xs text-dim">
            Labels: ≥80 CONSTRUCTIVE · ≥60 CAUTIOUS · ≥40 FRAGILE · &lt;40
            STRESSED. Implementation:{" "}
            <code className="text-ink-soft">lib/regime.ts</code>.
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
          <p className="text-eyebrow">TRIGGER GOVERNANCE · 11 RULES · 3 TIERS</p>
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
      <section className="surface mt-4">
        <header className="border-b border-[color:var(--line)] px-4 py-2">
          <p className="text-eyebrow">KNOWN GAPS · 3 SOURCES SKIPPED</p>
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
              Convex (2 indexed tables). Hourly cron pulls 11 sources in parallel.
              Daily cron re-evaluates 11 triggers. Weekly cron pushes Resend
              recap. Telegram on transition only.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
