# Phase 2 — Récap

**Date** : 2026-05-22
**Statut** : ✅ Code complet. Bootstrap Convex à exécuter par l'utilisateur (`npx convex dev`).

## Décisions arrêtées avant Phase 2

1. **DB = Convex** (changement vs spec initiale Supabase) — schéma simple `metrics_snapshots`, queries réactives intégrées.
2. **Cron = Convex built-in** (vs Vercel Cron initialement prévu) — moins de moving parts, fonctionne même si le frontend Vercel est down.
3. **Backfill 30 jours en Phase 2** (priorité).

## Ce qui marche

### Convex backend (`convex/`)
- `schema.ts` : table `metrics_snapshots` avec champs `metric_name`, `value`, `status`, `timestamp`, `source`, `formatted`, `unit`, `error`, `metadata`. Index `by_metric_time` sur `[metric_name, timestamp]`.
- `snapshots.ts` :
  - `internalMutation insert` — insertion brute
  - `internalMutation insertIfMissing` — idempotent via lookup index (utilisé par le backfill pour qu'on puisse re-runner sans dupliquer)
  - `query latestPerMetric` — renvoie le dernier snapshot par `metric_name` (9 entrées max)
  - `query historyForMetric(metric_name, sinceMs)` — sparkline 30 jours
  - `internalQuery listMetricNames` + constante exportée `METRIC_NAMES`
- `jobs.ts` :
  - `internalAction snapshotAll` — fetch 9 sources en parallèle (growthepie partagé entre TPS et DAA via un seul fetch + 2 extracteurs synchrones), une mutation par metric
  - `internalAction backfillHistorical(days?)` — pompe 30 jours d'historique depuis 4 endpoints qui exposent l'historique (CoinGecko `/coins/ethereum/market_chart`, DeFiLlama `/stablecoincharts/Ethereum`, L2Beat `/api/scaling/summary`, growthepie `/v1/fundamentals.json`)
- `crons.ts` : `crons.hourly("snapshot-all-metrics-hourly", { minuteUTC: 0 }, internal.jobs.snapshotAll, {})`

### Frontend (`app/`, `components/`)
- `providers.tsx` (`"use client"`) — `ConvexReactClient` + écran d'erreur clean si `NEXT_PUBLIC_CONVEX_URL` manquant (ne crash plus le build prerender)
- `app/page.tsx` (`"use client"`, `dynamic="force-dynamic"`) — `useQuery(api.snapshots.latestPerMetric)` + loading state + empty-state cards "awaiting" pour les métriques pas encore snappées
- `components/MetricCard.tsx` (`"use client"`) — Tremor card + `useQuery(api.snapshots.historyForMetric)` pour la sparkline 30j ; fallback "history accumulating…" tant que < 2 points
- `components/Sparkline.tsx` (`"use client"`) — Recharts `LineChart` sans animation, formatter type-safe pour la tooltip

### lib/sources/ — refactor
- Toutes les options Next-spécifiques `next: { revalidate: ... }` retirées (Convex action runtime n'a pas ce type sur `RequestInit`)
- `growthepie.ts` réorganisé : export `fetchGrowthePieFundamentals()` (1 fetch) + `computeTpsAggregated()` / `computeDaaAggregated()` (extracteurs sync, sans side-effect). Évite le cache module-level qui était risqué dans un isolate Convex. Helper `computeDailySeries(records, metric_key, days)` pour le backfill.
- Compat helpers `getTpsAggregated()` / `getActiveAddressesAggregated()` conservés pour les tests Phase 1.
- `index.ts getAllMetrics()` toujours dispo pour usage standalone (non utilisé par le frontend en Phase 2).

### Build & tests
- `npm test` → **9/9 verts** (mêmes tests Phase 1, lib/sources gardés rétro-compatibles)
- `npm run build` → **compile OK**, route `/` statique, 234 kB First Load JS (vs 106 kB Phase 1 — l'écart c'est Recharts + ConvexReactClient + Convex SDK)

### Stubs `convex/_generated/` (workaround)
Le codegen Convex (`npx convex codegen`) refuse de tourner sans un `CONVEX_DEPLOYMENT` valide. Solution : 5 fichiers stubs écrits à la main dans `convex/_generated/` :
- `server.d.ts` / `server.js` : ré-exporte les builders génériques avec types liés à la `DataModel` (via `DataModelFromSchemaDefinition<typeof schema>`)
- `api.d.ts` / `api.js` : `anyApi` ; types permissifs (les bonnes types arriveront via vrai codegen)
- `dataModel.d.ts` : `Doc`, `Id`, `TableNames` typés depuis le schema

Le premier `npx convex dev` **écrase** ces stubs avec le vrai codegen typé — c'est attendu et inoffensif. Sans ces stubs, ni `tsc` ni `next build` ne compileraient. Avec, on a un projet livrable sans avoir besoin que l'utilisateur ait déjà fait le bootstrap.

## Ce qui ne marche pas (encore)

1. **Pas de cron exécuté tant que `npx convex dev` n'a pas tourné** — c'est attendu : Convex doit provisionner le déploiement avant. Tant que l'utilisateur ne lance pas `npx convex dev` + `convex run jobs:snapshotAll`, le dashboard affiche 9 cards "awaiting".
2. **Backfill incomplet** :
   - RWA share, burn rate, staking ratio, blob count : pas d'historique granulaire dispo via API publique → ces 4 sparklines ne se rempliront qu'au fil du cron (1 point/h, sparkline 30j visible après ~24h, complète après 30j).
   - Si tu veux quand même un backfill pour ces 4 : il faudrait soit Dune Analytics, soit garder un sampling RPC à plus haute fréquence. Hors scope Phase 2.
3. **Pas encore SSR pour le dashboard** : page est `"use client"` + `dynamic="force-dynamic"`. C'est OK car l'app est interne (1×/semaine), mais on perd les avantages SSR. Conversion en `preloadQuery` + `usePreloadedQuery` possible plus tard si besoin.
4. **Pas de tests Convex** — j'ai utilisé `convex-test` comme dépendance optionnelle mais les fonctions Convex sont du glue testé indirectement via `lib/sources` (qui sont, eux, testés à 9/9). Si tu veux des tests intégration Convex, on les ajoute en Phase 3.

## Bootstrap utilisateur (commandes à lancer maintenant)

```bash
# 1) Provision Convex dev deployment (interactive, signe-toi via le browser)
npx convex dev

# 2) Dans un autre terminal, seed les snapshots actuels (9 lignes)
npx convex run jobs:snapshotAll '{}'

# 3) Backfill 30j d'historique pour les 5 métriques avec historique public
npx convex run jobs:backfillHistorical '{}'

# 4) Lance le frontend
npm run dev   # http://localhost:3000
```

Le premier `npx convex dev` :
- Écrase `convex/_generated/` avec le vrai codegen typé (les stubs sont remplacés)
- Écrit `.env.local` avec `CONVEX_DEPLOYMENT` et `NEXT_PUBLIC_CONVEX_URL`
- Push les fonctions Convex et démarre le watcher

À partir de là, le cron horaire tourne tout seul sur ton déploiement dev Convex (24/7 même si Vercel ou ton laptop sont éteints).

## Sources / URLs Phase 2

Snapshot et backfill utilisent les mêmes endpoints que Phase 0, plus 4 endpoints d'historique pour le backfill :

| Métrique | Snapshot | Backfill 30j |
|---|---|---|
| TPS L1+L2 | growthepie `/v1/fundamentals.json` | idem (history déjà inclus dans payload) |
| Stables ETH L1 | DeFiLlama `/stablecoinchains` | DeFiLlama `/stablecoincharts/Ethereum` |
| Burn 24h | ultrasound.money `/burn-sums` | ❌ pas d'historique granulaire |
| Staking ratio | ultrasound.money `effective-balance-sum + supply-over-time` | ❌ |
| L2 TVL | L2Beat `/api/scaling/summary` | idem (chart array hourly) |
| ETH/BTC | CoinGecko `/simple/price` | CoinGecko `/coins/ethereum/market_chart` |
| DAA L1+L2 | growthepie `/v1/fundamentals.json` (daa) | idem |
| RWA share | DeFiLlama `/protocols` | ❌ (RWA history nécessiterait per-protocol fetch) |
| Blob count | Eth RPC `eth_getBlockByNumber` | ❌ (1 RPC par block, hors scope) |

## Question

OK pour passer à la **Phase 3 — Tier B sources (SER via Playwright)** ?
