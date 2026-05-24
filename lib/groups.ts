import type { MetricGroup } from "@/lib/metrics";

export type GroupTheme = {
  label: string;
  blurb: string;
  glyph: string;
};

/**
 * Monochrome groups — no color, only a numeric prefix to anchor sections.
 * Color carries data meaning (up/down); grouping carries semantic meaning.
 */
export const GROUP_THEME: Record<MetricGroup, GroupTheme> = {
  Usage:          { label: "Usage",          blurb: "User and throughput traction",            glyph: "01" },
  Monetary:       { label: "Monetary",       blurb: "Monetary quality and value capture",      glyph: "02" },
  Institutional:  { label: "Institutional",  blurb: "Institutional adoption and dominance",    glyph: "03" },
  Infrastructure: { label: "Infrastructure", blurb: "Blockspace demand and execution pressure", glyph: "04" },
};

export const GROUP_ORDER: MetricGroup[] = [
  "Usage",
  "Monetary",
  "Institutional",
  "Infrastructure",
];
