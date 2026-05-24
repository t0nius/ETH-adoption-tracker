import Link from "next/link";

/** Surfaces gaps for ETF flows and validator queue (manual sub-conditions). */
export function ManualDataBanner() {
  return (
    <section className="surface mt-4 px-5 py-4">
      <p className="text-eyebrow">MANUAL DATA REQUIRED</p>
      <p className="mt-2 max-w-3xl text-sm text-ink-soft">
        <strong className="text-ink">T1.3</strong> (ETF flows) and parts of{" "}
        <strong className="text-ink">T1.4</strong> (exit queue) have no reliable public API.
        Use manual toggles on the trigger radar after checking external sources — see{" "}
        <Link href="/methodology" className="text-ink underline">
          methodology
        </Link>{" "}
        and{" "}
        <code className="font-mono text-[10px] text-muted">MISSING_METRICS.md</code>.
      </p>
      <Link href="/triggers" className="btn mt-3 inline-flex">
        open trigger radar →
      </Link>
    </section>
  );
}
