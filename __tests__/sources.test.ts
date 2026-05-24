import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

import { getEthBtc } from "../lib/sources/coingecko";
import { getStablecoinSupplyEthereum } from "../lib/sources/defillama-stables";
import { getRwaShareEthereum } from "../lib/sources/defillama-rwa";
import { getL2Tvl } from "../lib/sources/l2beat";
import { getBurnRateDaily, getStakingRatio } from "../lib/sources/ultrasound";
import { getNetIssuanceDaily, getSupplyInflationAnnualized } from "../lib/sources/supply-metrics";
import { getValidatorQueueRatio } from "../lib/sources/beaconcha-queue";
import {
  getEtfFlows6mUsd,
  parseFarsideEtfHtml,
  parseFarsideMarkdown,
  parseFarsideJinaPlaintext,
  sumFarside6mUsd,
} from "../lib/sources/etf-flows";
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

  it("validator queue ratio from PublicNode without API key", async () => {
    const prevKey = process.env.BEACONCHAIN_API_KEY;
    delete process.env.BEACONCHAIN_API_KEY;
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("pending_initialized")) {
        return {
          ok: true,
          json: async () => ({
            data: [{ balance: "32000000000" }, { balance: "32000000000" }],
          }),
        };
      }
      if (url.includes("pending_queued")) {
        return { ok: true, json: async () => ({ data: [] }) };
      }
      if (url.includes("active_exiting")) {
        return {
          ok: true,
          json: async () => ({
            data: [{ balance: "64000000000" }],
          }),
        };
      }
      throw new Error(`unexpected url ${url}`);
    }) as unknown as typeof fetch;
    const r = await getValidatorQueueRatio();
    process.env.BEACONCHAIN_API_KEY = prevKey;
    expect(r.status).toBe("ok");
    expect(r.source).toContain("PublicNode");
    expect(r.value).toBeCloseTo(1, 2);
  });

  it("parses Farside ETF HTML and sums 6M window", () => {
    const now = Date.parse("22 May 2026");
    const html = `
      <table>
        <tr><td>22 May 2026</td><td>10.5</td><td>5.2</td><td>15.7</td></tr>
        <tr><td>21 May 2026</td><td>-2.0</td><td>1.0</td><td>(1.0)</td></tr>
        <tr><td>Total</td><td></td><td></td><td>100</td></tr>
      </table>
    `;
    const rows = parseFarsideEtfHtml(html);
    expect(rows).toHaveLength(2);
    const total = sumFarside6mUsd(rows, 180, now);
    expect(total).toBe(15_700_000 - 1_000_000);
  });

  it("parses Farside markdown table", () => {
    const now = Date.parse("22 May 2026");
    const md = `| 22 May 2026 | 1.0 | 2.0 | 3.5 |
| 21 May 2026 | (1.0) | 0.0 | (1.0) |`;
    const rows = parseFarsideMarkdown(md);
    expect(rows).toHaveLength(2);
    const total = sumFarside6mUsd(rows, 180, now);
    expect(total).toBe(2_500_000);
  });

  it("parses Farside jina plain-text blocks (all-data format)", () => {
    const now = Date.parse("26 Jul 2024");
    const text = `23 Jul 2024\t
266.5
\t
-
\t
71.3
\t
106.6

24 Jul 2024\t
17.4
\t
(133.3)
`;
    const rows = parseFarsideJinaPlaintext(text);
    expect(rows).toHaveLength(2);
    expect(rows[0].totalUsd).toBe(106_600_000);
    expect(rows[1].totalUsd).toBeCloseTo(-133_300_000, 0);
    const total = sumFarside6mUsd(rows, 180, now);
    expect(total).toBeCloseTo(106_600_000 - 133_300_000, 0);
  });

  it("ETF 6M flows from Farside jina plain-text fallback", async () => {
    const prevCg = process.env.COINGLASS_API_KEY;
    const prevBw = process.env.BLOCKWORKS_API_KEY;
    delete process.env.COINGLASS_API_KEY;
    delete process.env.BLOCKWORKS_API_KEY;
    const plain = `22 May 2026\t\n1.0\n\t\n2.5\n`;
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("jina.ai")) {
        return { ok: true, text: async () => plain };
      }
      return { ok: false, status: 403, text: async () => "" };
    }) as unknown as typeof fetch;
    const r = await getEtfFlows6mUsd();
    process.env.COINGLASS_API_KEY = prevCg;
    process.env.BLOCKWORKS_API_KEY = prevBw;
    expect(r.status).toBe("ok");
    expect(r.value).toBe(2_500_000);
  });

  it("ETF 6M flows from Farside jina markdown fallback", async () => {
    const prevCg = process.env.COINGLASS_API_KEY;
    const prevBw = process.env.BLOCKWORKS_API_KEY;
    delete process.env.COINGLASS_API_KEY;
    delete process.env.BLOCKWORKS_API_KEY;
    const md = `| 22 May 2026 | 1.0 | 2.5 |`;
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("jina.ai")) {
        return { ok: true, text: async () => md };
      }
      return { ok: true, text: async () => "<html>Just a moment...</html>" };
    }) as unknown as typeof fetch;
    const r = await getEtfFlows6mUsd();
    process.env.COINGLASS_API_KEY = prevCg;
    process.env.BLOCKWORKS_API_KEY = prevBw;
    expect(r.status).toBe("ok");
    expect(r.source).toContain("Farside");
    expect(r.value).toBe(2_500_000);
  });

  it("ETF 6M flows from Farside HTML without API key", async () => {
    const prevCg = process.env.COINGLASS_API_KEY;
    const prevBw = process.env.BLOCKWORKS_API_KEY;
    delete process.env.COINGLASS_API_KEY;
    delete process.env.BLOCKWORKS_API_KEY;
    const html = `<tr><td>22 May 2026</td><td>1.0</td><td>2.5</td></tr>`;
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("jina.ai")) {
        throw new Error("jina unavailable");
      }
      return { ok: true, text: async () => html };
    }) as unknown as typeof fetch;
    const r = await getEtfFlows6mUsd();
    process.env.COINGLASS_API_KEY = prevCg;
    process.env.BLOCKWORKS_API_KEY = prevBw;
    expect(r.status).toBe("ok");
    expect(r.value).toBe(2_500_000);
  });

  it("ETF 6M flows stale when all sources fail", async () => {
    const prevCg = process.env.COINGLASS_API_KEY;
    const prevBw = process.env.BLOCKWORKS_API_KEY;
    delete process.env.COINGLASS_API_KEY;
    delete process.env.BLOCKWORKS_API_KEY;
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("jina.ai")) {
        return { ok: true, text: async () => "Title: empty\n\nNo data here" };
      }
      return { ok: true, text: async () => "<html>Just a moment...</html>" };
    }) as unknown as typeof fetch;
    const r = await getEtfFlows6mUsd();
    process.env.COINGLASS_API_KEY = prevCg;
    process.env.BLOCKWORKS_API_KEY = prevBw;
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
