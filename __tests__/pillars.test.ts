import { describe, it, expect } from "vitest";
import { computePillarSummaries } from "../lib/pillars";

describe("pillar summaries", () => {
  it("returns four pillars in group order", () => {
    const pillars = computePillarSummaries([
      {
        metric_name: "tps_l1_l2",
        snapshot: { status: "ok", formatted: "100" },
        analytics: { qualityScore: 80, delta30: 5, freshnessHours: 2 },
      },
      {
        metric_name: "eth_btc",
        snapshot: { status: "ok", formatted: "0.05" },
        analytics: { qualityScore: 90, delta30: -10, freshnessHours: 1 },
      },
    ]);
    expect(pillars).toHaveLength(4);
    expect(pillars[0].group).toBe("Usage");
    expect(pillars[0].liveCount).toBe(1);
  });
});
