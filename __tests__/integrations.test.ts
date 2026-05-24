import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  sendTelegramAlert,
  formatTriggerAlert,
} from "../lib/integrations/telegram";
import { sendResendEmail } from "../lib/integrations/resend";

describe("Telegram integration", () => {
  let originalFetch: typeof fetch;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalEnv = { ...process.env };
  });
  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("no-ops when env vars are missing", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    const r = await sendTelegramAlert("hi");
    expect(r.sent).toBe(false);
    expect(r.error).toBe("not configured");
  });

  it("posts to api.telegram.org/sendMessage when configured", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "abc:123";
    process.env.TELEGRAM_CHAT_ID = "42";
    const mock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => "ok",
    }));
    global.fetch = mock as unknown as typeof fetch;
    const r = await sendTelegramAlert("test");
    expect(r.sent).toBe(true);
    expect(mock).toHaveBeenCalledOnce();
    const [url, opts] = mock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/botabc:123/sendMessage");
    const body = JSON.parse((opts.body as string) ?? "{}");
    expect(body.chat_id).toBe("42");
    expect(body.text).toBe("test");
    expect(body.parse_mode).toBe("Markdown");
  });

  it("returns error info on HTTP failure", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "abc:123";
    process.env.TELEGRAM_CHAT_ID = "42";
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 400,
      text: async () => "bad request body",
    })) as unknown as typeof fetch;
    const r = await sendTelegramAlert("test");
    expect(r.sent).toBe(false);
    expect(r.error).toContain("400");
  });

  it("formatTriggerAlert puts tier-specific icon and structure", () => {
    const text = formatTriggerAlert({
      trigger_name: "T1.4_test",
      tier: 1,
      message: "drop 30%",
      description: "Staking down >25%",
    });
    expect(text).toContain("🚨");
    expect(text).toContain("*T1.4_test*");
    expect(text).toContain("TRIGGERED");
    expect(text).toContain("Tier 1");

    const t2 = formatTriggerAlert({
      trigger_name: "T2.8",
      tier: 2,
      message: "x",
      description: "y",
    });
    expect(t2).toContain("⚠️");
  });
});

describe("Resend integration", () => {
  let originalFetch: typeof fetch;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalEnv = { ...process.env };
  });
  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("no-ops when RESEND_API_KEY or NOTIFICATION_EMAIL missing", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.NOTIFICATION_EMAIL;
    const r = await sendResendEmail({ subject: "x", html: "<p>x</p>" });
    expect(r.sent).toBe(false);
    expect(r.error).toBe("not configured");
  });

  it("posts to api.resend.com/emails with bearer auth", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.NOTIFICATION_EMAIL = "me@example.com";
    process.env.NOTIFICATION_FROM = "tracker@example.com";
    const mock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => "ok",
      json: async () => ({ id: "abc123" }),
    }));
    global.fetch = mock as unknown as typeof fetch;
    const r = await sendResendEmail({
      subject: "weekly",
      html: "<h1>ok</h1>",
      text: "ok",
    });
    expect(r.sent).toBe(true);
    expect(r.id).toBe("abc123");
    const [url, opts] = mock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((opts.headers as Record<string, string>).Authorization).toBe(
      "Bearer re_test",
    );
    const body = JSON.parse((opts.body as string) ?? "{}");
    expect(body.to).toEqual(["me@example.com"]);
    expect(body.from).toBe("tracker@example.com");
    expect(body.subject).toBe("weekly");
  });
});
