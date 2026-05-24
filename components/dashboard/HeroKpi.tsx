export function HeroKpi({
  label,
  value,
  sub,
  tone = "ink",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "ink" | "signal";
}) {
  const color = tone === "signal" ? "var(--signal)" : "var(--ink)";
  return (
    <div className="surface px-4 py-3.5">
      <p className="text-eyebrow">{label}</p>
      <p
        className="mt-2 font-mono tabular text-[28px] font-medium leading-none"
        style={{ color }}
      >
        {value}
      </p>
      {sub ? (
        <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-dim">
          {sub}
        </p>
      ) : null}
    </div>
  );
}
