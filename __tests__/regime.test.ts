import { describe, it, expect } from "vitest";
import {
  computeDataHealthScore,
  computeFundamentalScore,
  dataHealthLabel,
  fundamentalLabel,
  trendSubscore,
  PILLAR_WEIGHTS,
} from "../lib/regime";
import { BOARD_METRIC_COUNT } from "../lib/product";

describe("data health score", () => {
  it("returns 100 when all metrics live and fresh", () => {
    const score = computeDataHealthScore({
      liveCount: BOARD_METRIC_COUNT,
      totalMetrics: BOARD_METRIC_COUNT,
      staleCount: 0,
      agedCount: 0,
    });
    expect(score).toBe(100);
    expect(dataHealthLabel(score)).toBe("SOLID");
  });

  it("penalizes stale metrics but not triggers", () => {
    const score = computeDataHealthScore({
      liveCount: BOARD_METRIC_COUNT - 2,
      totalMetrics: BOARD_METRIC_COUNT,
      staleCount: 2,
      agedCount: 0,
    });
    // ~86% coverage minus 20 stale penalty
    expect(score).toBeLessThan(90);
    expect(score).toBeGreaterThan(60);
  });
});

describe("fundamental score", () => {
  it("ignores eth_btc and stale metrics", () => {
    const score = computeFundamentalScore([
      {
        metric_name: "eth_btc",
        status: "ok",
        delta30: -50,
      },
      {
        metric_name: "etf_flows_6m_usd",
        status: "stale",
        delta30: -99,
      },
      {
        metric_name: "tps_l1_l2",
        status: "ok",
        delta30: 8,
      },
      {
        metric_name: "ser_total_eth",
        status: "ok",
        delta30: 5,
      },
    ]);
    expect(score).toBeGreaterThan(65);
  });

  it("applies pillar weights (monetary + institutional dominate)", () => {
    expect(PILLAR_WEIGHTS.Monetary + PILLAR_WEIGHTS.Institutional).toBe(0.7);
  });

  it("penalizes tier 1/2 triggers", () => {
    const base = computeFundamentalScore([
      { metric_name: "tps_l1_l2", status: "ok", delta30: 5 },
    ]);
    const hit = computeFundamentalScore(
      [{ metric_name: "tps_l1_l2", status: "ok", delta30: 5 }],
      { tier12Triggered: 1 },
    );
    expect(hit).toBe(base - 15);
  });

  it("labels weak fundamentals below 35", () => {
    expect(fundamentalLabel(20)).toBe("WEAK");
  });
});

describe("trendSubscore", () => {
  it("rewards upward preferred trends", () => {
    expect(trendSubscore("up", 10)).toBeGreaterThan(trendSubscore("up", -10));
  });
});
