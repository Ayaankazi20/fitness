import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { normalizeFoodName } from '../utils/match.js';
import { calculateServing, type Nutrition, type Per100g } from '../utils/nutritionMath.js';
import { IndianFoodProvider } from './providers/indian.provider.js';
import { UsdaProvider } from './providers/usda.provider.js';
import { MockUsdaProvider } from './providers/usda.mock.provider.js';
import type { FoodCandidate, NutritionProvider } from './nutrition.types.js';

export const MATCH_THRESHOLD = 0.6;

export interface ResolvedFood { foodItemId: string; name: string; source: string; per100g: Per100g; score: number; fromCache: boolean }
export type ResolveResult =
  | { status: 'matched'; food: ResolvedFood }
  | { status: 'not_found' }
  | { status: 'unavailable'; reason: string };

type Db = typeof prisma;
const rowToPer100 = (n: { caloriesPer100g: number; proteinPer100g: number; carbsPer100g: number; fatPer100g: number; fiberPer100g: number; sugarPer100g: number; sodiumMgPer100g: number }): Per100g =>
  ({ calories: n.caloriesPer100g, protein_g: n.proteinPer100g, carbs_g: n.carbsPer100g, fat_g: n.fatPer100g, fiber_g: n.fiberPer100g, sugar_g: n.sugarPer100g, sodium_mg: n.sodiumMgPer100g });

/**
 * Orchestrates nutrition lookups: local cache -> providers (in priority order) -> persist standardized result.
 * Providers are pluggable; the first provider with a confident match wins (Indian table before USDA).
 */
export class NutritionService {
  constructor(private providers: NutritionProvider[], private db: Db = prisma) {}

  /** Standard nutrition for an estimated serving. */
  static calculate(per100g: Per100g, grams: number): Nutrition { return calculateServing(per100g, grams); }

  private async fromCache(normalized: string): Promise<ResolvedFood | null> {
    const row = await this.db.foodItem.findFirst({
      where: { OR: [{ normalizedName: normalized }, { aliases: { has: normalized } }], nutrition: { isNot: null } },
      include: { nutrition: true }, orderBy: { createdAt: 'asc' },
    });
    if (!row?.nutrition) return null;
    return { foodItemId: row.id, name: row.name, source: row.source, per100g: rowToPer100(row.nutrition), score: 1, fromCache: true };
  }

  private async persist(c: FoodCandidate, alias?: string): Promise<ResolvedFood> {
    const normalizedName = normalizeFoodName(c.name);
    const existing = await this.db.foodItem.findUnique({ where: { source_externalId: { source: c.source, externalId: c.externalId } }, select: { id: true, aliases: true } });
    const aliases = new Set(existing?.aliases ?? []);
    if (alias && alias !== normalizedName) aliases.add(alias);
    const per = { caloriesPer100g: c.per100g.calories, proteinPer100g: c.per100g.protein_g, carbsPer100g: c.per100g.carbs_g, fatPer100g: c.per100g.fat_g, fiberPer100g: c.per100g.fiber_g, sugarPer100g: c.per100g.sugar_g, sodiumMgPer100g: c.per100g.sodium_mg };
    const item = await this.db.foodItem.upsert({
      where: { source_externalId: { source: c.source, externalId: c.externalId } },
      create: { name: c.name, normalizedName, source: c.source, externalId: c.externalId, aliases: [...aliases], nutrition: { create: per } },
      update: { aliases: [...aliases] },
    });
    return { foodItemId: item.id, name: item.name, source: c.source, per100g: c.per100g, score: c.score, fromCache: false };
  }

  /** Find the best database match for a food name produced by the vision model or typed by the user. */
  async resolve(rawName: string): Promise<ResolveResult> {
    const normalized = normalizeFoodName(rawName);
    if (!normalized) return { status: 'not_found' };
    const cached = await this.fromCache(normalized);
    if (cached) return { status: 'matched', food: cached };
    let lastError: string | null = null;
    for (const p of this.providers) {
      try {
        const best = (await p.search(rawName, 5)).sort((a, b) => b.score - a.score)[0];
        if (best && best.score >= MATCH_THRESHOLD) return { status: 'matched', food: await this.persist(best, normalized) };
      } catch (e) { lastError = `${p.name}: ${(e as Error).message}`; }
    }
    return lastError ? { status: 'unavailable', reason: lastError } : { status: 'not_found' };
  }

  /** Manual search: merged candidates across providers; each is cached so the client gets a stable food_item_id. */
  async search(query: string, limit = 8): Promise<{ results: ResolvedFood[]; warnings: string[] }> {
    const warnings: string[] = [];
    const all: FoodCandidate[] = [];
    for (const p of this.providers) {
      try { all.push(...(await p.search(query, limit))); } catch (e) { warnings.push(`${p.name} unavailable`); }
    }
    const top = all.filter((c) => c.score >= 0.4).sort((a, b) => b.score - a.score).slice(0, limit);
    const results: ResolvedFood[] = [];
    for (const c of top) results.push(await this.persist(c));
    return { results, warnings };
  }

  async getPer100g(foodItemId: string): Promise<{ name: string; per100g: Per100g } | null> {
    const row = await this.db.foodItem.findUnique({ where: { id: foodItemId }, include: { nutrition: true } });
    return row?.nutrition ? { name: row.name, per100g: rowToPer100(row.nutrition) } : null;
  }
}

export function buildNutritionService(): NutritionService {
  const providers: NutritionProvider[] = [new IndianFoodProvider(), env.NUTRITION_MODE === 'mock' ? new MockUsdaProvider() : new UsdaProvider()];
  return new NutritionService(providers);
}
