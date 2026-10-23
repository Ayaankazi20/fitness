import { prisma } from '../config/db.js';
import { AppError, notFound } from '../utils/errors.js';
import { dayRangeUtc, addDays } from '../utils/dates.js';
import { NutritionService, type NutritionService as NSType } from './nutrition.service.js';
import { sumNutrition, calculateServing, type Nutrition } from '../utils/nutritionMath.js';
import type { z } from 'zod';
import type { mealItemInputSchema } from '../schemas/index.js';
import type { MealType } from '../generated/prisma/enums.js';

type ItemIn = z.infer<typeof mealItemInputSchema>;
const include = { items: { orderBy: { createdAt: 'asc' as const } } };
type MealRow = Awaited<ReturnType<typeof prisma.meal.findFirstOrThrow<{ include: typeof include }>>>;

const itemNutrition = (i: MealRow['items'][number]): Nutrition => ({ calories: i.calories, protein_g: i.proteinG, carbs_g: i.carbsG, fat_g: i.fatG, fiber_g: i.fiberG, sugar_g: i.sugarG, sodium_mg: i.sodiumMg });

export function mealDto(m: MealRow) {
  return {
    id: m.id, meal_type: m.mealType, eaten_at: m.eatenAt.toISOString(),
    items: m.items.map((i) => ({ id: i.id, name: i.name, weight_g: i.weightG, food_item_id: i.foodItemId, ai_detected: i.aiDetected, confidence: i.confidence, ...itemNutrition(i) })),
    totals: sumNutrition(m.items.map(itemNutrition)), is_estimate: true,
  };
}

export class MealService {
  constructor(private nutrition: NSType) {}

  /** Server recalculates every item from database per-100g values; client-supplied nutrition is never trusted. */
  private async buildItems(items: ItemIn[]) {
    const out = [];
    for (const it of items) {
      let per, foodItemId: string | null = null;
      if (it.food_item_id) {
        const f = await this.nutrition.getPer100g(it.food_item_id);
        if (!f) throw new AppError(422, 'FOOD_NOT_FOUND', `Food "${it.name}" not found in the nutrition database.`);
        per = f.per100g; foodItemId = it.food_item_id;
      } else if (it.custom_per_100g) {
        per = it.custom_per_100g;
      } else {
        const r = await this.nutrition.resolve(it.name);
        if (r.status === 'matched') { per = r.food.per100g; foodItemId = r.food.foodItemId; }
        else if (r.status === 'unavailable') throw new AppError(503, 'NUTRITION_UNAVAILABLE', 'The nutrition database is unavailable. Enter nutrition values manually or try again.');
        else throw new AppError(422, 'FOOD_NOT_FOUND', `Couldn't find "${it.name}". Search for another food or enter nutrition manually.`, { name: it.name });
      }
      const n = calculateServing(per, it.weight_g);
      out.push({ foodItemId, name: it.name, weightG: it.weight_g, calories: n.calories, proteinG: n.protein_g, carbsG: n.carbs_g, fatG: n.fat_g, fiberG: n.fiber_g, sugarG: n.sugar_g, sodiumMg: n.sodium_mg, aiDetected: it.ai_detected ?? false, confidence: it.confidence ?? null });
    }
    return out;
  }

  async create(userId: string, input: { meal_type: MealType; eaten_at?: string; items: ItemIn[]; scan_id?: string }) {
    const items = await this.buildItems(input.items);
    const meal = await prisma.$transaction(async (tx) => {
      const m = await tx.meal.create({ data: { userId, mealType: input.meal_type, eatenAt: input.eaten_at ? new Date(input.eaten_at) : new Date(), items: { create: items } }, include });
      if (input.scan_id) {
        const scan = await tx.foodScan.findFirst({ where: { id: input.scan_id, userId, mealId: null } });
        if (scan) await tx.foodScan.update({ where: { id: scan.id }, data: { mealId: m.id, finalFoods: m.items.map((i) => ({ name: i.name, weight_g: i.weightG, calories: i.calories })) } });
      }
      return m;
    });
    return mealDto(meal);
  }

  async get(userId: string, id: string) {
    const m = await prisma.meal.findFirst({ where: { id, userId }, include });
    if (!m) throw notFound('Meal');
    return mealDto(m);
  }

  async update(userId: string, id: string, patch: { meal_type?: MealType; eaten_at?: string; items?: ItemIn[] }) {
    if (!(await prisma.meal.findFirst({ where: { id, userId }, select: { id: true } }))) throw notFound('Meal');
    const items = patch.items ? await this.buildItems(patch.items) : null;
    const m = await prisma.$transaction(async (tx) => {
      if (items) { await tx.mealItem.deleteMany({ where: { mealId: id } }); await tx.mealItem.createMany({ data: items.map((i) => ({ ...i, mealId: id })) }); }
      return tx.meal.update({ where: { id }, data: { ...(patch.meal_type && { mealType: patch.meal_type }), ...(patch.eaten_at && { eatenAt: new Date(patch.eaten_at) }) }, include });
    });
    return mealDto(m);
  }

  async remove(userId: string, id: string) {
    const r = await prisma.meal.deleteMany({ where: { id, userId } });
    if (!r.count) throw notFound('Meal');
  }

  async list(userId: string, q: { date?: string; from?: string; to?: string; tz: number; limit: number }) {
    let start: Date, end: Date;
    if (q.date) ({ start, end } = dayRangeUtc(q.date, q.tz));
    else {
      const to = q.to ?? new Date(Date.now() - q.tz * 60000).toISOString().slice(0, 10);
      start = dayRangeUtc(q.from ?? addDays(to, -13), q.tz).start; end = dayRangeUtc(to, q.tz).end;
    }
    const meals = await prisma.meal.findMany({ where: { userId, eatenAt: { gte: start, lt: end } }, include, orderBy: { eatenAt: 'desc' }, take: q.limit });
    const dtos = meals.map(mealDto);
    return { meals: dtos, totals: sumNutrition(dtos.map((m) => m.totals)) };
  }
}
void NutritionService;
