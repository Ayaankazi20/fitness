# API reference

Base URL `/api`. JSON in/out unless noted. **Auth**: `Authorization: Bearer <access_token>` on everything except `/health` and `/auth/register|login|refresh|logout`.
Errors always look like `{ "error": { "code": "…", "message": "…", "details": … } }`.

Common errors: `400 VALIDATION_ERROR` (details = `[{path,message}]`), `401 UNAUTHORIZED`, `404 NOT_FOUND`, `429 RATE_LIMITED`, `500 INTERNAL`.
Query param `tz` = minutes behind UTC (`new Date().getTimezoneOffset()`; IST = `-330`) so "today" matches the user's day.

## Health
`GET /health` → `{status, ai_mode, nutrition_mode}`

## Auth
| Endpoint | Request | Response / errors |
|---|---|---|
| `POST /auth/register` | `{email, password(8–128)}` | `201 {user:{id,email}, tokens}`; `409 EMAIL_TAKEN` |
| `POST /auth/login` | `{email, password}` | `200 {user, tokens}`; `401 INVALID_CREDENTIALS` (same message for unknown email/wrong password) |
| `POST /auth/refresh` | `{refresh_token}` | `200 tokens` (token rotated, old one single-use); `401` (reuse revokes all) |
| `POST /auth/logout` | `{refresh_token}` | `204` |
| `POST /auth/forgot-password` | `{email}` | `202` always (never reveals whether the email exists); emails an 8-character code valid `RESET_CODE_TTL_MIN` (30) min; max one email/minute/account |
| `POST /auth/reset-password` | `{email, code, password(8–128)}` | `204`; `400 INVALID_RESET_CODE` (wrong/expired/used; code locks after 5 wrong attempts). Revokes all refresh tokens |
| `POST /auth/change-password` 🔒 | `{current_password, new_password}` | `200 {tokens}` (old refresh tokens revoked); `400 INVALID_CURRENT_PASSWORD` |
| `GET /auth/me` 🔒 | – | `{id,email,name,onboarded}` |

`tokens = {access_token, refresh_token, token_type:"Bearer", expires_in:"15m"}`. Auth routes (including forgot/reset) are IP rate-limited.

## Onboarding, profile, targets 🔒
- `POST /onboarding` `{profile:{name,age(13–100),gender:MALE|FEMALE|OTHER,height_cm,weight_kg,activity_level:SEDENTARY|LIGHT|MODERATE|VERY_ACTIVE|EXTREME,dietary_preference?,allergies?[],food_preferences?[]}, goal:{goal_type:LOSE_WEIGHT|MAINTAIN|GAIN_MUSCLE|GAIN_WEIGHT, target_weight_kg?}}` → `201 {profile, goal, targets}`. Computes estimated targets (Mifflin-St Jeor BMR × activity, goal adjustment, safety floor).
- `GET /profile` → `{profile, goal, targets}`; `PUT /profile` (partial profile; recomputes targets unless manual); `PUT /goals` `{goal_type, target_weight_kg?}` (`409 ONBOARDING_REQUIRED`).
- `GET /nutrition/targets`; `PUT /nutrition/targets` `{calories(800–6000),protein_g,carbs_g,fat_g}` (marks manual); `POST /nutrition/targets/recalculate`.
- `targets = {calories, protein_g, carbs_g, fat_g, bmr, tdee, is_manual, is_estimate:true, disclaimer}`.

## Food 🔒
### `POST /food/analyze` — multipart/form-data, field `image`
Limits: ≤ `MAX_IMAGE_MB`, JPEG/PNG/WEBP/HEIC by magic bytes, ≥100 px, ≤12000 px. Per-user rate limit (`ANALYZE_RATE_LIMIT_PER_MIN`) and monthly quota.
Response `200`:
```json
{ "scan_id": "uuid", "is_estimate": true, "overall_confidence": 0.89, "low_confidence": false, "notes": "…",
  "foods": [{ "key":"scan:0", "name":"Chicken Curry", "matched_name":"Chicken Curry", "food_item_id":"uuid", "match_source":"INDIAN_LOCAL",
              "weight_g":150, "confidence":0.91, "matched":true, "needs_review":false,
              "per_100g":{"calories":160,"protein_g":13,"carbs_g":4,"fat_g":10,"fiber_g":0.8,"sugar_g":1.5,"sodium_mg":380},
              "nutrition":{"calories":240,"protein_g":19.5,"carbs_g":6,"fat_g":15,"fiber_g":1.2,"sugar_g":2.3,"sodium_mg":570} }],
  "totals": { "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fiber_g": 0, "sugar_g": 0, "sodium_mg": 0 },
  "warnings": [{ "code":"LOW_CONFIDENCE|BLURRY_IMAGE|POOR_LIGHTING|MULTIPLE_FOODS|UNKNOWN_FOOD|NUTRITION_UNAVAILABLE", "message":"…" }],
  "suggested_actions": ["try_again","enter_manually"] }
```
Unmatched foods have `matched:false`, `per_100g:null`, `nutrition:null`.
Errors: `400 NO_IMAGE`, `413 IMAGE_TOO_LARGE`, `415 INVALID_IMAGE`, `422 IMAGE_TOO_SMALL|IMAGE_DIMENSIONS_TOO_LARGE`, `422 NO_FOOD_DETECTED` (`details.actions`), `429 QUOTA_EXCEEDED|RATE_LIMITED`, `502 AI_INVALID_RESPONSE|AI_FAILURE`, `503 AI_BUSY`, `504 AI_TIMEOUT`.
- `GET /food/search?q=` (≥2 chars) → `{results:[{food_item_id,name,source,per_100g}], warnings}`
- `GET /scan/usage` → `{plan, used, limit}`

## Meals 🔒
`meal_type`: BREAKFAST|LUNCH|SNACK|DINNER. Item input: `{name, weight_g(1–5000), food_item_id? | custom_per_100g?, ai_detected?, confidence?}`. With neither id nor custom values the server resolves by name. **The server always recomputes nutrition; client numbers are ignored.**
- `POST /meals` `{meal_type, eaten_at?(ISO), items[1–30], scan_id?}` → `201 meal`; `422 FOOD_NOT_FOUND`, `503 NUTRITION_UNAVAILABLE`
- `GET /meals?date=YYYY-MM-DD | from&to &tz &limit` → `{meals, totals}` (default last 14 days)
- `GET /meals/:id`, `PUT /meals/:id` (`meal_type?`, `eaten_at?`, `items?` replaces items), `DELETE /meals/:id` → `204`
- `meal = {id, meal_type, eaten_at, items:[{id,name,weight_g,food_item_id,ai_detected,confidence,calories,protein_g,carbs_g,fat_g,fiber_g,sugar_g,sodium_mg}], totals, is_estimate}`

## Dashboard & progress 🔒
- `GET /dashboard?date&tz` → `{date,name,targets,consumed,remaining,meal_count,meals_by_type[],weight{current_kg,start_kg,change_kg,target_kg},weekly{days_logged,days_in_range,days_target_achieved,avg_calories,avg_protein_g,days[]}}`
- `GET /progress?range=week|month&tz` → `{series[{date,calories,protein_g,carbs_g,fat_g,meal_count,achieved}], summary, weight{series,change_kg}, targets}`. A day is "achieved" when logged calories are within 85–110% of target (`config/nutritionConfig.ts`).

## Weight 🔒
- `POST /weight` `{weight_kg(25–350), date?}` → `201 {id,weight_kg,date}` (one log per day, upsert; latest syncs to profile)
- `GET /weight` → `{logs[], summary{start_kg,current_kg,change_kg}}`; `DELETE /weight/:id` → `204`

## AI coach 🔒
- `POST /ai/chat` `{message(≤1000), conversation_id?, tz?}` → `{conversation_id, reply, safety_triggered, disclaimer}`. Context (goal, weight, height, activity, targets, today's intake, remaining, preferences, allergies) is added server-side. Per-user rate limit. Unsafe requests (extreme restriction/purging) get a fixed safe reply without calling the model.
- `GET /ai/conversations/latest` → `{conversation_id, messages[]}`
