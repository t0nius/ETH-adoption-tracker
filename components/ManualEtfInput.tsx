"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";

export function ManualEtfInput({
  adminToken,
  actorName,
  etfStale,
}: {
  adminToken: string;
  actorName: string;
  etfStale: boolean;
}) {
  const submit = useMutation(api.snapshots.submitManualEtfFlows);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!etfStale) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(value.replace(/,/g, ""));
    if (Number.isNaN(parsed)) {
      setStatus("Enter a valid USD number (negative = net outflows).");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      await submit({
        value_usd: parsed,
        note: note || undefined,
        admin_token: adminToken || undefined,
        actor: actorName || undefined,
      });
      setStatus("Saved — triggers will re-evaluate shortly.");
      setValue("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface mt-4 px-5 py-4">
      <p className="text-eyebrow">MANUAL ETF FLOWS (6M USD)</p>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft">
        CoinGlass/Blockworks API key not configured — enter cumulative 6-month spot ETF net
        flows in USD (negative = net outflows). Updates trigger T1.3.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-dim">
            6M cumulative USD
          </span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="-250000000"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="border border-[color:var(--line)] bg-[color:var(--bg-2)] px-3 py-2 font-mono text-sm text-ink"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-dim">
            Note (optional)
          </span>
          <input
            type="text"
            placeholder="Farside 2026-05-23"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="border border-[color:var(--line)] bg-[color:var(--bg-2)] px-3 py-2 font-mono text-sm text-ink"
          />
        </label>
        <button type="submit" className="btn shrink-0" disabled={busy}>
          {busy ? "saving…" : "save weekly value"}
        </button>
      </form>
      {status ? <p className="mt-2 font-mono text-xs text-muted">{status}</p> : null}
      <p className="mt-3 text-[10px] text-dim">
        Set <code className="text-muted">COINGLASS_API_KEY</code> in Convex env to automate.
      </p>
    </section>
  );
}
