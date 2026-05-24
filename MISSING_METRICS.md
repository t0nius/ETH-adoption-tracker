# Missing Metrics — État au 2026-05-22

Ce fichier liste les métriques **prévues mais non implémentées** dans le dashboard, avec la raison et le chemin de récupération à terme. Le dashboard affiche un placeholder "data unavailable" pour chacune et continue à fonctionner pour les autres.

---

## 1. Validator queue (entry/exit) — SKIP Phase 1

**Raison** : `beaconcha.in/api/v1/validators/queue` exige désormais une clé API gratuite (10 req/min) et la décision a été prise de ne pas créer de compte pour Phase 1.

**Alternative résiduelle** : PublicNode Beacon API (`/eth/v1/beacon/states/head/validators?status=pending_queued`) renvoie la liste complète des validateurs en queue (plusieurs MB, parseable en streaming). À considérer si la métrique devient critique pour le trigger T1.4 (`exit queue > 2x entry queue pendant 3 mois`).

**Impact sur les triggers** : T1.4 reste évaluable uniquement à la main pour l'instant.

---

## 11. ETF flows nets spot ETH — SKIP

**Raison** : `farside.co.uk/eth/` est protégé par Cloudflare challenge (curl reçoit le défi, pas la data). Sosovalue API renvoie payload vide sans header secret. Pas de service gratuit fiable identifié.

**Alternatives résiduelles à explorer un jour** :
- Playwright headless sur Farside (~2-3h dev, fragile au prochain bump Cloudflare)
- Reverse-engineering de Sosovalue (~1-2h investigation DevTools)
- Service payant CoinGlass / CryptoQuant (~$30/mois)

**Impact sur les triggers** : T1.3 (`ETF flows nets cumulés négatifs sur 6 mois ET SER en baisse de >25%`) ne pourra pas être évalué automatiquement. À cocher manuellement via interface admin (Phase 5).

---

## 12. Supply ETH sur CEX — SKIP

**Raison** : Glassnode `/v1/metrics/distribution/balance_exchanges?a=ETH` exige clé payante. Dune Analytics free tier (2500 executions/mois) accessible mais demande une clé utilisateur — pas fournie.

**Alternative résiduelle** : si une clé Dune est fournie plus tard, requête à brancher sur un dashboard public type "Ethereum CEX balances" (hildobby) ou query Dune SQL custom.

**Impact sur les triggers** : aucun trigger d'invalidation T1/T2 ne repose sur cette métrique. C'est de la donnée de contexte. Faible priorité.

---

## Récap

3 métriques marquées indisponibles sur 13 — dashboard reste fonctionnel pour les 10 autres (9 Tier A + SER en Tier B).
