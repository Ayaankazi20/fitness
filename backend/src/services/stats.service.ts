import { prisma } from '../config/db.js';
import { nutritionConfig } from '../config/nutritionConfig.js';
import { addDays, dayRangeUtc, localDateString, todayString } from '../utils/dates.js';
import { notFound } from '../utils/errors.js';
import { emptyNutrition, sumNutrition, type Nutrition } from '../utils/nutritionMath.js';
import { mealDto } from './meal.service.js';
import { targetsDto } from './profile.service.js';

const include = { items: { orderBy: { createdAt: 'asc' as const } } };
const MEAL_ORDER = ['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER'] as const;

export interface DayStat { date: string; meal_count: number; totals: Nutrition }

/** Daily totals are computed directly from meal_items (single source of truth; no duplicated rollup to keep in sync). */
export async function dayStats(userId: string, fromDate: string, toDate: string, tz: number): Promise<DayStat[]> {
  const meals = await prisma.meal.findMany({ where: { userId, eatenAt: { gte: dayRangeUtc(fromDate, tz).start, lt: dayRangeUtc(toDate, tz).end } }, include });
  const buckets = new Map<string, { n: Nutrition[]; count: number }>();
  for (const m of meals) {
    const d = localDateString(m.eatenAt, tz);
    const b = buckets.get(d) ?? { n: [], count: 0 };
    b.count += 1; b.n.push(...m.items.map((i) => ({ calories: i.calories, protein_g: i.proteinG, carbs_g: i.carbsG, fat_g: i.fatG, fiber_g: i.fiberG, sugar_g: i.sugarG, sodium_mg: i.sodiumMg })));
    buckets.set(d, b);
  }
  const out: DayStat[] = [];
  for (let d = fromDate; d <= toDate; d = addDays(d, 1)) { const b = buckets.get(d); out.push({ date: d, meal_count: b?.count ?? 0, totals: b ? sumNutrition(b.n) : emptyNutrition() }); }
  return out;
}

export const targetAchieved = (calories: number, target: number, mealCount: number) =>
  mealCount > 0 && calories >= target * nutritionConfig.achievedBand.min && calories <= target * nutritionConfig.achievedBand.max;

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0);
function summarize(days: DayStat[], targetCalories: number) {
  const logged = days.filter((d) => d.meal_count > 0);
  return {
    days_logged: logged.length, days_in_range: days.length,
    avg_calories: avg(logged.map((d) => d.totals.calories)), avg_protein_g: avg(logged.map((d) => d.totals.protein_g)),
    avg_carbs_g: avg(logged.map((d) => d.totals.carbs_g)), avg_fat_g: avg(logged.map((d) => d.totals.fat_g)),
    days_target_achieved: days.filter((d) => targetAchieved(d.totals.calories, targetCalories, d.meal_count)).length,
  };
}

export async function getActiveTarget(userId: string) {
  return prisma.nutritionTarget.findFirst({ where: { userId, isActive: true }, orderBy: { createdAt: 'desc' } });
}

export async function dashboard(userId: string, date: string | undefined, tz: number) {
  const day = date ?? todayString(tz);
  const [profile, target, meals, weights, week] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    getActiveTarget(userId),
    prisma.meal.findMany({ where: { userId, eatenAt: { gte: dayRangeUtc(day, tz).start, lt: dayRangeUtc(day, tz).end } }, include, orderBy: { eatenAt: 'asc' } }),
    prisma.weightLog.findMany({ where: { userId }, orderBy: { loggedOn: 'asc' } }),
    dayStats(userId, addDays(day, -6), day, tz),
  ]);
  if (!profile || !target) throw notFound('Profile');
  const dtos = meals.map(mealDto);
  const consumed = sumNutrition(dtos.map((m) => m.totals));
  const t = { calories: target.calories, protein_g: target.proteinG, carbs_g: target.carbsG, fat_g: target.fatG };
  const rem = (a: number, b: number) => Math.round((a - b) * 10) / 10;
  const first = weights[0], last = weights[weights.length - 1];
  return {
    date: day, name: profile.name,
    targets: targetsDto(target), consumed,
    remaining: { calories: rem(t.calories, consumed.calories), protein_g: rem(t.protein_g, consumed.protein_g), carbs_g: rem(t.carbs_g, consumed.carbs_g), fat_g: rem(t.fat_g, consumed.fat_g) },
    meal_count: dtos.length,
    meals_by_type: MEAL_ORDER.map((type) => { const ms = dtos.filter((m) => m.meal_type === type); return { meal_type: type, meals: ms, totals: sumNutrition(ms.map((m) => m.totals)) }; }),
    weight: { current_kg: last?.weightKg ?? profile.weightKg, start_kg: first?.weightKg ?? null, change_kg: first && last ? Math.round((last.weightKg - first.weightKg) * 10) / 10 : null, target_kg: (await prisma.fitnessGoal.findFirst({ where: { userId, isActive: true } }))?.targetWeightKg ?? null },
    weekly: { ...summarize(week, t.calories), days: week.map((d) => ({ date: d.date, calories: d.totals.calories, achieved: targetAchieved(d.totals.calories, t.calories, d.meal_count) })) },
    is_estimate: true,
  };
}

export async function progress(userId: string, range: 'week' | 'month', tz: number) {
  const n = range === 'week' ? 7 : 30;
  const to = todayString(tz), from = addDays(to, -(n - 1));
  const target = await getActiveTarget(userId);
  if (!target) throw notFound('Targets');
  const [days, weights] = await Promise.all([
    dayStats(userId, from, to, tz),
    prisma.weightLog.findMany({ where: { userId, loggedOn: { gte: new Date(from + 'T00:00:00Z'), lte: new Date(to + 'T00:00:00Z') } }, orderBy: { loggedOn: 'asc' } }),
  ]);
  const w = weights.map((x) => ({ date: x.loggedOn.toISOString().slice(0, 10), weight_kg: x.weightKg }));
  return {
    range, from, to, targets: { calories: target.calories, protein_g: target.proteinG, carbs_g: target.carbsG, fat_g: target.fatG },
    series: days.map((d) => ({ date: d.date, calories: d.totals.calories, protein_g: d.totals.protein_g, carbs_g: d.totals.carbs_g, fat_g: d.totals.fat_g, meal_count: d.meal_count, achieved: targetAchieved(d.totals.calories, target.calories, d.meal_count) })),
    summary: summarize(days, target.calories),
    weight: { series: w, change_kg: w.length > 1 ? Math.round((w[w.length - 1]!.weight_kg - w[0]!.weight_kg) * 10) / 10 : null },
  };
}
