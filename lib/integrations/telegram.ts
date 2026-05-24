/**
 * Telegram bot alert sender.
 *
 * Doc: https://core.telegram.org/bots/api#sendmessage
 * Bot creation: chat with @BotFather → /newbot → grab token
 * Chat ID: forward a message to @userinfobot, or call /getUpdates
 *
 * Env vars required (set via `npx convex env set`):
 *   TELEGRAM_BOT_TOKEN  — e.g. 123456:ABC-DEF1234ghIkl
 *   TELEGRAM_CHAT_ID    — e.g. 987654321 (positive for DMs, negative for groups)
 *
 * Both optional. If absent the sender no-ops and returns
 * { sent: false, error: "not configured" }.
 */

export type TelegramSendResult = { sent: boolean; error?: string };

export async function sendTelegramAlert(
  text: string,
): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return { sent: false, error: "not configured" };
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { sent: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function formatTriggerAlert(t: {
  trigger_name: string;
  tier: number;
  message: string;
  description: string;
}): string {
  const icon = t.tier === 1 ? "🚨" : t.tier === 2 ? "⚠️" : "🔶";
  const tierLabel =
    t.tier === 1
      ? "Tier 1 — 1 trigger = full exit"
      : t.tier === 2
        ? "Tier 2 — 2 simultaneous = exit"
        : "Tier 3 — manual";
  return `${icon} *${t.trigger_name}* TRIGGERED\n\n${t.description}\n\n${t.message}\n\n_${tierLabel}_`;
}
