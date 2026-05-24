# Sources Validation — Phase 0

**Date de validation manuelle** : 2026-05-22
**Méthode** : `curl` direct depuis le terminal, structure JSON observée et notée ci-dessous.

Légende statuts :
- ✅ **OK** — endpoint public, gratuit, sans clé, structure stable observée
- 🟡 **OK avec contrainte** — gratuit mais clé d'inscription requise, OU scraping nécessaire mais faisable
- 🔴 **BLOQUÉ** — accès payant / impossible sans alternative ; décision utilisateur requise

---

## Tier A — APIs gratuites stables (Phase 1)

### 1. Validator queue (entry/exit) — 🟡 OK avec contrainte

**Source initiale prévue** : `beaconcha.in/api/v1/validators/queue` → **NE MARCHE PLUS sans clé**.

```
$ curl https://beaconcha.in/api/v1/validators/queue
{"error":"Unauthorized: a valid API key is required."}  # HTTP 401
```

**Alternatives validées** :

**Option A (recommandée)** — beaconcha.in clé gratuite (inscription `beaconcha.in/login`, free tier généreux : 10 req/min, 100k/mois). Couvre nativement le format `entering_validators` / `exiting_validators`.

**Option B** — PublicNode Beacon Standard API (zéro clé) :
```
$ curl https://ethereum-beacon-api.publicnode.com/eth/v1/beacon/states/head/validators?status=pending_queued
# HTTP 200 — renvoie LA LISTE COMPLÈTE des validateurs en file (lourd, plusieurs MB)
# Mais on peut compter en streaming, ou utiliser status=active_ongoing pour staking ratio
```

Structure observée (`status=pending_queued`) :
```json
{"execution_optimistic":false,"finalized":false,"data":[
  {"index":"2281234","balance":"32000000000","status":"pending_queued",
   "validator":{"pubkey":"0x...","activation_eligibility_epoch":"449588","activation_epoch":"449594", ...}}
]}
```
→ `len(data)` = taille de la queue d'entrée. Idem `status=active_exiting` pour la queue de sortie.

**Décision suggérée** : commencer par **Option A** (clé gratuite beaconcha.in). Fallback Option B si la clé saute.

**Rate limit** : beaconcha.in 10 req/min free tier → largement suffisant pour un poll horaire.

---

### 2. TPS L1 + L2 agrégé — ✅ OK

**Source** : `https://api.growthepie.xyz/v1/fundamentals.json`

```
$ curl https://api.growthepie.xyz/v1/fundamentals.json
# HTTP 200, ~plusieurs MB JSON-array
```

Structure observée :
```json
[
  {"metric_key":"txcount","origin_key":"ethereum","date":"2026-05-21","value":2320690.0},
  {"metric_key":"gas_per_second","origin_key":"arbitrum","date":"2026-05-21","value":2.7276},
  ...
]
```

**Métriques pertinentes** : `txcount` (TPS = value / 86400), `gas_per_second`, `txcosts_median_usd`.

**Chains exposés** : ethereum, arbitrum, base, optimism, polygon_pos, starknet, scroll, linea, zksync_era, mantle, taiko, blast, metis, mode, fraxtal, manta, gravity, soneium, worldchain, ink, lisk, loopring, megaeth, plume, ronin, unichain, zircuit, celo, arbitrum_nova + `all_l2s`.

**Backfill** : oui — fundamentals.json contient l'historique quotidien complet (~365 jours).

**Rate limit** : non documenté, pas d'auth, comportement CDN — raisonnable à 1 req/heure.

---

### 3. Stablecoin supply on Ethereum (L1) — ✅ OK

**Source** : `https://stablecoins.llama.fi/stablecoinchains`

Structure observée pour Ethereum :
```json
{
  "name":"Ethereum",
  "totalCirculatingUSD":{"peggedUSD":162841595814.97,"peggedEUR":480958773.56, ...}
}
```

→ Supply ETH stablecoins **$162.8B** au 2026-05-22, `peggedUSD` est le champ principal.

Pour le supply L2 par L2 : utiliser `stables_mcap` dans growthepie fundamentals (`origin_key=arbitrum`, etc.).

**Rate limit** : DeFiLlama non documenté formellement mais ~300 req/min annoncé via Discord.

---

### 4. Burn rate / net issuance — ✅ OK

**Source** : `https://ultrasound.money/api/v2/fees/burn-sums`

Structure observée :
```json
{
  "d1":{"sum":{"eth":30.51,"usd":64964.45},"timestamp":"2026-05-22T16:35:23Z"},
  "d7":{"sum":{"eth":444.03,"usd":966019.30}, ...},
  "d30":{"sum":{"eth":3836.63, ...}},
  "h1":{...},"m5":{...},
  "since_burn":{"sum":{"eth":4633604.23, "usd":13095608285.58}, ...},
  "since_merge":{"sum":{"eth":2010294.89, ...}}
}
```

**Pour le net issuance** : combiner avec `https://ultrasound.money/api/v2/fees/supply-over-time` :
```json
{"d1":[{"supply":121713509.10,"timestamp":"2026-05-21T16:38:24Z"}, ...]}
```
→ Total supply 121.71M ETH. Δsupply/Δt = net issuance.

**Pas de clé requise**. Pas de rate limit observé.

---

### 5. Staking ratio — ✅ OK

**Sources combinées** :
- Staked : `https://ultrasound.money/api/v2/fees/effective-balance-sum`
  ```json
  {"slot":14386947,"sum":39076901000000000,"timestamp":"..."}
  ```
  → `sum` en gwei. ETH staké = 39,076,901.
- Total supply : `https://ultrasound.money/api/v2/fees/supply-over-time` (cf. #4)
  → Total = 121,713,594 ETH
- **Ratio = 39.08M / 121.71M = 32.1 %** ✅

---

### 6. L2 TVL agrégé — ✅ OK

**Source** : `https://l2beat.com/api/scaling/summary`

Structure observée :
```json
{"chart":{
  "types":["timestamp","native","canonical","external","ethPrice"],
  "data":[[1776816000, 10382904599.6, 14087316499.1, 16414135255.4, 2327.51], ...]
}}
```

→ time-series TVL agrégé tous L2, avec décomposition native/canonical/external. **Backfill historique inclus**.

---

### 7. ETH/BTC ratio — ✅ OK

**Source** : `https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin&vs_currencies=usd,btc`

```json
{"bitcoin":{"usd":76810,"btc":1.0},"ethereum":{"usd":2117.91,"btc":0.02757738}}
```

**Rate limit free** : 30 req/min sans clé (utiliser un poll horaire = OK large).
**Backfill** : `/coins/ethereum/market_chart?vs_currency=btc&days=365`.

---

### 8. Active addresses L1+L2 — ✅ OK

**Source** : growthepie fundamentals (cf. #2), `metric_key="daa"` et `metric_key="aa_last7d"`.

Exemples observés :
- ethereum daa 2026-05-21 = 498,202
- arbitrum daa 2026-05-21 = 137,646

Pour total L1+L2 : sommer sur `origin_key in (ethereum, arbitrum, base, optimism, polygon_pos, starknet, scroll, linea, zksync_era, mantle, taiko, ...)`.

---

## Tier B — Sources difficiles (Phase 3)

### 9. SER (Strategic ETH Reserve) — 🟡 Scraping Playwright requis

**Source** : `https://www.strategicethreserve.xyz/`

Site Next.js full SSR-then-hydrate. Pas d'API publique exposée (testé `/api/holders`, `/api/data` — toutes renvoient l'HTML root). Le DOM initial ne contient pas de JSON inline.

→ **Solution** : Playwright headless, attendre que le tableau des holders charge, parser le DOM.

Alternative idéale (non bloquant) : ouvrir le DevTools de la page sur navigateur réel, repérer l'URL XHR/fetch réelle qui ramène les données — souvent c'est `_next/data/.../holders.json` ou une route Supabase publique. À investiguer pendant Phase 3.

---

### 10. RWA tokenisé sur Ethereum — ✅ OK

**Source** : `https://api.llama.fi/protocols` filtré par `category="RWA"`.

Validation calculée :
- 145 protocoles RWA listés
- TVL RWA total : **$26.91B**
- TVL RWA sur Ethereum : **$14.92B** (via `chainTvls.Ethereum`)
- **Part Ethereum : 55.4 %** → directement actionnable pour trigger T8 (« < 50% »).

Top 5 RWA sur ETH :
- Tether Gold $3.19B
- Paxos Gold $2.12B
- Ondo Yield Assets $1.25B
- Centrifuge Protocol $1.12B
- BlackRock BUIDL $1.09B

**Note** : payload `/protocols` pèse ~8 MB, à cacher côté DB.

---

### 11. ETF flows nets spot ETH — 🔴 BLOQUÉ (alternatives à arbitrer)

**Source prévue** : `https://farside.co.uk/eth/` → **Cloudflare challenge**, curl reçoit le challenge page, pas la data.

Alternatives testées :
- **Sosovalue API** (`api.sosovalue.xyz/openapi/v2/etf/historicalInflowChart` POST `{"type":"ETHEREUM_SPOT"}`) → renvoie `{"code":0,"data":[]}` (vide). Probablement besoin d'un header d'auth interne ou d'une signature.
- **Coinglass API** → 404, URL pattern changé.
- **BitMEX research blog** → HTML article, pas de data structurée.

**Décision utilisateur requise — 3 options** :

| Option | Effort | Robustesse |
|---|---|---|
| A. Playwright sur Farside (contourne Cloudflare via vrai navigateur) | 2-3h dev | Moyen — Cloudflare peut bump la protection |
| B. Reverse-engineer Sosovalue (DevTools, headers, signature) | 1-2h investigation | Bon si on trouve le header secret |
| C. CoinGlass API key payante (~$30/mois) ou CryptoQuant gratuit limité | $0-30/mois | Excellent |

**Recommandation** : tenter A en Phase 3, fallback C si timeout 2h. Documenter dans `MISSING_METRICS.md` en attendant.

---

## Tier C — Difficile / payant (Phase 3 conditionnelle)

### 12. Supply ETH sur CEX — 🔴 BLOQUÉ

- **Glassnode** `/v1/metrics/distribution/balance_exchanges?a=ETH` → 401 (auth payante).
- **Dune Analytics** free tier (2500 executions/mois) faisable mais demande clé API + écriture/réutilisation d'une requête publique (ex : dashboard "Ethereum CEX balances" de hildobby).
- **CryptoQuant** : payant.

**Décision** : à noter dans `MISSING_METRICS.md` pour Phase 3. Fallback : tag « data unavailable » dans le dashboard.

---

### 13. Blob count per block — ✅ OK

**Source** : RPC public Ethereum (zéro clé)

```
$ curl -X POST https://ethereum-rpc.publicnode.com \
   -H "Content-Type: application/json" \
   -d '{"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":["latest",false],"id":1}'
```

Structure réponse (champs pertinents) :
```json
{"result":{
  "number":"0x17fca36",
  "blobGasUsed":"0x20000",
  "excessBlobGas":"0xad29aa2",
  ...
}}
```

**Calcul** : `blob_count = int(blobGasUsed, 16) // 131072` (1 blob = 131,072 gas).
Block testé : 1 blob.

**Pour blob count moyen quotidien** : il faut soit (a) sampler N blocks par jour, soit (b) utiliser Dune. Pour Phase 1 on commencera par sampling toutes les 12s sur le dernier block (rate non-critique).

**Endpoints publics testés** :
- `https://ethereum-rpc.publicnode.com` ✅ (utilisé)
- Fallback : `https://eth.llamarpc.com`, `https://cloudflare-eth.com`

---

## Récapitulatif

| # | Métrique | Statut | Source retenue |
|---|---|---|---|
| 1 | Validator queue | 🟡 | beaconcha.in (clé gratuite) ou PublicNode beacon |
| 2 | TPS L1+L2 | ✅ | growthepie fundamentals.json |
| 3 | Stablecoin supply ETH | ✅ | DeFiLlama stablecoinchains |
| 4 | Burn / issuance | ✅ | ultrasound.money burn-sums + supply-over-time |
| 5 | Staking ratio | ✅ | ultrasound.money effective-balance-sum |
| 6 | L2 TVL | ✅ | L2Beat /api/scaling/summary |
| 7 | ETH/BTC | ✅ | CoinGecko simple/price |
| 8 | Active addresses | ✅ | growthepie fundamentals (daa) |
| 9 | SER | 🟡 | Playwright sur strategicethreserve.xyz |
| 10 | RWA share ETH | ✅ | DeFiLlama /protocols category=RWA |
| 11 | ETF flows | 🔴 | À trancher : Playwright Farside / Sosovalue RE / paid |
| 12 | CEX supply | 🔴 | À noter manquant — fallback Dune si clé fournie |
| 13 | Blob count | ✅ | Public Eth RPC eth_getBlockByNumber |

**Total** : 9 ✅ — 2 🟡 — 2 🔴

---

## Décisions arrêtées le 2026-05-22

1. **Validator queue (#1)** → **SKIP** Phase 1. Pas de création de compte beaconcha.in pour l'instant. Tracé dans `MISSING_METRICS.md`.
2. **ETF flows (#11)** → **SKIP**. Marqué `data unavailable`. Trigger T1.3 sera coché à la main via interface admin (Phase 5).
3. **CEX supply (#12)** → **SKIP**. Pas de clé Dune disponible. Tracé dans `MISSING_METRICS.md`.

## Périmètre confirmé pour Phase 1

**8 métriques Tier A** qui passent toutes en lecture API directe sans clé :

| # | Métrique | Source |
|---|---|---|
| 2 | TPS L1+L2 | growthepie fundamentals.json (`txcount`) |
| 3 | Stablecoin supply ETH | DeFiLlama stablecoinchains |
| 4 | Burn / net issuance | ultrasound.money burn-sums + supply-over-time |
| 5 | Staking ratio | ultrasound.money effective-balance-sum + supply-over-time |
| 6 | L2 TVL agrégé | L2Beat /api/scaling/summary |
| 7 | ETH/BTC | CoinGecko simple/price |
| 8 | Active addresses L1+L2 | growthepie fundamentals.json (`daa`) |
| 13 | Blob count per block | RPC public eth_getBlockByNumber |

**+ 1 métrique bonus** (le calcul RWA share ETH est déjà fait via DeFiLlama protocols → 55.4% au 2026-05-22), donc on peut intégrer 9 cards en Phase 1 si on veut.

**Tier B reporté Phase 3** : SER (#9) via Playwright, RWA share (#10) en feed propre depuis DB.
