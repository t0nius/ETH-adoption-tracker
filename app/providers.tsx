"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useMemo } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;

  const client = useMemo(() => {
    if (!url) return null;
    return new ConvexReactClient(url);
  }, [url]);

  if (!client) {
    return (
      <div
        className="mx-auto mt-10 max-w-3xl border border-[color:var(--line)] bg-[color:var(--bg-1)] p-8 text-sm"
        style={{ background: "var(--bg-1, #111)", color: "var(--ink-soft, #b3b3b3)" }}
      >
        <h1 className="font-display mb-3 text-2xl font-semibold text-ink">
          Convex not configured
        </h1>
        <p className="mb-2 text-muted">
          <code className="text-ink-soft">NEXT_PUBLIC_CONVEX_URL</code> is not set.
        </p>
        <p className="mb-2 text-muted">
          Run <code className="text-ink-soft">npx convex dev</code> once to provision a
          deployment. It writes <code className="text-ink-soft">.env.local</code>{" "}
          automatically.
        </p>
        <p className="text-muted">
          Then <code className="text-ink-soft">npm run dev</code>.
        </p>
      </div>
    );
  }

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
