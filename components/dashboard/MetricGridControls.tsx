export type Period = 7 | 30 | 90 | 365;
export type SortMode = "group" | "status";
export type GridMode = "compact" | "detailed";

export const GRID_MODE_STORAGE_KEY = "eth-tracker-grid-mode";

export function periodLabel(p: Period) {
  if (p === 7) return "7D";
  if (p === 30) return "30D";
  if (p === 90) return "90D";
  return "1Y";
}

export function MetricGridControls({
  period,
  sortMode,
  gridMode,
  onPeriod,
  onSort,
  onGridMode,
}: {
  period: Period;
  sortMode: SortMode;
  gridMode: GridMode;
  onPeriod: (p: Period) => void;
  onSort: (m: SortMode) => void;
  onGridMode: (m: GridMode) => void;
}) {
  return (
    <section className="surface section-gap flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <p className="w-full font-mono text-[11px] text-dim sm:w-auto">
        Charts: <span className="text-ink-soft">{periodLabel(period)}</span>
        {" · "}
        View: <span className="text-ink-soft">{gridMode}</span>
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
        <span className="text-eyebrow mr-1">LAYOUT</span>
        <button
          type="button"
          onClick={() => onGridMode("compact")}
          className={`btn ${gridMode === "compact" ? "btn-active" : ""}`}
        >
          compact
        </button>
        <button
          type="button"
          onClick={() => onGridMode("detailed")}
          className={`btn ${gridMode === "detailed" ? "btn-active" : ""}`}
        >
          detailed
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-eyebrow mr-1">SORT</span>
        <button
          type="button"
          onClick={() => onSort("group")}
          className={`btn ${sortMode === "group" ? "btn-active" : ""}`}
        >
          group
        </button>
        <button
          type="button"
          onClick={() => onSort("status")}
          className={`btn ${sortMode === "status" ? "btn-active" : ""}`}
        >
          status
        </button>
      </div>
    </section>
  );
}
