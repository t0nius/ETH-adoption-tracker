# ETH Adoption Tracker

Bloomberg-style dashboard for Ethereum adoption metrics, trigger invalidation rules, and data quality — backed by [Convex](https://convex.dev) and deployed on [Vercel](https://vercel.com).

## Stack

- **Next.js 14** (App Router)
- **Convex** — snapshots, triggers, cron ingestion
- **Recharts** — metric trends and sparklines
- **Tailwind CSS** — minimal monochrome UI (`--signal` for alerts only)

## Local development

```bash
npm install
npx convex dev          # terminal 1 — syncs functions + .env.local
npm run dev             # terminal 2 — http://localhost:3000
```

Or both in one command:

```bash
npm run dev:all
```

If the UI stays on **BOOTING** or styles 404:

```bash
npm run dev:clean
```

Hard-refresh the browser. Ensure `npx convex dev` is running.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run dev:all` | Convex dev + Next.js together |
| `npm run dev:clean` | Clear `.next` and start Next |
| `npm run build` | Production build |
| `npm test` | Vitest unit tests |
| `npm run lint` | ESLint |

## Environment variables

### Local (`.env.local` from `npx convex dev`)

- `NEXT_PUBLIC_CONVEX_URL` — Convex deployment URL

### Production (Vercel + Convex dashboard)

| Variable | Where | Purpose |
|----------|--------|---------|
| `MANUAL_TRIGGER_ADMIN_TOKEN` | Convex | Required in prod for manual trigger overrides |
| `EXPORT_API_TOKEN` | Vercel | Required in prod for `/api/export` |
| `TELEGRAM_BOT_TOKEN` | Convex | Optional alert bot |
| `TELEGRAM_CHAT_ID` | Convex | Optional alert destination |

Without the admin/export tokens in production, those endpoints return **503** instead of running open.

## Architecture notes

- **Dashboard** uses `snapshots.dashboardOverview` (bundles, sources, triggers, adoption + operational scores, fragile sources).
- **Four pillars** summary (Usage / Monetary / Institutional / Infrastructure) with drill-down anchors on the metric grid.
- **Board** — 14 visible metrics (Usage, Monetary, Institutional, Infrastructure). **T1.2** also uses hidden `eth_total_supply` snapshots (ultrasound.money).
- **Trigger badges**: AUTO · PARTIAL · MANUAL on each invalidation card.
- **History** is downsampled to daily points for charts; raw hourly snapshots are purged after **180 days** (weekly cron).
- **Scores** — Fundamentals (weighted trends, live only) vs Data health (coverage/freshness): `lib/regime.ts`. Triggers stay separate.

## Deployment

1. Push to GitHub; connect the repo on Vercel.
2. Link Convex: `npx convex deploy` (production deployment).
3. Set production env vars on Vercel and Convex.
4. CI runs `npm test`, `lint`, and `build` on push/PR (`.github/workflows/ci.yml`).

## License

Private / all rights reserved unless stated otherwise.
