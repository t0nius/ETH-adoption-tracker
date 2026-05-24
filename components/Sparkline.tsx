"use client";

import { useMemo } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";
import {
  downsamplePoints,
  filterHistoryByDays,
  formatAxisValue,
  formatTooltipDate,
} from "@/lib/chartFormat";

export type SparkPoint = { timestamp: number; value: number | null };

function MiniTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: number;
}) {
  if (!active || !payload?.length || typeof label !== "number") return null;
  const v = payload[0]?.value;
  return (
    <div className="border border-[color:var(--line-bright)] bg-[color:var(--bg-0)] px-1.5 py-1 font-mono text-[10px] text-ink">
      <span className="text-muted">{formatTooltipDate(label, 30)} · </span>
      <span className="tabular">
        {typeof v === "number" ? formatAxisValue(v) : "—"}
      </span>
    </div>
  );
}

export function Sparkline({
  data,
  height = 40,
  days = 30,
}: {
  data: SparkPoint[];
  height?: number;
  days?: number;
  color?: string;
}) {
  const points = useMemo(() => {
    const filtered = filterHistoryByDays(
      data.filter((p): p is { timestamp: number; value: number } => p.value !== null),
      days,
    ).sort((a, b) => a.timestamp - b.timestamp);
    return downsamplePoints(filtered, 60);
  }, [data, days]);

  if (points.length < 2) {
    return (
      <div
        className="flex items-center font-mono text-[10px] text-dim"
        style={{ height }}
        aria-hidden
      >
        n&lt;2
      </div>
    );
  }

  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pad = (max - min) * 0.08 || 1;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points} margin={{ top: 3, right: 0, bottom: 3, left: 0 }}>
        <YAxis hide domain={[min - pad, max + pad]} />
        <Tooltip content={<MiniTooltip />} />
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--ink-soft)"
          strokeWidth={1.25}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
