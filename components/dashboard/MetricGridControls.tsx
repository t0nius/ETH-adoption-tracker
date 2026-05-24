export type Period = 7 | 30 | 90 | 365;
export type SortMode = "group" | "status";

export function periodLabel(p: Period) {
  if (p === 7) return "7D";
  if (p === 30) return "30D";
  if (p === 90) return "90D";
  return "1Y";
}

export function MetricGridControls({
  period,
  sortMode,
  onPeriod,
  onSort,
}: {
  period: Period;
  sortMode: SortMode;
  onPeriod: (p: Period) => void;
  onSort: (m: SortMode) => void;
}) {
  return (
    <section className="surface mt-5 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <p className="w-full font-mono text-[10px] text-dim sm:w-auto">
        Viewing <span className="text-ink-soft">{periodLabel(period)}</span> on all
        metric charts
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-eyebrow mr-1">WINDOW</span>
        {([7, 30, 90, 365] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPeriod(p)}
            className={`btn ${period === p ? "btn-active" : ""}`}
          >
            {periodLabel(p)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-eyebrow mr-1">SORT</span>
        <button
          type="button"
          onClick={() => onSort("group")}
          className={`btn ${sortMode === "group" ? "btn-active" : ""}`}
        >
          by group
        </button>
        <button
          type="button"
          onClick={() => onSort("status")}
          className={`btn ${sortMode === "status" ? "btn-active" : ""}`}
        >
          by status
        </button>
      </div>
    </section>
  );
}
