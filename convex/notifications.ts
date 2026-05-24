import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { sendTelegramAlert } from "../lib/integrations/telegram";
import { sendResendEmail } from "../lib/integrations/resend";

type SnapshotRow = {
  metric_name: string;
  status: "ok" | "stale";
  value: number | null;
  formatted: string;
  unit?: string;
  source: string;
  timestamp: number;
  error?: string;
};

type TriggerRow = {
  trigger_name: string;
  tier: number;
  status: string;
  description: string;
  message: string;
  current_value: number | null;
  threshold_value: number | null;
  evaluated_at: number;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildWeeklyHtml(
  snaps: SnapshotRow[],
  triggers: TriggerRow[],
  appUrl: string | undefined,
): string {
  const now = new Date().toISOString().slice(0, 10);
  const link = appUrl
    ? `<p><a href="${appUrl}">Open dashboard →</a></p>`
    : "";
  const snapRows = snaps
    .map(
      (s) => `<tr>
        <td>${escapeHtml(s.metric_name)}</td>
        <td><b>${escapeHtml(s.formatted)}</b>${s.unit ? " " + escapeHtml(s.unit) : ""}</td>
        <td style="color: ${s.status === "ok" ? "#059669" : "#dc2626"}">${s.status}</td>
        <td style="color: #6b7280; font-size: 12px">${escapeHtml(s.source)}</td>
      </tr>`,
    )
    .join("");
  const triggerRows = triggers
    .map((t) => {
      const color =
        t.status === "triggered"
          ? "#dc2626"
          : t.status === "warning" || t.status === "partial"
            ? "#d97706"
            : t.status === "ok"
              ? "#059669"
              : "#6b7280";
      return `<tr>
        <td><code>${escapeHtml(t.trigger_name)}</code> <span style="color:#6b7280">(T${t.tier})</span></td>
        <td style="color:${color}; font-weight: 600">${escapeHtml(t.status)}</td>
        <td style="font-size: 13px">${escapeHtml(t.message)}</td>
      </tr>`;
    })
    .join("");
  return `<!doctype html>
<html><body style="font-family: -apple-system, system-ui, sans-serif; max-width: 720px; margin: auto; padding: 24px; color:#111">
<h1 style="margin-bottom: 4px">ETH Adoption Tracker — Weekly recap</h1>
<p style="color:#6b7280; margin-top: 0">${now}</p>
${link}

<h2 style="margin-top: 32px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px">Metrics (${snaps.length})</h2>
<table cellpadding="6" cellspacing="0" style="width:100%; border-collapse: collapse; font-size: 14px">
  <tr style="text-align:left; border-bottom: 1px solid #e5e7eb"><th>Name</th><th>Value</th><th>Status</th><th>Source</th></tr>
  ${snapRows}
</table>

<h2 style="margin-top: 32px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px">Invalidation triggers (${triggers.length})</h2>
<table cellpadding="6" cellspacing="0" style="width:100%; border-collapse: collapse; font-size: 14px">
  <tr style="text-align:left; border-bottom: 1px solid #e5e7eb"><th>Trigger</th><th>Status</th><th>Message</th></tr>
  ${triggerRows}
</table>

<p style="margin-top: 32px; color: #6b7280; font-size: 12px">
Sent by ETH Adoption Tracker · weekly cron (Mondays 09:00 UTC).
</p>
</body></html>`;
}

function buildWeeklyText(
  snaps: SnapshotRow[],
  triggers: TriggerRow[],
): string {
  const lines: string[] = [];
  lines.push(`ETH Adoption Tracker — Weekly recap (${new Date().toISOString().slice(0, 10)})`);
  lines.push("");
  lines.push(`Metrics:`);
  for (const s of snaps) {
    lines.push(`  ${s.metric_name}: ${s.formatted} ${s.unit ?? ""} [${s.status}]`);
  }
  lines.push("");
  lines.push(`Triggers:`);
  for (const t of triggers) {
    lines.push(`  T${t.tier} ${t.trigger_name}: ${t.status} — ${t.message}`);
  }
  return lines.join("\n");
}

export const sendWeeklyRecap = internalAction({
  args: {},
  returns: v.object({ sent: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx): Promise<{ sent: boolean; error?: string }> => {
    const snaps = (await ctx.runQuery(
      internal.snapshots._readLatestForRecap,
      {},
    )) as SnapshotRow[];
    const triggers = (await ctx.runQuery(
      internal.triggers._readAllForRecap,
      {},
    )) as TriggerRow[];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const html = buildWeeklyHtml(snaps, triggers, appUrl);
    const text = buildWeeklyText(snaps, triggers);
    const res = await sendResendEmail({
      subject: `ETH Tracker weekly — ${new Date().toISOString().slice(0, 10)}`,
      html,
      text,
    });
    return res;
  },
});

export const testTelegram = internalAction({
  args: { text: v.optional(v.string()) },
  returns: v.object({ sent: v.boolean(), error: v.optional(v.string()) }),
  handler: async (_ctx, args) => {
    return await sendTelegramAlert(
      args.text ?? "*ETH Adoption Tracker* — Telegram bot test message.",
    );
  },
});

// Exported for unit-testing the HTML builder without network I/O.
export const _internalBuilders = { buildWeeklyHtml, buildWeeklyText };
