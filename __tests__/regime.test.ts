import { describe, it, expect } from "vitest";
import { computeRegimeScore, regimeLabel } from "../lib/regime";

describe("regime score", () => {
  it("returns high score when all live and no triggers", () => {
    const score = computeRegimeScore({
      liveCount: 11,
      totalMetrics: 11,
      staleCount: 0,
      agedCount: 0,
      triggeredCount: 0,
      warningCount: 0,
      noDataCount: 0,
    });
    expect(score).toBe(100);
    expect(regimeLabel(score)).toBe("CONSTRUCTIVE");
  });

  it("penalizes tripped triggers", () => {
    const score = computeRegimeScore({
      liveCount: 11,
      totalMetrics: 11,
      staleCount: 0,
      agedCount: 0,
      triggeredCount: 2,
      warningCount: 0,
      noDataCount: 0,
    });
    expect(score).toBeLessThan(60);
  });
});
