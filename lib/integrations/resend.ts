/**
 * Resend email sender (transactional).
 *
 * Doc: https://resend.com/docs/api-reference/emails/send-email
 * Free tier: 100 emails/day, 3000/month
 *
 * Env vars (set via `npx convex env set`):
 *   RESEND_API_KEY        — re_ABC123…
 *   NOTIFICATION_EMAIL    — recipient address
 *   NOTIFICATION_FROM     — optional, defaults to "onboarding@resend.dev"
 *                           (use your own verified domain in production)
 *
 * No-ops gracefully when env vars are missing.
 */

export type ResendResult = { sent: boolean; id?: string; error?: string };

export async function sendResendEmail(args: {
  subject: string;
  html: string;
  text?: string;
}): Promise<ResendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFICATION_EMAIL;
  const from = process.env.NOTIFICATION_FROM ?? "onboarding@resend.dev";
  if (!apiKey || !to) {
    return { sent: false, error: "not configured" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { sent: false, error: `HTTP ${res.status}: ${body.slice(0, 300)}` };
    }
    const data = (await res.json()) as { id?: string };
    return { sent: true, id: data.id };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}
