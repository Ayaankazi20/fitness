import { prisma } from '../config/db.js';
import { AppError } from '../utils/errors.js';
import { normalizeFoodName } from '../utils/match.js';
import type { VisionService, DetectedFood } from '../ai/foodSchema.js';
import type { NutritionService, ResolveResult } from './nutrition.service.js';
import { NutritionService as NS } from './nutrition.service.js';
import { sumNutrition, type Nutrition, type Per100g } from '../utils/nutritionMath.js';
import { validateImage } from '../utils/image.js';
import { assertScanQuota, consumeScan } from './usage.service.js';

export const LOW_CONFIDENCE_OVERALL = 0.6;
export const LOW_CONFIDENCE_ITEM = 0.5;

export interface AnalyzedFood {
  key: string; name: string; matched_name: string | null; food_item_id: string | null; match_source: string | null;
  weight_g: number; confidence: number; portion_description?: string; uncertainty?: string;
  matched: boolean; needs_review: boolean; per_100g: Per100g | null; nutrition: Nutrition | null;
}
export interface Warning { code: string; message: string }

/** Drops duplicates and clamps estimates. Returns cleaned foods; the model output has already passed schema validation. */
export function sanitizeDetected(foods: DetectedFood[]): DetectedFood[] {
  const seen = new Set<string>(); const out: DetectedFood[] = [];
  for (const f of foods) {
    const k = normalizeFoodName(f.name); if (!k || seen.has(k)) continue; seen.add(k);
    out.push({ ...f, estimated_weight_g: Math.min(Math.max(Math.round(f.estimated_weight_g), 5), 2000) });
  }
  return out;
}

export class FoodAnalysisService {
  constructor(private vision: VisionService, private nutrition: NutritionService) {}

  async analyze(userId: string, file: { buffer: Buffer; size: number } | undefined) {
    const img = validateImage(file);
    await assertScanQuota(userId);
    const scan = await prisma.foodScan.create({ data: { userId, status: 'PROCESSING' } });
    try {
      const result = await this.vision.identifyFood({ buffer: img.buffer, mimeType: img.mimeType });
      const issues = result.image_issues ?? [];
      const foods = sanitizeDetected(result.foods);
      if (!foods.length || (issues.includes('not_food') && result.overall_confidence < 0.5)) {
        await prisma.foodScan.update({ where: { id: scan.id }, data: { status: 'NO_FOOD', detectedFoods: result.foods as any, overallConfidence: result.overall_confidence, errorCode: 'NO_FOOD_DETECTED', notes: result.notes } });
        throw new AppError(422, 'NO_FOOD_DETECTED', "We couldn't find any food in this photo. Try a closer, well-lit shot, or enter your meal manually.", { image_issues: issues, actions: ['try_again', 'enter_manually'] });
      }

      const resolved: ResolveResult[] = await Promise.all(foods.map((f) => this.nutrition.resolve(f.name)));
      const warnings: Warning[] = [];
      const items: AnalyzedFood[] = foods.map((f, i) => {
        const r = resolved[i]!;
        const matched = r.status === 'matched';
        const base = { key: `${scan.id}:${i}`, name: f.name, weight_g: f.estimated_weight_g, confidence: f.confidence, portion_description: f.portion_description, uncertainty: f.uncertainty };
        if (r.status === 'matched') {
          return { ...base, matched_name: r.food.name, food_item_id: r.food.foodItemId, match_source: r.food.source, matched: true, needs_review: f.confidence < LOW_CONFIDENCE_ITEM, per_100g: r.food.per100g, nutrition: NS.calculate(r.food.per100g, f.estimated_weight_g) };
        }
        return { ...base, matched_name: null, food_item_id: null, match_source: null, matched, needs_review: true, per_100g: null, nutrition: null };
      });

      if (resolved.some((r) => r.status === 'unavailable')) warnings.push({ code: 'NUTRITION_UNAVAILABLE', message: 'The nutrition database is temporarily unavailable for some items. You can search manually.' });
      if (items.some((i) => !i.matched) && !warnings.length) warnings.push({ code: 'UNKNOWN_FOOD', message: "Some foods weren't found in the nutrition database. Search for them or enter values manually." });
      const low = result.overall_confidence < LOW_CONFIDENCE_OVERALL || items.every((i) => i.confidence < LOW_CONFIDENCE_ITEM);
      if (low) warnings.push({ code: 'LOW_CONFIDENCE', message: "We couldn't confidently identify your meal. Please review each item, or try again." });
      if (issues.includes('blurry')) warnings.push({ code: 'BLURRY_IMAGE', message: 'The photo looks blurry, so portions may be off.' });
      if (issues.includes('poor_lighting')) warnings.push({ code: 'POOR_LIGHTING', message: 'Low light can reduce accuracy.' });
      if (issues.includes('multiple_dishes') || items.length > 4) warnings.push({ code: 'MULTIPLE_FOODS', message: 'Several foods were detected. Check each portion.' });

      const totals = sumNutrition(items.flatMap((i) => (i.nutrition ? [i.nutrition] : [])));
      await prisma.foodScan.update({ where: { id: scan.id }, data: { status: 'COMPLETED', detectedFoods: items as any, overallConfidence: result.overall_confidence, notes: result.notes } });
      await consumeScan(userId);
      return { scan_id: scan.id, foods: items, totals, overall_confidence: result.overall_confidence, low_confidence: low, notes: result.notes ?? null, warnings, is_estimate: true,
        suggested_actions: low ? ['try_again', 'enter_manually'] : [] };
    } catch (e) {
      if (!(e instanceof AppError && e.code === 'NO_FOOD_DETECTED')) {
        await prisma.foodScan.update({ where: { id: scan.id }, data: { status: 'FAILED', errorCode: e instanceof AppError ? e.code : 'INTERNAL' } }).catch(() => undefined);
      }
      throw e;
    }
  }
}
