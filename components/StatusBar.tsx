"use client";

import Link from "next/link";

export function StatusBar({
  live,
  aged,
  stale,
  total,
  regimeScore,
  regimeLabel,
  triggered,
  warning,
}: {
  live: number;
  aged: number;
  stale: number;
  total: number;
  regimeScore: number;
  regimeLabel: string;
  triggered: number;
  warning: number;
}) {
  return (
    <header className="status-bar">
      <div className="mx-auto flex max-w-7xl flex-wrap items-stretch font-mono text-[10px] uppercase tracking-[0.12em]">
        <Link
          href="/"
          className="flex items-center gap-2 border-r border-[color:var(--line)] px-4 py-2 text-ink hover:bg-[color:var(--bg-1)]"
        >
          ETH TRACKER
        </Link>

        <div className="flex flex-wrap items-center gap-3 border-r border-[color:var(--line)] px-4 py-2 tabular">
          <Stat label="LIVE" value={`${live}/${total}`} />
          {aged > 0 ? <Stat label="AGED" value={String(aged)} tone="soft" /> : null}
          {stale > 0 ? <Stat label="STALE" value={String(stale)} tone="signal" /> : null}
        </div>

        <div className="flex items-center gap-2 border-r border-[color:var(--line)] px-4 py-2 tabular">
          <Stat label="REGIME" value={String(regimeScore).padStart(3, "0")} />
          <span className="text-muted">{regimeLabel}</span>
        </div>

        <Link
          href="/triggers"
          className="flex items-center gap-2 border-r border-[color:var(--line)] px-4 py-2 tabular hover:bg-[color:var(--bg-1)]"
        >
          <span className="text-muted">TRIGGERS</span>
          {triggered > 0 ? (
            <span className="font-semibold text-signal">{triggered} TRIPPED</span>
          ) : warning > 0 ? (
            <span className="text-ink-soft">{warning} WARN</span>
          ) : (
            <span className="text-dim">CLEAR</span>
          )}
        </Link>

        <nav className="flex flex-wrap items-center gap-1 px-2 py-1">
          <Link href="/triggers" className="btn">
            radar
          </Link>
          <Link href="/methodology" className="btn">
            method
          </Link>
          <a href="/api/export" download className="btn">
            export
          </a>
        </nav>
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  tone = "ink",
}: {
  label: string;
  value: string;
  tone?: "ink" | "soft" | "signal";
}) {
  const color =
    tone === "signal"
      ? "var(--signal)"
      : tone === "soft"
        ? "var(--ink-soft)"
        : "var(--ink)";
  return (
    <span>
      <span className="text-muted">{label} </span>
      <span style={{ color }}>{value}</span>
    </span>
  );
}
