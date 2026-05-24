import Link from "next/link";

/** Surfaces gaps when ETF or validator queue metrics are not live. */
export function ManualDataBanner({
  etfStale = true,
  queueStale = true,
}: {
  etfStale?: boolean;
  queueStale?: boolean;
}) {
  if (!etfStale && !queueStale) return null;

  return (
    <section className="surface mt-4 px-5 py-4">
      <p className="text-eyebrow">API KEYS OPTIONAL</p>
      <p className="mt-2 max-w-3xl text-sm text-ink-soft">
        {etfStale ? (
          <>
            <strong className="text-ink">T1.3</strong> ETF flows need{" "}
            <code className="font-mono text-[10px] text-muted">COINGLASS_API_KEY</code> in Convex
            — or use the manual USD field below.{" "}
          </>
        ) : null}
        {queueStale ? (
          <>
            <strong className="text-ink">T1.4</strong> exit queue needs{" "}
            <code className="font-mono text-[10px] text-muted">BEACONCHAIN_API_KEY</code> (free
            at beaconcha.in).{" "}
          </>
        ) : null}
        See{" "}
        <Link href="/methodology#manual-data" className="text-ink underline">
          methodology
        </Link>{" "}
        and <code className="font-mono text-[10px] text-muted">MISSING_METRICS.md</code>.
      </p>
    </section>
  );
}
