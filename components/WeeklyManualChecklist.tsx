"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_PREFIX = "eth-tracker-weekly-check:";

type CheckItem = {
  id: string;
  title: string;
  detail: string;
  triggerRef: string;
};

const ITEMS: CheckItem[] = [
  {
    id: "etf",
    title: "ETF spot ETH net flows (6M cumulative)",
    detail:
      "T1.3 — auto via CoinGlass API, or enter USD value on this page if API key missing.",
    triggerRef: "T1.3_etf_neg_and_ser_drop",
  },
  {
    id: "exit_queue",
    title: "Validator exit queue vs entry",
    detail:
      "T1.4 — auto via beaconcha.in BEACONCHAIN_API_KEY; manual toggle only if API unavailable.",
    triggerRef: "T1.4_staking_drop_or_exit_queue",
  },
  {
    id: "tier3",
    title: "Tier-3 existential flags",
    detail: "Crypto break · regulation · protocol capture — only if something material changed.",
    triggerRef: "T3",
  },
];

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

export function WeeklyManualChecklist() {
  const [checked, setChecked] = useState<Record<string, string | null>>({});
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const next: Record<string, string | null> = {};
    for (const item of ITEMS) {
      try {
        next[item.id] = localStorage.getItem(STORAGE_PREFIX + item.id);
      } catch {
        next[item.id] = null;
      }
    }
    setChecked(next);
    const overdue = ITEMS.filter((item) => {
      const d = daysSince(next[item.id] ?? null);
      return d === null || d > 7;
    }).length;
    setOpen(overdue > 0);
  }, []);

  const markDone = useCallback((id: string) => {
    const iso = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_PREFIX + id, iso);
    } catch {
      /* ignore */
    }
    setChecked((prev) => ({ ...prev, [id]: iso }));
  }, []);

  const overdueCount = ITEMS.filter((item) => {
    const d = daysSince(checked[item.id] ?? null);
    return d === null || d > 7;
  }).length;

  return (
    <section className="surface section-gap">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between border-b border-[color:var(--line)] px-4 py-2 text-left hover:bg-[color:var(--bg-2)]"
      >
        <p className="text-eyebrow">WEEKLY MANUAL RITUAL</p>
        <span className="font-mono text-[10px] tabular uppercase tracking-[0.12em] text-dim">
          {overdueCount > 0 ? (
            <span className="text-watch">{overdueCount} due</span>
          ) : (
            "all checked · 7d"
          )}{" "}
          {open ? "[−]" : "[+]"}
        </span>
      </button>
      {open ? (
        <>
          <ul className="divide-y divide-[color:var(--line)]">
            {ITEMS.map((item) => {
              const last = checked[item.id] ?? null;
              const days = daysSince(last);
              const overdue = days === null || days > 7;
              return (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="max-w-2xl">
                    <p className="font-mono text-sm font-semibold text-ink">{item.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{item.detail}</p>
                    <p className="mt-2 font-mono text-[10px] text-dim">
                      {last
                        ? `Last marked: ${last.slice(0, 10)} (${days}d ago)`
                        : "Never marked this cycle"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn shrink-0"
                    onClick={() => markDone(item.id)}
                  >
                    {overdue ? "mark done today" : "done · refresh"}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-[color:var(--line)] px-4 py-3 text-xs text-dim">
            Stored locally. See{" "}
            <Link href="/methodology#manual-data" className="text-ink-soft underline">
              methodology
            </Link>
            .
          </p>
        </>
      ) : null}
    </section>
  );
}
