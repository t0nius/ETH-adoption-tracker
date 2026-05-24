"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  type ChartPeriod,
  chartDomain,
  downsamplePoints,
  formatAxisValue,
  formatTooltipDate,
  seriesStats,
} from "@/lib/chartFormat";

type ChartPoint = {
  timestamp: number;
  value: number;
};

type ThresholdConfig = {
  value: number;
  label: string;
  breached?: boolean;
};

const AXIS_STYLE = {
  fontSize: 10,
  fill: "var(--ink-soft)",
  fontFamily: "var(--font-mono), monospace",
};

function ChartTooltip({
  active,
  payload,
  label,
  unit,
  period,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: number;
  unit?: string;
  period?: ChartPeriod;
}) {
  if (!active || !payload?.length || typeof label !== "number") return null;
  const v = payload[0]?.value;
  return (
    <div
      className="border border-[color:var(--line-bright)] bg-[color:var(--bg-0)] px-2.5 py-1.5 font-mono text-[11px]"
      style={{ color: "var(--ink)" }}
    >
      <p style={{ color: "var(--muted)", fontSize: 10, marginBottom: 2 }}>
        {formatTooltipDate(label, period)}
      </p>
      <p className="tabular font-medium">
        {typeof v === "number" && Number.isFinite(v) ? formatAxisValue(v, unit) : "—"}
      </p>
    </div>
  );
}

export function MetricTrendChart({
  points,
  threshold,
  height = 140,
  period,
  unit,
  avgLine,
  ariaLabel,
}: {
  points: ChartPoint[];
  color?: string;
  threshold?: ThresholdConfig;
  height?: number;
  period?: ChartPeriod;
  unit?: string;
  avgLine?: number | null;
  ariaLabel?: string;
}) {
  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);
  const plotted = downsamplePoints(sorted, 90);
  const values = plotted.map((p) => p.value);
  const stats = seriesStats(values);
  const domain = chartDomain(
    threshold
      ? [...values, threshold.value, ...(avgLine != null ? [avgLine] : [])]
      : values,
  );

  if (sorted.length < 2) {
    const found = sorted.length;
    const expected = period ?? 30;
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 border border-[color:var(--line-dim)] bg-[color:var(--bg-1)] text-center"
        style={{ height }}
        role="img"
        aria-label={ariaLabel ?? "Chart awaiting data"}
      >
        <p className="text-eyebrow">awaiting backfill</p>
        <p className="font-mono tabular text-[10px] text-dim">
          {found === 0 ? `0 / ${expected} daily` : `${found} / ${expected} daily`}
        </p>
      </div>
    );
  }

  const thresholdStroke = threshold?.breached ? "var(--signal)" : "var(--line-bright)";

  return (
    <div style={{ height }} role="img" aria-label={ariaLabel}>
      {stats ? (
        <div className="mb-1 flex justify-end gap-3 font-mono text-[9px] uppercase tracking-[0.1em] text-dim">
          <span>lo {formatAxisValue(stats.min, unit)}</span>
          <span>hi {formatAxisValue(stats.max, unit)}</span>
        </div>
      ) : null}
      <ResponsiveContainer width="100%" height={stats ? height - 16 : height}>
        <LineChart
          data={plotted}
          margin={{ top: 8, right: 12, bottom: 4, left: 4 }}
        >
          <CartesianGrid
            strokeDasharray="2 4"
            stroke="var(--line)"
            vertical={false}
          />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(ts) => formatTooltipDate(ts as number, period)}
            minTickGap={period === 7 ? 24 : 40}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={{ stroke: "var(--line)" }}
            height={22}
          />
          <YAxis
            domain={domain}
            tickFormatter={(v) => formatAxisValue(v as number, unit)}
            width={52}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            tickCount={4}
          />
          <Tooltip
            cursor={{
              stroke: "var(--line-bright)",
              strokeWidth: 1,
              strokeDasharray: "3 3",
            }}
            content={
              <ChartTooltip unit={unit} period={period} />
            }
          />
          {avgLine != null && Number.isFinite(avgLine) ? (
            <ReferenceLine
              y={avgLine}
              stroke="var(--dim)"
              strokeDasharray="4 4"
              strokeWidth={1}
              ifOverflow="extendDomain"
            />
          ) : null}
          {threshold ? (
            <ReferenceLine
              y={threshold.value}
              stroke={thresholdStroke}
              strokeDasharray="3 3"
              strokeWidth={1}
              ifOverflow="extendDomain"
              label={{
                position: "insideTopRight",
                value: threshold.label.length > 18
                  ? `${threshold.label.slice(0, 16)}…`
                  : threshold.label,
                fill: thresholdStroke,
                fontSize: 9,
                fontFamily: "var(--font-mono), monospace",
              }}
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--ink-soft)"
            strokeWidth={1.5}
            dot={false}
            activeDot={{
              r: 4,
              stroke: "var(--ink)",
              strokeWidth: 1,
              fill: "var(--bg-0)",
            }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
