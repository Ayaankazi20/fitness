import { describe, expect, it } from 'vitest';
import { calculateServing } from '../src/utils/nutritionMath.js';
import { matchScore } from '../src/utils/match.js';
import { NutritionService } from '../src/services/nutrition.service.js';
import { IndianFoodProvider } from '../src/services/providers/indian.provider.js';
import { MockUsdaProvider } from '../src/services/providers/usda.mock.provider.js';
import { UsdaProvider, normalizeFdcFood } from '../src/services/providers/usda.provider.js';
import type { NutritionProvider } from '../src/services/nutrition.types.js';
import { prisma } from '../src/config/db.js';

const svc = () => new NutritionService([new IndianFoodProvider(), new MockUsdaProvider()]);

describe('nutrition calculation', () => {
  it('computes serving nutrition from per-100g values (187 kcal/100g x 150g = 280.5)', () => {
    const n = calculateServing({ calories: 187, protein_g: 17, carbs_g: 5, fat_g: 10.7, fiber_g: 2, sugar_g: 1.3, sodium_mg: 267 }, 150);
    expect(n.calories).toBe(280.5); expect(n.protein_g).toBe(25.5); expect(n.sodium_mg).toBe(401);
    expect(Object.keys(n)).toEqual(['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg']);
  });
  it('scales linearly with portion (change grams -> recalculation)', () => {
    const per = { calories: 130, protein_g: 2.7, carbs_g: 28.2, fat_g: 0.3, fiber_g: 0.4, sugar_g: 0.1, sodium_mg: 1 };
    expect(calculateServing(per, 200).calories).toBe(260); expect(calculateServing(per, 100).calories).toBe(130); expect(calculateServing(per, 0).calories).toBe(0);
  });
});

describe('food matching', () => {
  it('scores exact, partial and unrelated names', () => {
    expect(matchScore('Cooked Rice', 'cooked rice')).toBe(1);
    expect(matchScore('Cooked Rice', 'Rice, white, long-grain, regular, cooked')).toBeGreaterThanOrEqual(0.6);
    expect(matchScore('Rice, white, long-grain, cooked', 'Chicken curry')).toBe(0);
  });
  it('maps synonyms (chapati/phulka) to the roti entry', async () => {
    for (const q of ['chapati', 'phulka', 'Tawa Roti']) { const [top] = await new IndianFoodProvider().search(q); expect(top?.externalId, q).toBe('roti'); }
  });
  it('recognizes the Indian foods the PRD prioritizes', async () => {
    const names = ['Roti', 'Chapati', 'Rice', 'Dal', 'Paneer', 'Chicken Curry', 'Mutton Curry', 'Biryani', 'Rajma', 'Chole', 'Sabzi', 'Poha', 'Upma', 'Idli', 'Dosa', 'Paratha', 'Misal Pav', 'Vada Pav', 'Samosa', 'Pakora'];
    const s = svc();
    for (const n of names) { const r = await s.resolve(n); expect(r.status, n).toBe('matched'); if (r.status === 'matched') expect(r.food.source, n).toBe('INDIAN_LOCAL'); }
  });
});

describe('NutritionService (lookup, cache, fallbacks)', () => {
  it('resolves a food, persists it, then serves repeats from the local cache', async () => {
    const s = svc();
    const first = await s.resolve('Chapati');
    expect(first.status === 'matched' && first.food.fromCache).toBe(false);
    const second = await s.resolve('Chapati');
    expect(second.status === 'matched' && second.food.fromCache).toBe(true);
    expect(await prisma.foodItem.count()).toBe(1);
    expect(await prisma.foodNutrition.count()).toBe(1);
  });
  it('cache hit does not call any provider', async () => {
    let calls = 0;
    const counting: NutritionProvider = { name: 'counting', async search(q) { calls++; return new IndianFoodProvider().search(q); } };
    const s = new NutritionService([counting]);
    await s.resolve('Dal'); await s.resolve('Dal'); await s.resolve('dal');
    expect(calls).toBe(1);
  });
  it('falls through to the second provider when the Indian table has no match', async () => {
    const r = await svc().resolve('Banana');
    expect(r.status === 'matched' && r.food.source).toBe('MOCK');
  });
  it('reports not_found for unknown foods and unavailable when a provider fails', async () => {
    expect((await svc().resolve('zzzxqv')).status).toBe('not_found');
    const failing: NutritionProvider = { name: 'down', async search() { throw new Error('boom'); } };
    const r = await new NutritionService([failing]).resolve('Banana');
    expect(r.status).toBe('unavailable');
  });
  it('manual search returns cached candidates with stable ids', async () => {
    const { results } = await svc().search('paneer');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.foodItemId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('USDA provider', () => {
  const fdc = { foods: [
    { fdcId: 169756, description: 'Rice, white, long-grain, regular, cooked', foodNutrients: [{ nutrientId: 1008, value: 130 }, { nutrientId: 1003, value: 2.69 }, { nutrientId: 1004, value: 0.28 }, { nutrientId: 1005, value: 28.17 }, { nutrientId: 1079, value: 0.4 }, { nutrientId: 2000, value: 0.05 }, { nutrientId: 1093, value: 1 }] },
    { fdcId: 1, description: 'Broken entry without energy', foodNutrients: [{ nutrientId: 1003, value: 1 }] },
  ] };
  it('normalizes FoodData Central nutrients to the standard shape', () => {
    expect(normalizeFdcFood(fdc.foods[0]!)).toEqual({ calories: 130, protein_g: 2.69, carbs_g: 28.17, fat_g: 0.28, fiber_g: 0.4, sugar_g: 0.05, sodium_mg: 1 });
    expect(normalizeFdcFood(fdc.foods[1]!)).toBeNull();
  });
  it('searches via fetch and ranks matches; maps HTTP failures to provider errors', async () => {
    const ok = new UsdaProvider('KEY', (async (url: any) => { expect(String(url)).toContain('api_key=KEY'); return new Response(JSON.stringify(fdc), { status: 200 }); }) as any);
    const res = await ok.search('cooked rice');
    expect(res).toHaveLength(1); expect(res[0]!.source).toBe('USDA'); expect(res[0]!.score).toBeGreaterThan(0.6);
    const bad = new UsdaProvider('KEY', (async () => new Response('x', { status: 500 })) as any);
    await expect(bad.search('rice')).rejects.toThrow(/500/);
    await expect(new UsdaProvider(undefined as any).search('rice')).rejects.toThrow(/not configured/);
  });
});
