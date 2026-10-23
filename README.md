# FitScan AI — AI Fitness & Nutrition Tracker (MVP)

Take a photo of your meal → Gemini identifies the foods and estimates grams → a nutrition database supplies calories/macros per 100 g → the backend calculates the serving → you review/correct → save → dashboard updates.

**Core rule:** the AI never produces calories. Gemini answers *"what food, how many grams?"*; the nutrition database answers *"how much nutrition is in that?"*. See `docs/ai-food-analysis.md`.

```
Mobile (Expo/React Native)  ──HTTPS──▶  Backend (Express/TS)  ──▶  Gemini API   (key only on backend)
                                              │──────────────▶  USDA FoodData Central + curated Indian table
                                              └──────────────▶  PostgreSQL (Prisma)
```

## Repo layout
`mobile/` Expo app · `backend/` API + Prisma schema/migrations + tests · `docs/` architecture, database, api, ai-food-analysis · `docker-compose.yml` PostgreSQL · `.env.example`

## Requirements
Node.js 20+ (tested on 22), PostgreSQL 14+ (Docker or local), Expo Go or an emulator. Optional: Gemini API key, USDA API key (both free).

## Quick start (works with no API keys, using clearly-labelled dev mocks)
```bash
# 1. Database
docker compose up -d db                       # PostgreSQL on :5432

# 2. Backend
cd backend
cp .env.example .env                          # then edit JWT_SECRET (32+ chars)
npm install
npx prisma generate                           # generates the typed client into src/generated
npm run migrate                               # applies prisma/migrations/*/migration.sql  (or: npx prisma migrate deploy)
npm run dev                                   # http://localhost:4000/api/health

# 3. Mobile
cd ../mobile
cp .env.example .env                          # set EXPO_PUBLIC_API_URL (see below)
npm install
npx expo start                                # scan the QR with Expo Go, or press a / i
```
`EXPO_PUBLIC_API_URL`: Android emulator `http://10.0.2.2:4000`, iOS simulator `http://localhost:4000`, physical phone `http://<your-computer-LAN-IP>:4000`.
Only this URL is in the app. **No API keys ever go in `mobile/`.**

## Environment variables (`backend/.env`)
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | ≥16 chars (use 32+ random) for signing access tokens |
| `PORT` | default 4000 |
| `AI_MODE` | `real` (Gemini) or `mock` (dev only, deterministic fake vision) |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | required when `AI_MODE=real`; model default `gemini-2.5-flash` |
| `NUTRITION_MODE` | `real` (USDA) or `mock` (small fixed table); the curated Indian table is always active |
| `USDA_API_KEY` | required when `NUTRITION_MODE=real` |
| `SMTP_URL`, `MAIL_FROM` | password-reset email. Empty in dev → codes are printed to the server log. **Required in production** (e.g. `smtps://user:pass@smtp.example.com:465`) |
| `CORS_ORIGINS` | `*` in dev; explicit comma-separated origins required in production |
| `FREE_SCAN_LIMIT_PER_MONTH`, `PREMIUM_SCAN_LIMIT_PER_MONTH` | scan quotas (plan limits are config; wire `getUserPlan` in `src/config/plans.ts` to subscriptions later) |
| `ANALYZE_RATE_LIMIT_PER_MIN`, `AI_RATE_LIMIT_PER_MIN`, `AUTH_RATE_LIMIT_MAX` | rate limits |
| `MAX_IMAGE_MB` | upload limit (default 8) |

The server refuses to start with `AI_MODE=real` and no `GEMINI_API_KEY` (same for USDA), with `CORS_ORIGINS=*` in production, and without `SMTP_URL` in production.

## Gemini setup
1. Create a key at https://aistudio.google.com/apikey.
2. In `backend/.env`: `AI_MODE=real`, `GEMINI_API_KEY=...`. Restart the backend. `/api/health` shows `ai_mode`.

## USDA setup
1. Get a free key at https://fdc.nal.usda.gov/api-key-signup.
2. In `backend/.env`: `NUTRITION_MODE=real`, `USDA_API_KEY=...`.
Lookup order: local cache → curated Indian table → USDA. Results are cached in `food_items` / `food_nutrition`.

## Database & migrations
Schema: `backend/prisma/schema.prisma`. Initial migration: `backend/prisma/migrations/20261004000000_init/migration.sql`.
`npm run migrate` applies migrations with plain SQL (no Prisma engine download needed). With full network access you can use `npx prisma migrate deploy` instead; run `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --exit-code` once to confirm there is no drift. For future schema changes use `npx prisma migrate dev --name <change>`.
No Postgres/Docker? `npm run pg:dev` starts a throwaway embedded Postgres on :5433 (dev/CI only).

## Tests
```bash
cd backend
npm run pg:dev &      # only if you have no PostgreSQL on :5433; tests use TEST_ADMIN_URL / TEST_DATABASE_URL (defaults to localhost:5433)
npm test              # 58 tests: auth, password reset, calories, nutrition, AI (validation, no-food, low confidence, Gemini service), meals, weight, end-to-end
npm run typecheck

   # type-check + real Metro bundle
```
The test database is dropped and rebuilt from the migrations on every run.

## Production deployment
- Backend: `cd backend && npm ci && npx prisma generate && npm run build && npm run migrate && NODE_ENV=production npm start` behind HTTPS (Render/Fly/Railway/ECS). Set all env vars from your host's secret store, `AI_MODE=real`, `NUTRITION_MODE=real`, explicit `CORS_ORIGINS`.
- Database: managed PostgreSQL; take backups; use a connection pooler if scaling out.
- Rate limits use in-memory stores: if you run multiple instances, switch `express-rate-limit` to a shared store (e.g. Redis).
- Mobile: set `EXPO_PUBLIC_API_URL` to your HTTPS API, then `eas build` (Expo Application Services) for iOS/Android.
- Replace the placeholder bundle ids in `mobile/app.json` (`com.example.fitscan`).

## Disclaimers
Calorie targets and food nutrition are **estimates**, not medical advice. The AI coach gives general guidance and defers medical questions to qualified professionals.
