import { env } from '../../config/env.js';
import { matchScore } from '../../utils/match.js';
import { NutritionProviderError, type FoodCandidate, type NutritionProvider } from '../nutrition.types.js';
import type { Per100g } from '../../utils/nutritionMath.js';

interface FdcNutrient { nutrientId?: number; nutrientNumber?: string; nutrientName?: string; unitName?: string; value?: number }
interface FdcFood { fdcId: number; description: string; dataType?: string; foodNutrients?: FdcNutrient[] }

const val = (n: FdcNutrient[], ids: number[], numbers: string[] = []): number | undefined => {
  for (const id of ids) { const x = n.find((y) => y.nutrientId === id); if (x?.value != null) return x.value; }
  for (const num of numbers) { const x = n.find((y) => y.nutrientNumber === num); if (x?.value != null) return x.value; }
  return undefined;
};

/** Maps a FoodData Central search hit (nutrients are per 100 g for Foundation/SR Legacy/FNDDS) to our standard shape. */
export function normalizeFdcFood(f: FdcFood): Per100g | null {
  const n = f.foodNutrients ?? [];
  const calories = val(n, [1008, 2047, 2048], ['208', '957', '958']);
  if (calories == null) return null;
  return {
    calories,
    protein_g: val(n, [1003], ['203']) ?? 0,
    carbs_g: val(n, [1005], ['205']) ?? 0,
    fat_g: val(n, [1004], ['204']) ?? 0,
    fiber_g: val(n, [1079], ['291']) ?? 0,
    sugar_g: val(n, [2000], ['269']) ?? 0,
    sodium_mg: val(n, [1093], ['307']) ?? 0,
  };
}

export class UsdaProvider implements NutritionProvider {
  readonly name = 'usda';
  constructor(private apiKey = env.USDA_API_KEY, private fetchImpl: typeof fetch = (u, o) => fetch(u, { ...o, headers: { connection: "close" } }), private timeoutMs = env.USDA_TIMEOUT_MS) {}

  async search(query: string, limit = 8): Promise<FoodCandidate[]> {
    if (!this.apiKey) throw new NutritionProviderError('USDA_API_KEY is not configured');
    const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
    url.searchParams.set('api_key', this.apiKey);
    url.searchParams.set('query', query);
    url.searchParams.set('pageSize', '15');
    url.searchParams.set('dataType', 'Foundation,SR Legacy,Survey (FNDDS)');
        let res: Response | undefined;
    let detail = '';
    for (let attempt = 1; attempt <= 5; attempt++) {
      try { res = await this.fetchImpl(url, { signal: AbortSignal.timeout(this.timeoutMs) }); }
      catch (e) { throw new NutritionProviderError(`USDA request failed: ${(e as Error).message}`); }
      if (res.ok) break;
      detail = (await res.text()).slice(0, 200);
      const retryable = res.status === 400 || res.status === 429 || res.status >= 500;
      if (!retryable || attempt === 5) break;
      await new Promise((r) => setTimeout(r, 300 * attempt));
    }
    if (!res || !res.ok) throw new NutritionProviderError(`USDA responded ${res?.status}: ${detail}`);
    
    const body = (await res.json()) as { foods?: FdcFood[] };
    const out: FoodCandidate[] = [];
    for (const f of body.foods ?? []) {
      const per100g = normalizeFdcFood(f);
      if (!per100g) continue;
      out.push({ source: 'USDA', externalId: String(f.fdcId), name: f.description, per100g, score: matchScore(query, f.description) });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}
