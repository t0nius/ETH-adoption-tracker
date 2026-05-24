# Phase 4 — Récap

**Date** : 2026-05-22
**Statut** : ✅ Architecture complète. La plupart des triggers seront en `insufficient_data` tant que le cron horaire n'a pas accumulé l'historique requis (6 à 12 mois selon les triggers).

## Ce qui marche

### Nouvelle métrique snapshotée
- `eth_defi_share` — part ETH ecosystem (L1 + 26 L2s curatés) dans la TVL DeFi globale (DeFiLlama `/v2/chains`)
- Au 2026-05-22 : **62.1 %** (largement au-dessus du seuil 40 %)
- Source `lib/sources/defillama-eth-share.ts`, ajoutée à `snapshotAll` et à `METRIC_NAMES`
- 11ème card sur le dashboard

### Couche triggers (architecture pure → testable)
- `lib/triggers/types.ts` — types `Snapshot`, `ManualState`, `TriggerEval`, `TriggerStatus`
- `lib/triggers/helpers.ts` — `clean`, `bucketDailyLast`, `daysCovered`, `pointAtOrAfter`
- `lib/triggers/index.ts` — 8 evaluators T1/T2 + `evalManual` pour T3, **purement fonctionnels** (pas d'I/O, prennent un array de Snapshots, renvoient un TriggerEval)

### Couche Convex
- `convex/schema.ts` — 2 nouvelles tables : `triggers_state` (1 row par trigger, indexée `by_name`), `triggers_manual` (1 row par trigger T3 ou sub-cond, indexée `by_name`)
- `convex/triggers.ts` :
  - `internalQuery _readHistory` / `_readManualState` — lectures pour l'action
  - `internalMutation _upsertState` — patch ou insert idempotent
  - `internalAction evaluateAll` — lance les 11 évaluations en parallèle, persiste tout
  - `query listTriggers` — frontend public, trié par tier
  - `mutation setManualTrigger` — frontend public, toggle T3 et sub-conditions T1.3/T1.4
- `convex/crons.ts` — cron daily à 01:30 UTC qui appelle `internal.triggers.evaluateAll`

### Frontend
- `app/triggers/page.tsx` (`"use client"`) — liste les 11 triggers groupés par tier, avec compteurs top header (triggered / warning / partial / no-data)
- `components/TriggerCard.tsx` — Tremor card avec badge couleur (emerald / amber / rose / slate), description, message d'évaluation, current/threshold values, toggle UI pour les triggers manuels (T3) ou avec sub-condition manuelle (T1.3 ETF, T1.4 exit queue)
- Link depuis le dashboard principal `/ → /triggers`

### Tests
- `__tests__/triggers.test.ts` — **23 tests** sur la logique pure
  - T1.1 : insufficient / OK / triggered / warning (avec décompte de jours consécutifs)
  - T1.4 : OK / triggered via ratio drop / triggered via manual exit-queue flag
  - T2.5 / T2.6 : insufficient / triggered YoY
  - T2.7 : insufficient / plateau triggered / growing OK
  - T2.8 : OK / triggered / insufficient (empty)
  - T1.3 : insufficient / partial / triggered (both conditions)
  - T1.2 : insufficient (empty)
  - `evalManual` : needs_manual / triggered / needs_manual quand toggle=false
- **Total projet : 34/34 verts** (11 sources + 23 triggers)
- Build prod OK : route `/triggers` 6 kB additionnels, route `/` reste à 103 kB

## Mapping triggers → statut prévisible en production initiale

| # | Trigger | Statut attendu au lancement |
|---|---|---|
| T1.1 | ETH defi share < 40% | `insufficient_data` (besoin 180j d'historique) — actuellement 62.1% |
| T1.2 | Supply growth annualisé > +1% | `insufficient_data` (pas de snapshot supply dédié — voir limites) |
| T1.3 | ETF flows neg AND SER drop | `insufficient_data` (besoin 180j SER) + ETF en `needs_manual` |
| T1.4 | Staking drop > 25% OR exit queue 2x | **évaluable immédiatement** côté staking ratio. Exit queue : data unavailable → toggle manuel possible |
| T2.5 | TPS -40% sur 12m | `insufficient_data` (besoin 365j) |
| T2.6 | Stables -30% sur 12m | `insufficient_data` (365j) — mais backfill 30j déjà là, accumulation en cours |
| T2.7 | Blob plateau 9m | `insufficient_data` (270j) |
| T2.8 | RWA share < 50% | **évaluable immédiatement**. Actuellement 55.4% → `ok` |
| T3.9 | Crypto break | `needs_manual` |
| T3.10 | Regulation existential | `needs_manual` |
| T3.11 | Protocol capture | `needs_manual` |

## Ce qui ne marche pas (par design)

1. **T1.2 — supply growth** : on snapshote `staking_ratio` (qui dérive de la supply) mais pas la supply totale en tant que métrique standalone. La fonction `evalT12` est prête, il suffira d'ajouter `eth_supply` à `METRIC_NAMES` + un fetcher `getEthSupply()` qui pompe `ultrasound.money/api/v2/fees/supply-over-time` et stocke la dernière valeur. À faire en Phase 5 ou en sub-task. Marqué `insufficient_data` avec message explicite pour l'instant.

2. **T1.3 / T1.4 sub-conditions manuelles** : ETF flows (T1.3) et exit queue ratio (T1.4) ne sont pas auto-fetchables (cf. Phase 0 — APIs payantes / locked). Le frontend expose un toggle par trigger pour les marquer manuellement quand l'utilisateur observe la condition (via Farside, Beaconcha.in, etc.). Cette interaction est suffisante pour 1×/semaine.

3. **Pas de notif Telegram** : les triggers passent en `triggered` silencieusement. Phase 5 ajoutera l'alerting (Telegram + email récap hebdo).

4. **Blob count noisy** : on snapshote le blob count du dernier block (instantané, 0-6). T2.7 utilise des daily buckets (`bucketDailyLast` prend la dernière obs du jour), mais c'est très bruité. Une moyenne journalière propre demanderait du sampling RPC plus fréquent. Acceptable pour Phase 4, à raffiner si besoin.

## Bootstrap utilisateur (rappel cumulatif)

```bash
# 1) Phase 1+2+3 bootstrap (si pas déjà fait)
npx convex dev                              # écrase _generated/, signe-toi
npx convex run jobs:snapshotAll '{}'        # seed 11 snapshots maintenant (incl. eth_defi_share)
npx convex run jobs:backfillHistorical '{}' # 30j d'historique pour 5 métriques

# 2) Phase 4 : seed les triggers
npx convex run triggers:evaluateAll '{}'    # écrit 11 rows dans triggers_state

# 3) Lance le frontend
npm run dev                                  # http://localhost:3000 et /triggers
```

À partir de là :
- Cron horaire `jobs:snapshotAll` enrichit `metrics_snapshots`
- Cron daily 01:30 UTC `triggers:evaluateAll` réévalue les 11 triggers
- L'historique s'accumule → les triggers `insufficient_data` deviennent évaluables avec le temps

## Bilan global après Phase 4

- **11 métriques** snapshotées (10 cards visibles + `eth_defi_share` exposé sur le dashboard et utilisé pour T1.1)
- **11 triggers** définis et évaluables (avec les limitations notées)
- **34 tests** verts
- **2 pages** : `/` (cards + sparklines) et `/triggers` (statut + toggles manuels)
- **Convex** : 1 schéma propre, 2 crons (hourly snapshots + daily triggers), 1 backfill action
- Aucune dépendance lourde ajoutée en Phase 4 (juste DeFiLlama re-utilisé)

## Question

OK pour passer à la **Phase 5 — Telegram alerting + email récap hebdo + export JSON** ?
