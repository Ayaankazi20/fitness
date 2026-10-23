# Database

PostgreSQL, managed by Prisma (`backend/prisma/schema.prisma`). All ids are UUIDs; all tables have `created_at` (and `updated_at` where rows change). User-owned tables cascade on user delete.

| Table | Purpose | Notes |
|---|---|---|
| `users` | accounts | unique `email`; `password_hash` (bcrypt) |
| `refresh_tokens` | rotating refresh tokens | `token_hash` unique; `revoked_at`; cascade |
| `password_reset_tokens` | one-time reset codes | stores only a SHA-256 hash, `expires_at`, `used_at`, `attempts`; cascade |
| `user_profiles` | body info & preferences | 1:1 with user (unique `user_id`) |
| `fitness_goals` | goal history | `is_active`; index `(user_id,is_active)` |
| `nutrition_targets` | estimated/manual targets | `is_manual`, stores BMR/TDEE; history kept, one active |
| `food_items` | cached foods | unique `(source, external_id)`; `normalized_name` + `aliases` indexed for cache hits |
| `food_nutrition` | per-100g nutrition | 1:1 with `food_items`, cascade |
| `food_scans` | one row per analysis | status (`PROCESSING/COMPLETED/FAILED/NO_FOOD`), `detected_foods` JSON, `overall_confidence`, `final_foods` (user corrections), unique `meal_id` → `SET NULL` |
| `meals` | a logged meal | index `(user_id, eaten_at)` |
| `meal_items` | foods in a meal | stores computed nutrition + grams; `food_item_id` → `SET NULL`; cascade from meal |
| `weight_logs` | weights | unique `(user_id, logged_on)` (one per day, upsert) |
| `daily_nutrition` | optional rollup | unique `(user_id, date)`; not written by the MVP (totals are computed) |
| `ai_conversations`, `ai_messages` | coach history | cascade |
| `usage_counters` | per-feature monthly usage | unique `(user_id, feature, period)` for quotas |

Images are not stored. `food_scans.detected_foods` holds only parsed results.

## Migrations
Migrations: `20261004000000_init` (core schema) and `20261005000000_password_reset`. `backend/prisma/migrations/<timestamp>_<name>/migration.sql` is applied by `npm run migrate` (records applied names in `_applied_migrations`) or `prisma migrate deploy`. `scripts/schema_to_sql.py` regenerates the initial SQL from the schema in network-restricted environments; with normal network access prefer `prisma migrate dev`.
