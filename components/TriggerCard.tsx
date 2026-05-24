"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { TriggerEvalBadge } from "./TriggerEvalBadge";
import { getTriggerEvalMeta } from "@/lib/triggers/meta";

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
  if (s === "warning" || s === "partial") return "var(--watch)";
  return "var(--muted)";
}

function shortDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 16).replace("T", " ") + "Z";
}

/** Progress toward threshold (0 = safe side, 100 = at/beyond threshold). */
function thresholdProgress(
  current: number | null,
  threshold: number | null,
): { pct: number; label: string } | null {
  if (current === null || threshold === null || threshold === 0) return null;
  const ratio = Math.abs(current / threshold);
  const pct = Math.min(100, Math.max(4, ratio * 100));
  const gap = current - threshold;
  return {
    pct,
    label: `${gap >= 0 ? "+" : ""}${gap.toFixed(2)} vs ${threshold}`,
  };
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
  const progress = thresholdProgress(t.current_value, t.threshold_value);
  const tone = statusColor(t.status);
  const evalMeta = getTriggerEvalMeta(t.trigger_name);

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
      <header className="flex items-start justify-between gap-2 border-b border-[color:var(--line)] px-3.5 py-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] text-dim">T{t.tier}</span>
            <TriggerEvalBadge triggerName={t.trigger_name} />
          </div>
          <h3 className="mt-1 text-sm font-medium leading-snug text-ink">{t.description}</h3>
          <p className="mt-0.5 truncate font-mono text-[10px] text-dim" title={t.trigger_name}>
            {t.trigger_name}
          </p>
        </div>
        <span className="status-tag shrink-0" style={{ color: tone }}>
          {STATUS_LABEL[t.status] ?? t.status}
        </span>
      </header>

      <div className="px-3.5 py-3">
        {evalMeta.hint &&
        (evalMeta.mode === "partial" || evalMeta.mode === "manual") ? (
          <p className="text-[10px] leading-snug text-dim">{evalMeta.hint}</p>
        ) : null}
        <p className="mt-2 font-mono text-[11px] leading-snug text-ink-soft">{t.message}</p>

        {t.current_value !== null || t.threshold_value !== null ? (
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
        ) : null}

        {progress ? (
          <div className="mt-3">
            <div className="flex items-baseline justify-between font-mono text-[10px]">
              <span className="text-dim">TO THRESHOLD</span>
              <span className="tabular text-muted">{progress.label}</span>
            </div>
            <div className="mt-1.5 h-1.5 bg-[color:var(--line)]">
              <div
                className="h-1.5 transition-all"
                style={{
                  width: `${progress.pct}%`,
                  background:
                    t.status === "triggered" || t.status === "error"
                      ? "var(--signal)"
                      : t.status === "warning" || t.status === "partial"
                        ? "var(--watch)"
                        : "var(--ink-soft)",
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
              className="btn border-signal text-signal"
            >
              mark tripped
            </button>
            <button type="button" disabled={busy} onClick={() => toggle(false)} className="btn">
              mark clear
            </button>
          </div>
          {actionError ? (
            <p className="mt-2 font-mono text-[10px] text-signal">{actionError}</p>
          ) : null}
        </div>
      )}
    </article>
  );
}
