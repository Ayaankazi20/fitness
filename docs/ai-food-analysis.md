# AI food analysis

## Separation of responsibilities
| Step | Owner | Output |
|---|---|---|
| What food is visible? How many grams? | Gemini Vision (`gemini.service.ts`) | name, `estimated_weight_g`, confidence, uncertainty |
| What does 100 g of it contain? | Nutrition DB (`nutrition.service.ts`) | calories/protein/carbs/fat/fiber/sugar/sodium per 100 g |
| What does this serving contain? | Backend math (`nutritionMath.ts`) | `per100g × grams / 100` |

Gemini is never asked for calories, and the validated response type has no calorie field. Example: Chicken Curry 150 g × 160 kcal/100 g = 240 kcal.

## Gemini request
`responseMimeType: application/json` + `responseJsonSchema` (see `ai/foodSchema.ts`), temperature 0.2, request timeout `GEMINI_TIMEOUT_MS` (30 s). Prompt (`ai/prompts.ts`) asks for common/Indian dish names, served grams, confidence, `image_issues` (`blurry|poor_lighting|not_food|multiple_dishes`).

## Never trust model output
1. Strip code fences → `JSON.parse` → Zod validation (ranges: weight 0–5000 g, confidence 0–1, ≤15 foods).
2. Invalid → **one repair retry** (the invalid text is shown back to the model); still invalid → `502 AI_INVALID_RESPONSE`.
3. `sanitizeDetected`: dedupe by normalized name, clamp 5–2000 g.
4. Provider errors map to `504 AI_TIMEOUT`, `503 AI_BUSY` (429), `502 AI_FAILURE`.

## Matching
`NutritionService.resolve(name)`: normalized-name/alias cache hit → providers in order (Indian table, USDA) → best candidate with score ≥ 0.6 (token overlap) is persisted and returned. Unmatched items come back `matched:false` with `needs_review`, never with invented numbers. Provider outage → `NUTRITION_UNAVAILABLE` warning (user can search manually).

## Result states
- No food / `not_food` low confidence → `422 NO_FOOD_DETECTED` (no quota used) with actions `try_again`, `enter_manually`.
- `overall_confidence < 0.6` or all items < 0.5 → `low_confidence: true`, `LOW_CONFIDENCE` warning, suggested actions.
- Blur/lighting/multiple foods → warnings. Items with confidence < 0.5 are flagged `needs_review`.
- Invalid/oversized/tiny images rejected before any AI call. Quota exceeded → `429 QUOTA_EXCEEDED`.

## Indian foods
`backend/src/data/indian-foods.ts` — curated per-100g reference values (approximate home-style averages) for roti/chapati, rice, dal, paneer, chicken & mutton curry, biryani, rajma, chole, sabzi, poha, upma, idli, dosa, paratha, misal pav, vada pav, samosa, pakora and more, with synonyms. It is searched before USDA. These are estimates; to improve accuracy add a provider backed by IFCT 2017 or a managed table implementing `NutritionProvider`.

## Dev mocks
`AI_MODE=mock` returns deterministic fake meals keyed on image bytes (not real vision); `NUTRITION_MODE=mock` replaces USDA with a tiny table. Both are labelled in code and reported by `/api/health`. Use `real` in production; with `real`, startup fails if the keys are missing.
