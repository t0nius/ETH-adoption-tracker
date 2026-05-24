"use client";

import Link from "next/link";

type TriggerBrief = {
  trigger_name: string;
  tier: number;
  status: string;
};

type Props = {
  triggers: TriggerBrief[];
  fundamentalScore: number;
  fundamentalLabel: string;
  dataHealthScore: number;
  dataHealthLabel: string;
  lastEvaluatedAt?: number;
};

function formatEvalTime(ts?: number) {
  if (!ts) return "—";
  return new Date(ts).toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

export function VerdictStrip({
  triggers,
  fundamentalScore,
  fundamentalLabel,
  dataHealthScore,
  dataHealthLabel,
  lastEvaluatedAt,
}: Props) {
  const tier1Tripped = triggers.filter(
    (t) => t.tier === 1 && t.status === "triggered",
  ).length;
  const anyTripped = triggers.filter((t) => t.status === "triggered").length;
  const warnings = triggers.filter(
    (t) => t.status === "warning" || t.status === "partial",
  ).length;

  let mode: "act" | "watch" | "clear" = "clear";
  let headline = "No action required";
  let toneClass = "text-up";

  if (tier1Tripped > 0) {
    mode = "act";
    headline = `Act now — ${tier1Tripped} Tier-1 tripped`;
    toneClass = "text-signal";
  } else if (anyTripped > 0 || warnings > 0) {
    mode = "watch";
    headline =
      anyTripped > 0
        ? `Watch — ${anyTripped} trigger${anyTripped > 1 ? "s" : ""} tripped`
        : `Watch — ${warnings} in warning`;
    toneClass = "text-watch";
  }

  const accentClass =
    mode === "act"
      ? "verdict-accent-act"
      : mode === "watch"
        ? "verdict-accent-watch"
        : "verdict-accent-clear";

  return (
    <section
      className={`surface section-gap px-4 py-3 sm:px-5 ${accentClass}`}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-eyebrow">VERDICT</p>
          <p className={`mt-1 font-mono text-sm font-semibold uppercase tracking-tight ${toneClass}`}>
            {headline}
          </p>
          <p className="mt-1 font-mono text-[11px] tabular text-muted">
            {tier1Tripped} T1 tripped · {warnings} warning · Fundamentals{" "}
            {String(fundamentalScore).padStart(3, "0")} {fundamentalLabel} · Data{" "}
            {String(dataHealthScore).padStart(3, "0")} {dataHealthLabel}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-dim">
            Last eval: {formatEvalTime(lastEvaluatedAt)}
          </p>
        </div>
        {(mode === "act" || mode === "watch") && (
          <Link href="/triggers" className="btn shrink-0 self-start">
            open triggers →
          </Link>
        )}
      </div>
    </section>
  );
}
