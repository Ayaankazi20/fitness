import { INDIAN_FOODS } from '../../data/indian-foods.js';
import { matchScore } from '../../utils/match.js';
import type { FoodCandidate, NutritionProvider } from '../nutrition.types.js';

/** Curated local table; always available (no network). */
export class IndianFoodProvider implements NutritionProvider {
  readonly name = 'indian-local';
  async search(query: string, limit = 5): Promise<FoodCandidate[]> {
    return INDIAN_FOODS
      .map((food) => ({ food, score: Math.max(matchScore(query, food.name), ...food.synonyms.map((s) => matchScore(query, s))) }))
      .filter((x) => x.score > 0.3)
      .sort((a, b) => b.score - a.score).slice(0, limit)
      .map(({ food, score }) => ({ source: 'INDIAN_LOCAL' as const, externalId: food.id, name: food.name, per100g: food.per100g, score }));
  }
}
