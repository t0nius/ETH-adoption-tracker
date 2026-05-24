# ETH Adoption Tracker

On-chain & institutional adoption monitoring for Ethereum — long-term thesis dashboard with automated invalidation triggers (planned Phase 4).

Stack : **Next.js 14 (App Router)** + TypeScript + Tailwind + **Tremor** + **Convex** + **Recharts**. Phase 2 stores hourly snapshots in Convex and renders sparklines on every card.

## Live metrics (11 cards)

| # | Metric | Source |
|---|---|---|
| 1 | TPS (L1 + L2 aggregated) | growthepie `/v1/fundamentals.json` (txcount) |
| 2 | Stablecoin supply (Ethereum L1) | DeFiLlama `/stablecoinchains` |
| 3 | ETH burned (last 24h) | ultrasound.money `/v2/fees/burn-sums` |
| 4 | Staking ratio | ultrasound.money `effective-balance-sum` + `supply-over-time` |
| 5 | L2 TVL (aggregated) | L2Beat `/api/scaling/summary` |
| 6 | ETH/BTC ratio | CoinGecko `/simple/price` |
| 7 | Daily active addresses (L1+L2) | growthepie `/v1/fundamentals.json` (daa) |
| 8 | RWA share on Ethereum | DeFiLlama `/protocols` filtered `category=RWA` |
| 9 | Blobs in latest block | Public Eth RPC `eth_getBlockByNumber` |
| 10 | Strategic ETH Reserve (total) | strategicethreserve.xyz (RSC payload scrape) |
| 11 | ETH ecosystem share of DeFi TVL | DeFiLlama `/v2/chains` (L1 + 26 curated L2s / global) |

Card status badges:
- 🟢 **live** — snapshot OK and fresh
- 🟠 **aged** — snapshot OK but older than 24h (cron stalled?)
- 🔴 **stale** — last fetch failed (error shown in card footer)

Skipped (see [MISSING_METRICS.md](MISSING_METRICS.md)) : validator queue, ETF flows, CEX supply.

Full source validation (curl examples, JSON structures, rate limits) : [docs/sources_validation.md](docs/sources_validation.md).

## Optional integrations

All integrations no-op if env vars are missing — the dashboard runs fine without them.

| Env var (set via `npx convex env set`) | Purpose |
|---|---|
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | Alerts when a trigger transitions to `triggered` |
| `RESEND_API_KEY` + `NOTIFICATION_EMAIL` | Weekly HTML recap email (Mondays 09:00 UTC) |
| `NOTIFICATION_FROM` | Optional Resend From address (default `onboarding@resend.dev`) |
| `NEXT_PUBLIC_APP_URL` | Optional — adds an "Open dashboard" link to the weekly email |
| `MANUAL_TRIGGER_ADMIN_TOKEN` | Optional but recommended — required token for manual trigger toggles in `/triggers` |
| `EXPORT_API_TOKEN` | Optional — protects `/api/export` via `x-export-token` header or `?token=` query |

Test from the CLI :

```bash
npx convex run notifications:testTelegram '{}'
npx convex run notifications:sendWeeklyRecap '{}'
```

Bot Telegram : `@BotFather` → `/newbot`. Chat ID : forward a message to `@userinfobot`.
Resend : free tier 100 emails/day at https://resend.com.

## Bootstrap (one-time)

### 1. Install

```bash
npm install
```

### 2. Provision a Convex deployment

```bash
npx convex dev
```

Interactive. Signs you into Convex (browser), provisions a dev deployment, writes `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` to `.env.local`, and **overwrites** the placeholder `convex/_generated/` with real codegen. Keep this terminal open — it watches `convex/` and pushes function changes live.

### 3. Seed the dashboard

Open a second terminal:

```bash
# Run the hourly snapshot action once now so cards show data immediately
npx convex run jobs:snapshotAll '{}'

# Backfill 30 days of history for the 5 metrics with public history APIs
npx convex run jobs:backfillHistorical '{}'
```

After this, sparklines render for: TPS, stablecoins, L2 TVL, ETH/BTC, DAA. The other 4 metrics accumulate from the hourly cron over time.

### 4. Run the frontend

```bash
npm run dev          # http://localhost:3000
```

## Other commands

```bash
npm test             # vitest, 9 tests, mocked fetch
npm run build        # production build (requires placeholder stubs OR real codegen)
npm run lint
```

Re-run the snapshot manually anytime:

```bash
npx convex run jobs:snapshotAll '{}'
```

## Project layout

```
app/
  layout.tsx           # wraps in ConvexProvider via Providers
  providers.tsx        # "use client" — ConvexReactClient + env check
  page.tsx             # dashboard with grouped metrics + insights + source reliability
  methodology/page.tsx # docs: interpretation model, quality model, trigger governance
  globals.css
components/
  MetricCard.tsx       # rich decision card (quality, trigger context, synced periods)
  MetricTrendChart.tsx # area+line chart with threshold overlays
  InfoHint.tsx         # premium info tooltip component
convex/
  schema.ts            # metrics_snapshots table + by_metric_time index
  snapshots.ts         # latest/history + dashboardBundle + sourceHealth analytics
  jobs.ts              # internalActions: snapshotAll, backfillHistorical
  crons.ts             # hourly cron → snapshotAll
  _generated/          # placeholder stubs; overwritten by `npx convex dev`
lib/
  types.ts             # MetricResult shape + stale() helper
  format.ts            # fmtUSD / fmtNum / fmtPct
  sources/             # framework-agnostic fetchers, importable from Convex actions
    coingecko.ts
    defillama-stables.ts
    defillama-rwa.ts
    growthepie.ts      # fetch once + 2 sync extractors (TPS + DAA)
    l2beat.ts
    ultrasound.ts      # burn + staking ratio
    rpc-blob.ts        # 3 fallback RPC URLs
    index.ts           # getAllMetrics() for standalone use
__tests__/
  sources.test.ts      # 9 vitest tests, mocked fetch (happy + stale fallback)
docs/
  sources_validation.md
MISSING_METRICS.md
PHASE_1_RECAP.md
PHASE_2_RECAP.md
```

## Architecture (Phase 2)

```
   ┌──────────────────────┐
   │ Convex cron (hourly) │ ──► internal.jobs.snapshotAll
   └──────────────────────┘             │
                                        ▼
                             ┌─────────────────────┐
                             │ lib/sources/* fetch │ (9 sources in parallel)
                             └─────────────────────┘
                                        │
                                        ▼
                            ┌────────────────────────┐
                            │ metrics_snapshots table │
                            └────────────────────────┘
                                        │
                       ┌────────────────┴──────────────┐
                       ▼                                ▼
              ┌─────────────────┐            ┌────────────────────┐
              │ latestPerMetric │            │ historyForMetric   │
              │ (card values)   │            │ (30d sparklines)   │
              └─────────────────┘            └────────────────────┘
                       │                                │
                       └────────────┬───────────────────┘
                                    ▼
                          Next.js client (useQuery)
```

Convex queries are reactive: when the cron inserts a new snapshot, the dashboard updates without refresh.

## Vercel deployment

```bash
npm i -g vercel@latest
vercel link

# Vercel build must run convex deploy first to push functions + regen types.
# In Vercel project settings, override the Build Command to:
#   npx convex deploy --cmd 'next build'
# And set env var:
#   CONVEX_DEPLOY_KEY = <obtain via `npx convex deploy --preview-create` or dashboard>
# And the public client URL:
#   NEXT_PUBLIC_CONVEX_URL = <your prod Convex URL>

vercel deploy --prod
```

Reference: https://docs.convex.dev/production/hosting/vercel

## Phase progression

- [x] **Phase 0** — sources validation via curl
- [x] **Phase 1** — MVP read-only with 9 live metrics (server fetch)
- [x] **Phase 2** — Convex DB + hourly cron + 30d sparklines + backfill
- [x] **Phase 3** — SER scraping (no Playwright — RSC payload parse) + stale-by-age monitoring
- [x] **Phase 4** — 11 invalidation triggers + daily eval cron + `/triggers` page + T3 manual toggles
- [x] **Phase 5** — Telegram alerts on transition + weekly Resend recap + `/api/export` JSON
