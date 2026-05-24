import { describe, it, expect } from "vitest";
import {
  evalT11,
  evalT12,
  evalT13,
  evalT14,
  evalT25,
  evalT26,
  evalT27,
  evalT28,
  evalManual,
} from "../lib/triggers";
import { findNewlyTriggered } from "../lib/triggers/transitions";
import type { Snapshot, TriggerEval } from "../lib/triggers/types";

const DAY = 86_400_000;
const today = Date.UTC(2026, 4, 22); // 2026-05-22

function daily(values: number[]): Snapshot[] {
  // values[0] is the OLDEST day. Last entry = today.
  return values.map((v, i) => ({
    timestamp: today - (values.length - 1 - i) * DAY,
    value: v,
    status: "ok" as const,
  }));
}

describe("trigger T1.1 — ETH defi share < 40%", () => {
  it("insufficient_data with < 180 days", () => {
    const hist = daily([45, 44, 43, 42]);
    const r = evalT11(hist);
    expect(r.status).toBe("insufficient_data");
    expect(r.current_value).toBe(42);
  });

  it("OK when share > 40%", () => {
    const hist = daily(Array(200).fill(55));
    const r = evalT11(hist);
    expect(r.status).toBe("ok");
    expect(r.current_value).toBe(55);
  });

  it("triggered when all 180 days < 40%", () => {
    const hist = daily(Array(200).fill(35));
    const r = evalT11(hist);
    expect(r.status).toBe("triggered");
  });

  it("warning when currently < 40% but not full 180 days", () => {
    const hist = daily([...Array(100).fill(45), ...Array(100).fill(35)]);
    const r = evalT11(hist);
    expect(r.status).toBe("warning");
    expect(r.metadata?.consecutive_days_under).toBe(100);
  });
});

describe("trigger T1.4 — staking ratio drop from peak", () => {
  it("ok when current within 25% of peak", () => {
    const hist = daily([30, 31, 32, 32, 30]);
    const r = evalT14(hist, null);
    expect(r.status).toBe("ok");
    // dropPct = (30-32)/32 = -6.25%
    expect(r.current_value).toBeCloseTo(-6.25, 1);
  });

  it("triggered when drop > 25%", () => {
    const hist = daily([32, 32, 32, 25, 22]);
    const r = evalT14(hist, null);
    expect(r.status).toBe("triggered");
    expect(r.current_value).toBeLessThan(-25);
  });

  it("triggered via exit queue manual flag even if ratio is fine", () => {
    const hist = daily([30, 32, 32]);
    const r = evalT14(hist, {
      is_triggered: true,
      toggled_at: today,
    });
    expect(r.status).toBe("triggered");
  });
});

describe("trigger T2.5/T2.6 — 12-month drop", () => {
  it("T2.5 insufficient_data with < 365 days", () => {
    const r = evalT25(daily(Array(100).fill(300)));
    expect(r.status).toBe("insufficient_data");
  });

  it("T2.5 triggered when TPS down 50% YoY", () => {
    const old = Array(180).fill(400);
    const recent = Array(190).fill(180);
    const r = evalT25(daily([...old, ...recent]));
    expect(r.status).toBe("triggered");
    expect(r.current_value).toBeLessThan(-40);
  });

  it("T2.6 ok when stables stable", () => {
    const r = evalT26(daily(Array(370).fill(150e9)));
    expect(r.status).toBe("ok");
    expect(r.current_value).toBeCloseTo(0, 1);
  });
});

describe("trigger T2.7 — blob plateau/decline", () => {
  it("insufficient_data with < 270 days", () => {
    const r = evalT27(daily(Array(100).fill(6)));
    expect(r.status).toBe("insufficient_data");
  });

  it("triggered when blobs plateau (within 5%)", () => {
    const r = evalT27(daily(Array(280).fill(6)));
    expect(r.status).toBe("triggered");
  });

  it("ok when blobs growing > 5%", () => {
    const old = Array(140).fill(4);
    const recent = Array(140).fill(8);
    const r = evalT27(daily([...old, ...recent]));
    expect(r.status).toBe("ok");
  });
});

describe("trigger T2.8 — RWA share < 50%", () => {
  it("ok when share ≥ 50%", () => {
    const r = evalT28(daily([55, 54, 55]));
    expect(r.status).toBe("ok");
    expect(r.current_value).toBe(55);
  });

  it("triggered when share < 50%", () => {
    const r = evalT28(daily([55, 49, 48]));
    expect(r.status).toBe("triggered");
    expect(r.current_value).toBe(48);
  });

  it("insufficient_data on empty history", () => {
    const r = evalT28([]);
    expect(r.status).toBe("insufficient_data");
  });
});

describe("trigger T1.3 — ETF flows AND SER drop", () => {
  it("insufficient_data without 180 days of SER", () => {
    const r = evalT13(daily([7000, 7100]), null);
    expect(r.status).toBe("insufficient_data");
  });

  it("partial when only SER drop met", () => {
    const old = Array(90).fill(8000);
    const recent = Array(100).fill(5000); // -37.5%
    const r = evalT13(daily([...old, ...recent]), null);
    expect(r.status).toBe("partial");
  });

  it("triggered when both ETF manual flag and SER drop ≥25%", () => {
    const old = Array(90).fill(8000);
    const recent = Array(100).fill(5000);
    const r = evalT13(daily([...old, ...recent]), {
      is_triggered: true,
      toggled_at: today,
    });
    expect(r.status).toBe("triggered");
  });
});

describe("trigger T1.2 — supply inflationary", () => {
  it("insufficient_data on empty history", () => {
    const r = evalT12([]);
    expect(r.status).toBe("insufficient_data");
  });
});

describe("findNewlyTriggered — transition detection for alerts", () => {
  const mkEval = (name: string, status: string): TriggerEval => ({
    trigger_name: name,
    tier: 1,
    description: "",
    status: status as TriggerEval["status"],
    message: "",
    current_value: null,
    threshold_value: null,
  });

  it("fires alert when going from ok → triggered", () => {
    const old = new Map([["t1", "ok"]]);
    const news = [mkEval("t1", "triggered")];
    expect(findNewlyTriggered(old, news).map((e) => e.trigger_name)).toEqual(["t1"]);
  });

  it("does NOT re-fire when already triggered", () => {
    const old = new Map([["t1", "triggered"]]);
    const news = [mkEval("t1", "triggered")];
    expect(findNewlyTriggered(old, news)).toEqual([]);
  });

  it("does not fire on warning/partial state", () => {
    const old = new Map([["t1", "ok"]]);
    const news = [mkEval("t1", "warning"), mkEval("t2", "partial")];
    expect(findNewlyTriggered(old, news)).toEqual([]);
  });

  it("fires on first-ever evaluation (no old state)", () => {
    const old = new Map<string, string>();
    const news = [mkEval("t1", "triggered"), mkEval("t2", "ok")];
    expect(findNewlyTriggered(old, news).map((e) => e.trigger_name)).toEqual(["t1"]);
  });
});

describe("evalManual — T3 manual triggers", () => {
  it("needs_manual when no toggle", () => {
    const r = evalManual("T3.9", 3, "test", null);
    expect(r.status).toBe("needs_manual");
  });

  it("triggered when manually flagged", () => {
    const r = evalManual("T3.9", 3, "test", {
      is_triggered: true,
      note: "incident X",
      toggled_at: today,
    });
    expect(r.status).toBe("triggered");
    expect(r.message).toContain("incident X");
  });

  it("needs_manual when toggled to NOT triggered", () => {
    const r = evalManual("T3.9", 3, "test", {
      is_triggered: false,
      toggled_at: today,
    });
    expect(r.status).toBe("needs_manual");
  });
});
