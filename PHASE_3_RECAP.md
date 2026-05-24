# Phase 3 — Récap

**Date** : 2026-05-22
**Statut** : ✅ Terminée. **Pas de Playwright nécessaire** au final.

## Périmètre Phase 3

Vu les décisions Phase 0, Tier B + C se réduisait à :
- **SER (Strategic ETH Reserve)** : seule métrique Tier B encore à câbler
- **ETF flows, CEX supply, validator queue** : déjà skippées et tracées dans `MISSING_METRICS.md`
- **Monitoring stale > 24h** : nouvelle infra UX

## Découverte clé

Plutôt que d'embarquer Playwright (~300 MB Chromium, complexité runtime Convex), j'ai inspecté de plus près `strategicethreserve.xyz` :

- App Next.js 14 App Router → **toutes les données sont dans le payload RSC** (server-rendered React Server Components), embarquées en clair dans le HTML initial via `self.__next_f.push([N, "<escaped JSON>"])`.
- Le tableau `"companies":[...]` y figure complet avec 139 entrées, chacune avec `currentReserve`, `status`, `category`, `name`, etc.

→ **Un simple `fetch + regex + JSON.parse` suffit**, exécutable dans le runtime Convex V8 sans dépendance externe.

## Implémentation

### `lib/sources/ser.ts`
- `extractRscPayload(html)` : matche tous les `self.__next_f.push([N,"…"])`, décode les escape sequences via `JSON.parse(\`"${str}"\`)`, concatène
- `findCompaniesArray(rsc)` : trouve `"companies":[`, parcourt en bracket-counting pour extraire l'array complet, JSON.parse
- `aggregate(companies)` : filtre `status === "ACTIVE"` + supply cap 10M ETH par entité (pour exclure entrées corrompues comme `1e+25`), somme `currentReserve`, breakdown par catégorie, top 5
- `getSerTotalEth()` : pipeline complet renvoyant `MetricResult`

### Intégration Convex
- `convex/snapshots.ts` — ajout de `"ser_total_eth"` à `METRIC_NAMES`
- `convex/jobs.ts` — `snapshotAll` lance maintenant 9 fetchs en parallèle (8 Phase 1 + SER), 10 mutations
- Le cron horaire existant capture SER automatiquement

### Monitoring stale-par-âge (>24h)
- `MetricCard` calcule `isAged = !isStale && Date.now() - snap.timestamp > 24h` et affiche un badge `aged` ambre + sparkline ambre
- Header de page affiche un compteur `N aged > 24h`
- 3 états visuels distincts :
  - 🟢 `live` — snapshot OK et frais
  - 🟠 `aged` — snapshot OK mais > 24h (le cron ne tourne plus, ou la source bloque)
  - 🔴 `stale` — dernier fetch a échoué

### Tests
- 2 nouveaux tests SER :
  - `aggregate()` pur — vérifie filtre status + supply cap + breakdown catégories
  - `getSerTotalEth()` end-to-end — mock fetch avec un HTML contenant un mini `__next_f.push`
- **11/11 verts** au total (9 Phase 1 + 2 SER)

## Validation live

Smoke test sur le vrai HTML SER (au 2026-05-22) :
```
Companies parsed: 139
By status: { INACTIVE: 46, ACTIVE: 67, IN_REVIEW: 25, PENDING: 1 }
Total ETH (filtered ACTIVE + cap 10M): 7,368,683 ETH

Top 3 active holders:
  Bitmine Immersion Tech       4,595,562 ETH (Treasuries)
  SharpLink Gaming               863,021 ETH (Treasuries)
  The Ether Machine              496,712 ETH (Treasuries)

Breakdown par catégorie:
  Treasuries        6,387,774
  Blockchains         425,663
  Web3 Entities       330,496
  Public Companies    159,258
  Governments          64,027
  Private Companies     1,466
```

Cohérent avec reporting public : SER affiche un total ~7.4M ETH en treasuries corporates.

## Ce qui marche

| Item | Statut |
|---|---|
| Extraction RSC sans Playwright | ✅ |
| Aggregation filtrée (status + cap) | ✅ |
| Intégration cron Convex | ✅ |
| Tests unitaires SER | ✅ (11/11 verts) |
| Monitoring stale > 24h (3 états visuels) | ✅ |
| Build prod | ✅ (125 kB / 234 kB First Load) |

## Ce qui ne marche pas

Rien de bloquant. Limitations connues :

1. **Robustesse du scraping** : si SER change le shape du payload (refactor RSC ou renommage `companies`), le scraper échoue → la métrique passe en `stale` proprement, mais il faudra adapter le parser. Pas de versionning du format RSC.
2. **Pas de backfill SER** : SER n'expose pas d'historique → la sparkline 30j de SER se remplira au fil du cron (1 point/h, complète après 30j). Acceptable car SER bouge lentement.
3. **Tier B / C restants** : ETF flows, CEX supply, validator queue toujours dans `MISSING_METRICS.md`. Inchangé depuis Phase 0.

## Sources / URLs Phase 3

| Métrique | Endpoint | Méthode | Clé |
|---|---|---|---|
| SER total ETH | `https://www.strategicethreserve.xyz/` | GET HTML + parse RSC | non |

## Total dashboard à ce stade

**10 cards** (Phase 1: 9 + Phase 3: SER) :

| # | Métrique | Source |
|---|---|---|
| 1 | TPS L1+L2 | growthepie |
| 2 | Stables ETH L1 | DeFiLlama |
| 3 | Burn 24h | ultrasound.money |
| 4 | Staking ratio | ultrasound.money |
| 5 | L2 TVL | L2Beat |
| 6 | ETH/BTC | CoinGecko |
| 7 | DAA L1+L2 | growthepie |
| 8 | RWA share | DeFiLlama |
| 9 | Blob count | Eth RPC public |
| **10** | **SER total** | **strategicethreserve.xyz** |

## Question

OK pour passer à la **Phase 4 — Triggers d'invalidation** ?
