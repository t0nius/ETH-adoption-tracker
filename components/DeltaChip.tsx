/** Compact delta — semantic grayscale accents. */
type Tone = "up" | "down" | "flat" | "na";

export function DeltaChip({
  label,
  value,
  preferred = "up",
  flatThreshold = 1,
}: {
  label: string;
  value: number | null;
  preferred?: "up" | "down" | "stable";
  flatThreshold?: number;
}) {
  let tone: Tone = "na";
  let text = "—";
  let sign = "";
  if (value !== null && Number.isFinite(value)) {
    const abs = Math.abs(value);
    text = `${abs.toFixed(abs >= 100 ? 0 : 1)}%`;
    sign = value > 0 ? "+" : value < 0 ? "−" : "";

    if (abs < flatThreshold) {
      tone = "flat";
    } else if (preferred === "stable") {
      tone = abs > 8 ? "down" : "flat";
    } else {
      const isGood = preferred === "up" ? value > 0 : value < 0;
      tone = isGood ? "up" : "down";
    }
  }
  const cls =
    tone === "up"
      ? "delta-up"
      : tone === "down"
        ? "delta-down"
        : tone === "flat"
          ? "delta-flat"
          : "delta-na";

  return (
    <span className={`delta ${cls}`}>
      <span className="lbl">{label}</span>
      <span>{tone === "na" ? "—" : `${sign}${text}`}</span>
    </span>
  );
}
