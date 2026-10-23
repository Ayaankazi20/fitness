import type { Per100g } from '../utils/nutritionMath.js';
import type { FoodSource } from '../generated/prisma/enums.js';

export interface FoodCandidate { source: FoodSource; externalId: string; name: string; per100g: Per100g; score: number }

/** Implement this to add a nutrition source (IFCT, restaurant data, branded products, admin foods...). */
export interface NutritionProvider {
  readonly name: string;
  search(query: string, limit?: number): Promise<FoodCandidate[]>;
}
export class NutritionProviderError extends Error {}
