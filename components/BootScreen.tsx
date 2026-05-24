"use client";

import { useEffect, useState } from "react";

export function BootScreen({
  message = "connecting to convex deployment...",
}: {
  message?: string;
}) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), 8000);
    return () => window.clearTimeout(t);
  }, []);

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  return (
    <main
      className="mx-auto min-h-[70vh] max-w-7xl px-4 py-12 sm:px-8"
      style={{ background: "var(--bg-0, #0a0a0a)", color: "var(--ink, #ededed)" }}
    >
      <p className="text-eyebrow">› BOOTING</p>
      <h1 className="mt-3 font-display text-4xl text-ink sm:text-5xl">
        ETH ADOPTION TRACKER
      </h1>
      <p className="mt-4 font-mono text-xs text-muted">{message}</p>

      {!convexUrl ? (
        <div className="surface mt-6 max-w-xl px-4 py-4 text-sm text-ink-soft">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-signal">
            Convex not configured
          </p>
          <p className="mt-2">
            Run <code className="text-ink">npx convex dev</code> once — it writes{" "}
            <code className="text-ink">NEXT_PUBLIC_CONVEX_URL</code> to{" "}
            <code className="text-ink">.env.local</code>, then restart{" "}
            <code className="text-ink">npm run dev</code>.
          </p>
        </div>
      ) : null}

      {slow ? (
        <div className="surface mt-6 max-w-xl px-4 py-4 text-sm text-ink-soft">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
            Still loading
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 font-mono text-[11px] text-muted">
            <li>Stop the dev server (Ctrl+C)</li>
            <li>
              Run <code className="text-ink">rm -rf .next && npm run dev</code> if styles
              look broken (white page)
            </li>
            <li>
              In another terminal: <code className="text-ink">npx convex dev</code>
            </li>
            <li>Hard refresh the browser (Cmd+Shift+R)</li>
          </ul>
        </div>
      ) : null}
    </main>
  );
}
