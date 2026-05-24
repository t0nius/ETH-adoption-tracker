/**
 * Composite “regime” score (0–100) for the dashboard hero.
 * Heuristic only — not a trading signal. See methodology page for formula.
 */

export const REGIME_WEIGHTS = {
  coverageBase: 100,
  perStaleMetric: 7,
  perAgedMetric: 2,
  perTriggered: 22,
  perWarning: 10,
  perNoData: 1.5,
} as const;

export function regimeLabel(score: number): string {
  if (score >= 80) return "CONSTRUCTIVE";
  if (score >= 65) return "HEALTHY";
  if (score >= 50) return "MIXED";
  if (score >= 35) return "FRAGILE";
  return "HIGH RISK";
}

export function computeRegimeScore(input: {
  liveCount: number;
  totalMetrics: number;
  staleCount: number;
  agedCount: number;
  triggeredCount: number;
  warningCount: number;
  noDataCount: number;
}): number {
  const w = REGIME_WEIGHTS;
  const coverageRatio =
    input.totalMetrics > 0 ? input.liveCount / input.totalMetrics : 0;
  const triggerPenalty =
    input.triggeredCount * w.perTriggered +
    input.warningCount * w.perWarning +
    input.noDataCount * w.perNoData;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        coverageRatio * w.coverageBase -
          input.staleCount * w.perStaleMetric -
          input.agedCount * w.perAgedMetric -
          triggerPenalty,
      ),
    ),
  );
}
