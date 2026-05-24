"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { InfoHint } from "./InfoHint";

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

const STATUS_LABEL: Record<string, string> = {
  ok: "OK",
  warning: "WARNING",
  triggered: "TRIPPED",
  insufficient_data: "NO DATA",
  needs_manual: "MANUAL",
  partial: "PARTIAL",
  error: "ERROR",
};

function statusColor(s: string): string {
  if (s === "triggered" || s === "error") return "var(--signal)";
  return "var(--muted)";
}

function shortDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 16).replace("T", " ") + "Z";
}

function thresholdDistance(current: number | null, threshold: number | null) {
  if (current === null || threshold === null || threshold === 0) return null;
  const gap = current - threshold;
  const pct = (Math.abs(gap) / Math.abs(threshold)) * 100;
  return { gap, pct };
}

export function TriggerCard({
  t,
  adminToken,
  actor,
}: {
  t: Trigger;
  adminToken?: string;
  actor?: string;
}) {
  const isManualTier = t.tier === 3;
  const isManualSubcondition =
    t.trigger_name === "T1.3_etf_neg_and_ser_drop" ||
    t.trigger_name === "T1.4_staking_drop_or_exit_queue";

  const setManual = useMutation(api.triggers.setManualTrigger);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const distance = thresholdDistance(t.current_value, t.threshold_value);
  const tone = statusColor(t.status);

  async function toggle(is_triggered: boolean) {
    setBusy(true);
    setActionError(null);
    try {
      await setManual({
        trigger_name: t.trigger_name,
        is_triggered,
        note: note || undefined,
        admin_token: adminToken || undefined,
        actor: actor || undefined,
      });
      setNote("");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="surface-raised hover-bright">
      <header className="flex items-center justify-between border-b border-[color:var(--line)] px-3.5 py-2 font-mono text-[10px]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-dim shrink-0">T{t.tier}</span>
          <span className="text-dim">/</span>
          <span className="truncate uppercase tracking-[0.12em] text-muted">
            {t.trigger_name}
          </span>
        </div>
        <span
          className="status-tag"
          style={{ color: tone }}
        >
          {STATUS_LABEL[t.status] ?? t.status}
        </span>
      </header>

      <div className="px-3.5 py-3">
        <p className="text-sm leading-snug text-ink">{t.description}</p>
        <p className="mt-2 font-mono text-[11px] text-ink-soft">{t.message}</p>

        <div className="mt-3 grid grid-cols-2 gap-px border border-[color:var(--line)] bg-[color:var(--line)]">
          <div className="bg-[color:var(--bg-1)] px-3 py-2">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-dim">CURRENT</p>
            <p className="mt-1 font-mono tabular text-base text-ink">
              {t.current_value === null ? "—" : t.current_value.toFixed(2)}
            </p>
          </div>
          <div className="bg-[color:var(--bg-1)] px-3 py-2">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-dim">THRESHOLD</p>
            <p className="mt-1 font-mono tabular text-base text-ink">
              {t.threshold_value === null ? "—" : t.threshold_value}
            </p>
          </div>
        </div>

        {distance ? (
          <div className="mt-3">
            <div className="flex items-baseline justify-between font-mono text-[10px]">
              <span className="text-dim flex items-center gap-1">
                DISTANCE
                <InfoHint
                  label="Distance to threshold explanation"
                  hint="Signed gap between current value and threshold."
                />
              </span>
              <span
                className="tabular"
                style={{
                  color: distance.gap < 0 ? "var(--muted)" : "var(--ink)",
                }}
              >
                {distance.gap >= 0 ? "+" : ""}
                {distance.gap.toFixed(2)} ({distance.pct.toFixed(0)}%)
              </span>
            </div>
            <div className="mt-1.5 h-[2px] bg-[color:var(--line)]">
              <div
                className="h-[2px]"
                style={{
                  width: `${Math.min(100, Math.max(8, distance.pct))}%`,
                  background:
                    distance.gap < 0 ? "var(--muted)" : "var(--ink-soft)",
                }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <footer className="border-t border-[color:var(--line)] px-3.5 py-1.5">
        <p className="font-mono text-[10px] text-dim">EVAL {shortDate(t.evaluated_at)}</p>
      </footer>

      {(isManualTier || isManualSubcondition) && (
        <div className="border-t border-[color:var(--line)] bg-[color:var(--bg-1)] px-3.5 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            {isManualTier ? "MANUAL TRIGGER" : "MANUAL SUB-CONDITION"}
          </p>
          <input
            className="input mt-2"
            placeholder="optional note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => toggle(true)}
              className="btn"
              style={{ borderColor: "var(--signal)", color: "var(--signal)" }}
            >
              mark tripped
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => toggle(false)}
              className="btn"
            >
              mark clear
            </button>
          </div>
          {actionError ? (
            <p className="mt-2 font-mono text-[10px] text-signal">
              {actionError}
            </p>
          ) : null}
        </div>
      )}
    </article>
  );
}
