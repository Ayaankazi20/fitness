import { matchScore } from '../../utils/match.js';
import type { FoodCandidate, NutritionProvider } from '../nutrition.types.js';
import type { Per100g } from '../../utils/nutritionMath.js';

const f = (calories: number, protein_g: number, carbs_g: number, fat_g: number, fiber_g: number, sugar_g: number, sodium_mg: number): Per100g => ({ calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg });

/** DEVELOPMENT ONLY: stands in for USDA when NUTRITION_MODE=mock. Small fixed table of common foods (approximate USDA-like values). */
const TABLE: Array<{ id: string; name: string; per100g: Per100g }> = [
  { id: 'm-salad', name: 'Mixed green salad', per100g: f(20, 1.4, 3.6, 0.2, 1.8, 1.8, 28) },
  { id: 'm-chicken-breast', name: 'Chicken breast, cooked', per100g: f(165, 31, 0, 3.6, 0, 0, 74) },
  { id: 'm-banana', name: 'Banana', per100g: f(89, 1.1, 22.8, 0.3, 2.6, 12.2, 1) },
  { id: 'm-apple', name: 'Apple', per100g: f(52, 0.3, 13.8, 0.2, 2.4, 10.4, 1) },
  { id: 'm-bread', name: 'Bread, whole wheat', per100g: f(252, 12.5, 42.7, 3.5, 6, 6, 450) },
  { id: 'm-sandwich', name: 'Sandwich', per100g: f(230, 11, 27, 8, 2, 4, 520) },
  { id: 'm-pasta', name: 'Pasta, cooked', per100g: f(158, 5.8, 30.9, 0.9, 1.8, 0.6, 1) },
  { id: 'm-oats', name: 'Oatmeal, cooked', per100g: f(71, 2.5, 12, 1.5, 1.7, 0.3, 4) },
];
export class MockUsdaProvider implements NutritionProvider {
  readonly name = 'usda-mock';
  async search(query: string, limit = 5): Promise<FoodCandidate[]> {
    return TABLE.map((t) => ({ source: 'MOCK' as const, externalId: t.id, name: t.name, per100g: t.per100g, score: matchScore(query, t.name) }))
      .filter((c) => c.score > 0.3).sort((a, b) => b.score - a.score).slice(0, limit);
  }
}
