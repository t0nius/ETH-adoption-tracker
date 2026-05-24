export function QualityGauge({
  score,
  segments = 8,
}: {
  score: number;
  segments?: number;
}) {
  const filled = Math.round((Math.max(0, Math.min(100, score)) / 100) * segments);
  return (
    <div
      className="flex items-center gap-1.5"
      title={`Data quality ${score}/100`}
    >
      <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-dim">Q</span>
      <div className="flex gap-[2px]">
        {Array.from({ length: segments }).map((_, i) => (
          <span
            key={i}
            className="block h-3 w-[3px]"
            style={{
              background: i < filled ? "var(--ink-soft)" : "var(--faint)",
            }}
          />
        ))}
      </div>
      <span className="hidden font-mono tabular text-[10px] text-muted sm:inline">
        {Math.round(score)}
      </span>
    </div>
  );
}
