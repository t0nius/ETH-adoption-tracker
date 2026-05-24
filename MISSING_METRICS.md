# Missing Metrics — État au 2026-05-23

Ce fichier liste les métriques **prévues, implémentées ou encore partielles**, avec source et clés API.

---

## Live sur le board (14 métriques + 1 hidden)

| Métrique | Groupe | Source | Trigger |
|----------|--------|--------|---------|
| `net_issuance_daily` | Monetary | ultrasound.money supply-over-time | T1.2 (contexte) |
| `supply_inflation_annualized` | Monetary | ultrasound.money (fenêtre 180j) | T1.2 |
| `etf_flows_6m_usd` | Institutional | Farside via jina.ai proxy (gratuit) · CoinGlass · saisie manuelle | T1.3 |
| `validator_queue_ratio` | Monetary | PublicNode Beacon API (gratuit) · beaconcha.in V2 | T1.4 |
| `eth_total_supply` | *(hidden)* | ultrasound.money | T1.2 (série brute) |

Encart dashboard : **Monetary Health** (burn + net issuance + inflation annualisée).

---

## Clés API Convex (Settings → Environment Variables)

| Variable | Usage | Coût |
|----------|-------|------|
| `BEACONCHAIN_API_KEY` | Exit/entry queue ratio (optionnel — PublicNode par défaut) | Essai 30j puis payant — [beaconcha.in/login](https://beaconcha.in/login) |
| `COINGLASS_API_KEY` | ETF flows 6M USD (optionnel — Farside par défaut) | Plan payant CoinGlass — header `CG-API-KEY` |
| `BLOCKWORKS_API_KEY` | Fallback ETF (optionnel) | Si disponible |

Sans source auto ETF : champ numérique hebdo sur `/triggers` (`submitManualEtfFlows`) — préservé 7 jours même si le job horaire échoue.

Sans clé beaconcha : PublicNode Beacon API (gratuit, sans inscription).

---

## Backfill supply

```bash
npx convex run jobs:backfillHistorical '{"days":365}'
```

Remplit `eth_total_supply`, `net_issuance_daily`, `supply_inflation_annualized` depuis la série `since_merge`.

---

## SKIP restant

### ETH supply on CEX (Glassnode / Dune)

Pas de trigger T1/T2 — contexte seulement. Nécessite clé payante ou Dune.

---

## Récap

- **14 métriques** affichées sur le board (+ `eth_total_supply` caché pour T1.2)
- **3 nouvelles** live : supply nette, inflation annualisée, ETF 6M, queue ratio
- ETF et queue : **automatisés sans clé** (Farside + PublicNode) ; clés API = option premium
