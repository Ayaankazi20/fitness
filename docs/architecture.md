# Architecture

## Components
- **Mobile** (`mobile/`): Expo + React Native + TypeScript, NativeWind styling, React Navigation (bottom tabs + stack), Zustand stores (`session`, `draft`), `expo-camera`, `expo-image-picker`, `expo-secure-store` for tokens, `react-native-svg` for rings/charts.
- **Backend** (`backend/src`): Express 5 + TypeScript (strict). Layers: `routes` → `services` → Prisma. `schemas/` (Zod) validate every input. `middleware/` (auth, rate limits, error mapping). `config/` (env, plans, calorie constants).
- **Database**: PostgreSQL via Prisma 7 with the `pg` driver adapter.
- **AI**: `GeminiService` (real) / `MockGeminiService` (dev). Chosen by `AI_MODE`.
- **Nutrition**: `NutritionService` orchestrating pluggable `NutritionProvider`s: `IndianFoodProvider` (curated table), `UsdaProvider` (FoodData Central), `MockUsdaProvider` (dev).

## Food scan flow
```
POST /api/food/analyze (multipart image)
  validate image (magic bytes, size, dimensions)        utils/image.ts
  check monthly quota                                    usage.service.ts
  create food_scans(PROCESSING)
  Gemini → {foods:[{name, estimated_weight_g, confidence}], overall_confidence}   (JSON schema + Zod)
  sanitize (dedupe, clamp grams)
  for each food: NutritionService.resolve(name) → cache → Indian table → USDA → per-100g
  nutrition = per100g × grams / 100                      utils/nutritionMath.ts
  food_scans(COMPLETED, detected_foods, confidence); consume quota
  → response with foods, totals, warnings, suggested actions
mobile: user edits grams/foods (instant local recalculation, same formula) → POST /api/meals
POST /api/meals: server re-derives every item's nutrition from per-100g (client numbers are ignored), links scan.
GET /api/dashboard: aggregates meal_items for the day.
```
The image is processed in memory and never written to disk or the database.

## Key decisions
- **AI/nutrition separation** (the central design rule): the model's output type has no calorie field; prompts forbid it; the server computes nutrition from database values.
- **Daily totals are computed, not stored**: `dashboard`/`progress` aggregate `meal_items` (single source of truth, no sync bugs). The `daily_nutrition` table exists in the schema as an optional rollup for later scale but is not written by MVP code.
- **Provider abstraction**: add a source by implementing `NutritionProvider` (`search(query)`) and adding it to `buildNutritionService()`; an IFCT-backed Indian provider can replace the curated table without touching callers.
- **Auth**: 15-minute access JWT + rotating single-use refresh tokens stored hashed (SHA-256); reuse of a revoked token revokes all of that user's tokens. bcrypt (cost 12) for passwords; login does a constant-ish-time compare to avoid user enumeration.
- **Quotas/rate limits**: per-user rate limiter on `/food/analyze` and `/ai/chat`; monthly scan quota in `usage_counters`; plan→limit mapping in `config/plans.ts` (not hard-coded business logic).
- **Time zones**: clients send `tz` (minutes, `Date.getTimezoneOffset()` sign) so "today" is the user's local day.
- **Safety**: coach has a system prompt with safety rules plus a pre-model pattern guard for extreme restriction/purging requests that returns a fixed safe reply without calling the model; calorie targets have a sex-based floor and max deficit.
