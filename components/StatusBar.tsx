"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function StatusBar({
  live,
  aged,
  stale,
  total,
  fundamentalScore,
  fundamentalLabel,
  dataHealthScore,
  dataHealthLabel,
  triggered,
  warning,
}: {
  live: number;
  aged: number;
  stale: number;
  total: number;
  fundamentalScore: number;
  fundamentalLabel: string;
  dataHealthScore: number;
  dataHealthLabel: string;
  triggered: number;
  warning: number;
}) {
  const pathname = usePathname();

  const nav = [
    { href: "/", label: "Dashboard" },
    { href: "/triggers", label: "Triggers" },
    { href: "/methodology", label: "Method" },
  ];

  return (
    <header className="status-bar">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-8">
        <Link
          href="/"
          className="shrink-0 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink hover:text-ink-soft"
        >
          ETH Tracker
        </Link>

        <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {nav.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-pill shrink-0 ${active ? "nav-pill-active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
          <a
            href="/api/export"
            download
            className="nav-pill shrink-0"
            title="Requires EXPORT_API_TOKEN in production"
          >
            Export
          </a>
        </nav>

        <div className="flex shrink-0 flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
          <span className="tabular">
            live <span className="text-up font-medium">{live}</span>/{total}
          </span>
          {stale > 0 ? (
            <span className="chip-down rounded-sm px-2 py-0.5 tabular font-medium">
              {stale} stale
            </span>
          ) : null}
          {aged > 0 ? (
            <span className="chip-watch rounded-sm px-2 py-0.5 tabular font-medium">
              {aged} aged
            </span>
          ) : null}
          <span className="hidden tabular xl:inline">
            fund {String(fundamentalScore).padStart(3, "0")}{" "}
            <span className="text-dim">{fundamentalLabel}</span>
          </span>
          <span className="hidden tabular xl:inline">
            data {String(dataHealthScore).padStart(3, "0")}{" "}
            <span className="text-dim">{dataHealthLabel}</span>
          </span>
          <Link
            href="/triggers"
            className={`rounded-sm px-2 py-0.5 tabular font-medium hover:opacity-90 ${
              triggered > 0
                ? "chip-down"
                : warning > 0
                  ? "chip-watch"
                  : "chip-up"
            }`}
          >
            {triggered > 0
              ? `${triggered} tripped`
              : warning > 0
                ? `${warning} warn`
                : "clear"}
          </Link>
        </div>
      </div>
    </header>
  );
}
