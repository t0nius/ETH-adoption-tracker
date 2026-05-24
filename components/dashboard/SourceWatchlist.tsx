import Link from "next/link";
import { METRIC_BY_NAME, type MetricName } from "@/lib/metrics";

type Row = {
  metric_name: string;
  qualityScore: number;
  staleRate7d: number;
  freshnessHours: number;
};

export function SourceWatchlist({ fragile }: { fragile: Row[] }) {
  if (fragile.length === 0) return null;
  return (
    <section className="surface section-gap">
      <header className="flex items-center justify-between border-b border-[color:var(--line)] px-4 py-2">
        <p className="text-eyebrow">SOURCE WATCHLIST · QUALITY &lt; 70</p>
        <p className="font-mono text-[10px] text-dim">{fragile.length} FRAGILE</p>
      </header>

      <div className="divide-y divide-[color:var(--line)] md:hidden">
        {fragile.map((s) => (
          <Link
            key={s.metric_name}
            href={`/metrics/${s.metric_name}`}
            className="block px-4 py-3 hover:bg-[color:var(--bg-2)]"
          >
            <p className="text-sm text-ink">
              {METRIC_BY_NAME[s.metric_name as MetricName]?.label ?? s.metric_name}
            </p>
            <p className="mt-1 font-mono text-[10px] tabular text-muted">
              Q {s.qualityScore}/100 · stale {s.staleRate7d}% · {s.freshnessHours.toFixed(1)}h
            </p>
          </Link>
        ))}
      </div>

      <table className="hidden w-full font-mono text-xs md:table">
        <thead>
          <tr className="border-b border-[color:var(--line-dim)] text-dim">
            <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-[0.12em]">
              METRIC
            </th>
            <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-[0.12em]">
              QUALITY
            </th>
            <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-[0.12em]">
              STALE 7D
            </th>
            <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-[0.12em]">
              FRESHNESS
            </th>
          </tr>
        </thead>
        <tbody>
          {fragile.map((s) => (
            <tr
              key={s.metric_name}
              className="border-b border-[color:var(--line-dim)] hover:bg-[color:var(--bg-2)]"
            >
              <td className="px-4 py-2">
                <Link href={`/metrics/${s.metric_name}`} className="text-ink hover:underline">
                  {METRIC_BY_NAME[s.metric_name as MetricName]?.label ?? s.metric_name}
                </Link>
              </td>
              <td className="px-4 py-2 text-right tabular text-watch">{s.qualityScore}/100</td>
              <td className="px-4 py-2 text-right tabular text-muted">{s.staleRate7d}%</td>
              <td className="px-4 py-2 text-right tabular text-muted">
                {s.freshnessHours.toFixed(1)}h
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
