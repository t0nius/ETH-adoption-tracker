export const GLOSSARY = [
  {
    term: "RWA",
    def: "Real-world assets tokenized on-chain (treasury bills, private credit, etc.). Ethereum's share of global RWA TVL is tracked as rwa_eth_share.",
  },
  {
    term: "Blobs",
    def: "EIP-4844 blob transactions used by L2 rollups to post data to Ethereum. blob_count_latest measures utilization in the latest block.",
  },
  {
    term: "SER",
    def: "Strategic ETH Reserve — ETH held by public companies and treasuries tracked via strategicethreserve.xyz.",
  },
  {
    term: "ETF flows",
    def: "Net inflows/outflows into US spot ETH ETFs (6M cumulative). Auto via CoinGlass API or manual weekly USD input for T1.3.",
  },
  {
    term: "Exit queue",
    def: "Validators waiting to unstake ETH vs deposit queue. Auto via beaconcha.in API (BEACONCHAIN_API_KEY) for T1.4.",
  },
  {
    term: "Fundamentals score",
    def: "Weighted 30D trends on live metrics by pillar (Monetary/Institutional 35% each). Excludes stale data and ETH/BTC. Not a price forecast.",
  },
  {
    term: "Data health score",
    def: "Live metric coverage minus stale/aged penalties. Measures monitoring reliability — separate from trigger invalidation.",
  },
  {
    term: "PARTIAL",
    def: "Trigger where one sub-condition is auto-evaluated and another requires manual input (e.g. T1.3 ETF + SER).",
  },
] as const;
