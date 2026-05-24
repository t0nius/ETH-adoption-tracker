# Phase 1 — Récap

**Date** : 2026-05-22
**Statut** : ✅ Terminée localement. À déployer sur Vercel par l'utilisateur (commandes plus bas).

## Ce qui marche

### Code
- Next.js 14.2.35 (App Router) + TypeScript strict + Tailwind 3.4 + Tremor 3.18
- Server Component unique `app/page.tsx` qui fetch 9 sources en parallèle via `Promise.all`
- Composant `MetricCard` avec badge `live`/`stale` (Tremor `Card` + `Badge` + `Metric` + `Flex`)
- Resilience : chaque source est dans un try/catch, retourne `{ status: 'stale', error: '…' }` en cas d'échec — le dashboard rend toujours
- Cache Next.js `revalidate: 300` (5 min) sur tous les fetchs, plus cache mémoire 5 min pour growthepie (utilisé par 2 métriques)
- 9 tests unitaires Vitest (mock global.fetch) : happy path + 2 chemins stale-fallback. **9/9 verts**.

### Valeurs live observées (2026-05-22 18:51 UTC)
| Métrique | Valeur |
|---|---|
| TPS (L1+L2 aggregated) | **331.8** tx/s |
| Stablecoin supply ETH L1 | **$162.84B** |
| ETH burned (24h) | **30.4 ETH** |
| Staking ratio | **32.1%** |
| L2 TVL agrégé | **$40.82B** |
| ETH/BTC | **0.02757 BTC** |
| Daily active addresses L1+L2 | **2.24M** |
| RWA share on Ethereum | **55.4%** |
| Blobs in latest block | **5** |

→ 9 live / 0 stale. Toutes les sources publiques répondent.

### Build
- `npm test` → 9/9 passing en 350ms
- `npm run build` → compile OK, route `/` server-rendered on demand, 106 kB First Load JS

## Décisions techniques

1. **Pas de DB en Phase 1** : Server Component fetch direct + Next cache 5min. C'est suffisant pour un MVP visuel. La DB arrive en Phase 2 pour historiser et permettre sparklines.
2. **Fetch direct côté serveur** plutôt que via API Routes locales — un seul aller-retour, moins de surface, et la cache Next gère la revalidation. Les API Routes arriveront en Phase 2 quand le client devra lire depuis la DB.
3. **Tremor classic v3** (pas Tremor Raw) — drop-in components, zéro custom CSS pour Phase 1.
4. **Vitest** plutôt que Jest — config zéro avec ESM + TS + paths Next, plus rapide.
5. **In-memory cache 5 min pour growthepie** : 2 métriques utilisent le même payload (txcount + daa), inutile de fetch 2 fois.
6. **3 RPC URLs en fallback** pour le blob count (`publicnode`, `llamarpc`, `cloudflare-eth`) — si l'un tombe, on bascule sans marquer la métrique stale.

## Sources / URLs utilisées (récap rapide, doc complète dans `docs/sources_validation.md`)

| # | Endpoint | Méthode | Clé |
|---|---|---|---|
| 1 | `https://api.growthepie.xyz/v1/fundamentals.json` | GET | non |
| 2 | `https://stablecoins.llama.fi/stablecoinchains` | GET | non |
| 3 | `https://ultrasound.money/api/v2/fees/burn-sums` | GET | non |
| 4 | `https://ultrasound.money/api/v2/fees/effective-balance-sum` + `/supply-over-time` | GET | non |
| 5 | `https://l2beat.com/api/scaling/summary` | GET | non |
| 6 | `https://api.coingecko.com/api/v3/simple/price` | GET | non |
| 7 | `https://api.growthepie.xyz/v1/fundamentals.json` (même que #1, caché en mémoire) | GET | non |
| 8 | `https://api.llama.fi/protocols` | GET | non |
| 9 | `https://ethereum-rpc.publicnode.com` (+ 2 fallbacks) | POST JSON-RPC | non |

## Ce qui ne marche pas (et pourquoi)

Aucun bug bloquant. Limitations connues :

1. **Burn rate ≠ net issuance** : Phase 1 affiche uniquement ETH burned 24h. Le net issuance (positif si inflationniste) nécessite de calculer `ΔSupply / Δt` ce qui demande historique → Phase 2.
2. **Blob count single-block** : on affiche les blobs du dernier block (vue instantanée 0–6). La moyenne quotidienne avec sampling tous les 12s arrivera en Phase 2.
3. **Sparklines absentes** : design choisi car pas d'historique en Phase 1. Ajout direct en Phase 2 dès que la DB se remplit.
4. **Pas de dark mode toggle** : Tremor supporte le dark mode mais on n'a pas câblé le switch UI. Phase 5 si pertinent.

## Démo

Local :
```bash
npm install
npm run dev
# → http://localhost:3000
```

Vercel (à exécuter par l'utilisateur) :
```bash
npm i -g vercel@latest
cd /Users/antoinewillems/Developer/ETH-adoption-tracker
vercel link            # crée le projet
vercel deploy --prod   # déploie en prod, retourne l'URL publique
```

Aucune env var nécessaire — toutes les sources sont publiques.

## Question

OK pour passer à la **Phase 2 — DB Supabase + cron horaire + sparklines** ?
