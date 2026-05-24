type Row = {
  metric_name: string;
  qualityScore: number;
  staleRate7d: number;
  freshnessHours: number;
};

export function SourceWatchlist({ fragile }: { fragile: Row[] }) {
  if (fragile.length === 0) return null;
  return (
    <section className="surface mt-4">
      <header className="flex items-center justify-between border-b border-[color:var(--line)] px-4 py-2">
        <p className="text-eyebrow">SOURCE WATCHLIST · QUALITY &lt; 70</p>
        <p className="font-mono text-[10px] text-dim">{fragile.length} FRAGILE</p>
      </header>
      <table className="w-full font-mono text-xs">
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
              <td className="px-4 py-2 text-ink">{s.metric_name}</td>
              <td className="px-4 py-2 text-right tabular text-ink-soft">
                {s.qualityScore}/100
              </td>
              <td className="px-4 py-2 text-right tabular text-muted">
                {s.staleRate7d}%
              </td>
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
