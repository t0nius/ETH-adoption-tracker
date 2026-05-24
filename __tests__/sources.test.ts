import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

import { getEthBtc } from "../lib/sources/coingecko";
import { getStablecoinSupplyEthereum } from "../lib/sources/defillama-stables";
import { getRwaShareEthereum } from "../lib/sources/defillama-rwa";
import { getL2Tvl } from "../lib/sources/l2beat";
import { getBurnRateDaily, getStakingRatio } from "../lib/sources/ultrasound";
import { getNetIssuanceDaily, getSupplyInflationAnnualized } from "../lib/sources/supply-metrics";
import { getValidatorQueueRatio } from "../lib/sources/beaconcha-queue";
import { getEtfFlows6mUsd } from "../lib/sources/etf-flows";
import { getBlobCountLatest } from "../lib/sources/rpc-blob";
import { getSerTotalEth, aggregate } from "../lib/sources/ser";

function mockFetch(handler: (url: string) => unknown) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const body = handler(url);
    return {
      ok: true,
      status: 200,
      json: async () => body,
    } as Response;
  });
}

describe("data sources — happy path with mocked fetch", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("CoinGecko ETH/BTC parses ratio", async () => {
    global.fetch = mockFetch(() => ({
      ethereum: { usd: 2100, btc: 0.0275 },
      bitcoin: { usd: 76000, btc: 1 },
    })) as unknown as typeof fetch;
    const r = await getEthBtc();
    expect(r.status).toBe("ok");
    expect(r.value).toBe(0.0275);
  });

  it("DeFiLlama stablecoins picks Ethereum.peggedUSD", async () => {
    global.fetch = mockFetch(() => [
      { name: "Solana", totalCirculatingUSD: { peggedUSD: 1 } },
      { name: "Ethereum", totalCirculatingUSD: { peggedUSD: 162_000_000_000 } },
    ]) as unknown as typeof fetch;
    const r = await getStablecoinSupplyEthereum();
    expect(r.status).toBe("ok");
    expect(r.value).toBe(162_000_000_000);
  });

  it("DeFiLlama RWA computes Ethereum share %", async () => {
    global.fetch = mockFetch(() => [
      { name: "A", category: "RWA", tvl: 100, chainTvls: { Ethereum: 50 } },
      { name: "B", category: "RWA", tvl: 200, chainTvls: { Ethereum: 100 } },
      { name: "C", category: "Lending", tvl: 999, chainTvls: { Ethereum: 999 } },
    ]) as unknown as typeof fetch;
    const r = await getRwaShareEthereum();
    expect(r.status).toBe("ok");
    expect(r.value).toBe(50); // (50+100)/(100+200)*100
  });

  it("L2Beat sums last data row native+canonical+external", async () => {
    global.fetch = mockFetch(() => ({
      chart: {
        types: ["timestamp", "native", "canonical", "external", "ethPrice"],
        data: [
          [1, 1, 1, 1, 1],
          [2, 10, 20, 30, 2000],
        ],
      },
    })) as unknown as typeof fetch;
    const r = await getL2Tvl();
    expect(r.status).toBe("ok");
    expect(r.value).toBe(60);
  });

  it("ultrasound burn rate reads d1.sum.eth", async () => {
    global.fetch = mockFetch(() => ({
      d1: { sum: { eth: 30.5, usd: 65000 } },
      d7: { sum: { eth: 200, usd: 0 } },
      d30: { sum: { eth: 800, usd: 0 } },
    })) as unknown as typeof fetch;
    const r = await getBurnRateDaily();
    expect(r.status).toBe("ok");
    expect(r.value).toBe(30.5);
  });

  it("ultrasound staking ratio combines staked + supply", async () => {
    global.fetch = mockFetch((url) => {
      if (url.includes("effective-balance-sum")) {
        return { sum: 30_000_000 * 1e9, timestamp: "x" }; // 30M ETH staked
      }
      if (url.includes("supply-over-time")) {
        return { d1: [{ supply: 120_000_000, timestamp: "x" }] };
      }
      return {};
    }) as unknown as typeof fetch;
    const r = await getStakingRatio();
    expect(r.status).toBe("ok");
    expect(r.value).toBeCloseTo(25, 2); // 30/120 = 25%
  });

  it("SER aggregate filters by status=ACTIVE and supply cap", () => {
    const r = aggregate([
      { name: "A", status: "ACTIVE", category: "X", currentReserve: 100 },
      { name: "B", status: "ACTIVE", category: "X", currentReserve: 250 },
      { name: "C", status: "INACTIVE", category: "X", currentReserve: 999 },
      { name: "D", status: "ACTIVE", category: "Y", currentReserve: 99_999_999 }, // > 10M cap
      { name: "E", status: "IN_REVIEW", category: "X", currentReserve: 50 },
    ]);
    expect(r.totalEth).toBe(350);
    expect(r.activeCount).toBe(2);
    expect(r.byCategory).toEqual({ X: 350 });
    expect(r.top5[0]).toEqual({ name: "B", category: "X", currentReserve: 250 });
  });

  it("SER scraper parses companies array from RSC HTML chunks", async () => {
    const innerJson = JSON.stringify({
      something: 0,
      companies: [
        { id: "a", name: "Foo", status: "ACTIVE", category: "Treasuries", currentReserve: 1000 },
        { id: "b", name: "Bar", status: "INACTIVE", category: "Treasuries", currentReserve: 5000 },
        { id: "c", name: "Baz", status: "ACTIVE", category: "Blockchains", currentReserve: 250 },
      ],
      other: "x",
    });
    const escaped = JSON.stringify(innerJson).slice(1, -1); // JSON-escape only
    const html = `<html><body><script>self.__next_f.push([1,"${escaped}"])</script></body></html>`;

    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => html,
    })) as unknown as typeof fetch;

    const r = await getSerTotalEth();
    expect(r.status).toBe("ok");
    expect(r.value).toBe(1250);
    const meta = r.meta as { activeCount: number; byCategory: Record<string, number> };
    expect(meta.activeCount).toBe(2);
    expect(meta.byCategory).toEqual({ Treasuries: 1000, Blockchains: 250 });
  });

  it("RPC blob count parses blobGasUsed hex", async () => {
    // 0x60000 = 393216 gas = 3 blobs (393216 / 131072)
    global.fetch = mockFetch(() => ({
      result: { number: "0x1", blobGasUsed: "0x60000", excessBlobGas: "0x0" },
    })) as unknown as typeof fetch;
    const r = await getBlobCountLatest();
    expect(r.status).toBe("ok");
    expect(r.value).toBe(3);
  });

  it("supply net issuance from hourly d1 delta", async () => {
    const now = Date.now();
    const dayAgo = now - 86_400_000;
    global.fetch = mockFetch(() => ({
      d1: [
        { supply: 120_000_000, timestamp: new Date(dayAgo).toISOString() },
        { supply: 120_001_000, timestamp: new Date(now).toISOString() },
      ],
      since_merge: [
        { supply: 119_000_000, timestamp: new Date(dayAgo - 180 * 86_400_000).toISOString() },
        { supply: 120_000_000, timestamp: new Date(dayAgo).toISOString() },
      ],
    })) as unknown as typeof fetch;
    const net = await getNetIssuanceDaily();
    expect(net.status).toBe("ok");
    expect(net.value).toBeCloseTo(1000, 0);
    const infl = await getSupplyInflationAnnualized();
    expect(infl.status).toBe("ok");
    expect(typeof infl.value).toBe("number");
  });

  it("validator queue ratio from beaconcha", async () => {
    const prevKey = process.env.BEACONCHAIN_API_KEY;
    process.env.BEACONCHAIN_API_KEY = "test-key";
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          deposit_queue: { balance: "32000000000000000000" },
          exit_queue: { balance: "64000000000000000000" },
        },
      }),
    })) as unknown as typeof fetch;
    const r = await getValidatorQueueRatio();
    process.env.BEACONCHAIN_API_KEY = prevKey;
    expect(r.status).toBe("ok");
    expect(r.value).toBeCloseTo(2, 2);
  });

  it("ETF 6M flows stale without API key", async () => {
    const prev = process.env.COINGLASS_API_KEY;
    delete process.env.COINGLASS_API_KEY;
    delete process.env.BLOCKWORKS_API_KEY;
    const r = await getEtfFlows6mUsd();
    process.env.COINGLASS_API_KEY = prev;
    expect(r.status).toBe("stale");
  });
});

describe("data sources — fallback to stale on failure", () => {
  let originalFetch: typeof fetch;
  beforeEach(() => {
    originalFetch = global.fetch;
  });
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns stale (not throws) when CoinGecko returns 500", async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    const r = await getEthBtc();
    expect(r.status).toBe("stale");
    expect(r.value).toBeNull();
    expect(r.error).toContain("500");
  });

  it("returns stale when stablecoin payload has no Ethereum entry", async () => {
    global.fetch = mockFetch(() => [
      { name: "Solana", totalCirculatingUSD: { peggedUSD: 1 } },
    ]) as unknown as typeof fetch;
    const r = await getStablecoinSupplyEthereum();
    expect(r.status).toBe("stale");
    expect(r.error).toContain("Ethereum.peggedUSD");
  });
});
