# Phase 5 — Récap

**Date** : 2026-05-22
**Statut** : ✅ Terminée. Toutes les intégrations sont **opt-in via env vars** — si tu ne configures rien, le système tourne normalement et les notifs no-op silencieusement.

## Ce qui a été ajouté

### Intégrations (`lib/integrations/`)
- `telegram.ts` — `sendTelegramAlert(text)` + `formatTriggerAlert(trigger)`
  - Env vars : `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
  - No-op clean si non configuré
  - Format Markdown avec icône par tier (🚨 T1, ⚠️ T2, 🔶 T3)
- `resend.ts` — `sendResendEmail({ subject, html, text })`
  - Env vars : `RESEND_API_KEY`, `NOTIFICATION_EMAIL`, optionnel `NOTIFICATION_FROM`
  - No-op clean si non configuré

### Détection de transitions (`lib/triggers/transitions.ts`)
- `findNewlyTriggered(oldStatusMap, newEvals)` — pure function
- N'alerte que sur transition `(non-triggered)→triggered` — évite le spam
- Première évaluation (pas d'état antérieur) déclenche aussi (cas "vient juste d'être loadé")

### Convex
- `convex/notifications.ts` :
  - `internalAction sendWeeklyRecap` — query latest snapshots + triggers, format HTML/text, envoi Resend
  - `internalAction testTelegram` — pour tester le bot manuellement avec `npx convex run notifications:testTelegram '{}'`
- `convex/triggers.ts` modifié :
  - Avant chaque upsert, lit l'ancien `triggers_state.status` → `findNewlyTriggered` → batch Telegram
  - `setManualTrigger` schedule un `evaluateAll` immédiat quand on flag manuellement → alerte Telegram automatique via le chemin standard
- `convex/snapshots.ts` + `convex/triggers.ts` ajoutent des `internalQuery` flat (`_readLatestForRecap`, `_readAllForRecap`) consommées par l'email builder
- `convex/crons.ts` : nouveau cron `weekly` (Mondays 09:00 UTC) → `notifications.sendWeeklyRecap`

### Frontend
- `app/api/export/route.ts` — GET → JSON de `latestPerMetric` + `listTriggers`, `Content-Disposition: attachment; filename="eth-tracker-YYYY-MM-DD.json"`
- Bouton **Export JSON ↓** dans la card footer du dashboard
- Compatible client + Vercel deploy (utilise `ConvexHttpClient` côté serveur)

### Tests (+ 10 tests)
- `__tests__/integrations.test.ts` — 6 tests
  - Telegram : no-op sans env, POST correct vers `/sendMessage` avec bearer / chat_id, gestion HTTP 4xx, format alert
  - Resend : no-op sans env, POST correct avec `Authorization: Bearer`
- `__tests__/triggers.test.ts` — +4 tests pour `findNewlyTriggered`
  - ok→triggered fire / triggered→triggered no fire / warning no fire / first-ever fire
- **Total projet : 44/44 verts** (11 sources + 27 triggers + 6 integrations)

### Build
- `/` 103 kB (243 kB First Load)
- `/triggers` 6 kB (146 kB)
- `/api/export` 0 B JS (server-rendered on demand, ƒ)

## Architecture finale

```
Hourly cron ─► snapshotAll ─► metrics_snapshots
                                     │
                                     ▼
Daily cron ──► evaluateAll ──► triggers_state ──► transition detect ──► Telegram alert
                                     ▲
                                     │
User clicks ─► setManualTrigger ─► triggers_manual + scheduler ─► evaluateAll
                                                                       │
                                                                       ▼ same alert path

Weekly cron ─► sendWeeklyRecap ─► query Convex ─► build HTML ─► Resend ─► email

Browser    ──► /api/export ─► ConvexHttpClient ─► JSON dump (downloaded)
```

## Bootstrap utilisateur — env vars (toutes optionnelles)

```bash
# Convex env vars — set via dashboard ou CLI :
npx convex env set TELEGRAM_BOT_TOKEN  "123456:ABC-DEF..."
npx convex env set TELEGRAM_CHAT_ID    "987654321"
npx convex env set RESEND_API_KEY      "re_..."
npx convex env set NOTIFICATION_EMAIL  "you@example.com"
npx convex env set NOTIFICATION_FROM   "tracker@yourdomain.com"   # optionnel, défaut onboarding@resend.dev
npx convex env set NEXT_PUBLIC_APP_URL "https://your-vercel-app.vercel.app"  # optionnel, juste pour le lien dans l'email
```

Bot Telegram : `@BotFather` → `/newbot` → garde le token. Chat ID : forward un message à `@userinfobot`.

Resend : créer compte gratuit sur resend.com → API Keys → générer une clé. Free tier : 100 emails/jour, 3000/mois.

## Tests manuels

```bash
# Test l'envoi Telegram (no-op si pas configuré)
npx convex run notifications:testTelegram '{}'

# Test l'envoi du recap email
npx convex run notifications:sendWeeklyRecap '{}'

# Trigger artificiel pour tester le chemin d'alerte (toggle T3 manuel)
# Via UI : aller sur /triggers, cliquer "Mark triggered" sur n'importe quel T3
# → evaluateAll est schedulé immédiatement → si nouveau triggered → Telegram fire

# Export JSON
curl http://localhost:3000/api/export | jq '.'
```

## Ce qui marche

- ✅ Telegram bot envoie un message Markdown par trigger nouvellement déclenché
- ✅ Aucune duplication : si un trigger reste `triggered` jour après jour, pas de re-alert
- ✅ Email récap hebdo : tableau HTML des 11 métriques + 11 triggers avec code couleur
- ✅ Toggle manuel T3 envoie automatiquement la Telegram via le chemin standard d'évaluation
- ✅ Export JSON instantané et téléchargeable
- ✅ Toutes les intégrations sont opt-in et no-op clean

## Ce qui ne marche pas / hors scope

1. **Pas de digest** : 1 message Telegram par trigger transitionné. Si 5 triggers basculent le même jour → 5 messages. Acceptable, mais on pourrait grouper en 1 message si volume devient gênant.
2. **Pas de "résolution" alert** : quand un trigger sort de `triggered` (ex. passe à `ok`), aucune notif. Volontaire — l'utilisateur peut consulter `/triggers` à tout moment.
3. **Email recap repose sur la dernière éval daily** : si la dernière éval a planté, l'email reflète des données obsolètes. La cron daily est stable mais à surveiller. Le badge "aged > 24h" de Phase 3 reste le canary.
4. **NEXT_PUBLIC_APP_URL doit être ré-set en prod Vercel** comme env var publique. Documenté dans README.
5. **Export JSON ne contient pas l'historique** (sparklines). Snapshot only + triggers. Si tu veux l'historique 30j en plus, ajouter `historyForMetric` à la route — easy add si besoin.

## Bilan global (fin Phase 5 — projet complet)

| | |
|---|---|
| **Métriques snapshotées** | 11 (10 visibles + `eth_defi_share` underlying T1.1) |
| **Triggers définis** | 11 (4 T1, 4 T2, 3 T3) |
| **Pages** | 2 (`/`, `/triggers`) + 1 API route (`/api/export`) |
| **Crons Convex** | 3 (hourly snapshot, daily eval, weekly email) |
| **Intégrations externes** | 2 opt-in (Telegram, Resend) |
| **Tests** | 44/44 verts (sources + triggers + integrations) |
| **First Load JS** | 243 kB max (`/`) |
| **Sources skippées** | 3 documentées dans MISSING_METRICS.md (validator queue, ETF flows, CEX supply) |

## Bootstrap final cumulatif

```bash
npm install
npx convex dev                                # provision deployment (1ère fois)
# Optionnel — set env vars pour Telegram/Resend (cf. plus haut)
npx convex run jobs:snapshotAll '{}'          # seed 11 snapshots
npx convex run jobs:backfillHistorical '{}'   # 30j d'historique pour 5 métriques
npx convex run triggers:evaluateAll '{}'      # seed 11 triggers
npm run dev                                    # http://localhost:3000
```

## Question finale

Le projet couvre les 5 phases du spec initial. **Tu peux maintenant lancer le bootstrap Convex et tester en live.**

Si tu veux pousser plus loin par la suite :
- T1.2 snapshot dédié `eth_supply` (sous-tâche en suspens)
- Alerts groupées en digest si > 3 triggers le même jour
- Dune Analytics si tu as une clé (débloque CEX supply + blob count daily avg)
- Auth admin pour `/triggers` (actuellement public — quiconque connait l'URL peut toggle)

Mais ce sont des nice-to-haves. Le MVP du spec initial est livré.
