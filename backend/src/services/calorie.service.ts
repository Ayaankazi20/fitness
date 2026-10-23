import { nutritionConfig as cfg } from '../config/nutritionConfig.js';
import type { ActivityLevel, Gender, GoalType } from '../generated/prisma/enums.js';

export interface BodyInfo { age: number; gender: Gender; heightCm: number; weightKg: number; activityLevel: ActivityLevel }
export interface Targets { calories: number; protein_g: number; carbs_g: number; fat_g: number; bmr: number; tdee: number }

/** Mifflin-St Jeor. "OTHER" uses the midpoint of the male/female constants. */
export function calculateBmr(b: Pick<BodyInfo, 'age' | 'gender' | 'heightCm' | 'weightKg'>): number {
  const base = 10 * b.weightKg + 6.25 * b.heightCm - 5 * b.age;
  const c = b.gender === 'MALE' ? 5 : b.gender === 'FEMALE' ? -161 : -78;
  return Math.round(base + c);
}
export const calculateTdee = (bmr: number, a: ActivityLevel) => Math.round(bmr * cfg.activityMultiplier[a]);

export function calculateTargets(b: BodyInfo, goal: GoalType): Targets {
  const bmr = calculateBmr(b), tdee = calculateTdee(bmr, b.activityLevel);
  let calories = tdee + cfg.goalCalorieAdjustment[goal];
  if (cfg.goalCalorieAdjustment[goal] < 0) calories = Math.max(calories, Math.round(tdee * (1 - cfg.maxDeficitFraction)));
  calories = Math.max(calories, cfg.calorieFloor[b.gender]);
  const protein = Math.round(b.weightKg * cfg.proteinPerKg[goal]);
  const fat = Math.round((calories * cfg.fatCalorieFraction) / 9);
  let carbs = Math.round((calories - protein * 4 - fat * 9) / 4);
  carbs = Math.max(carbs, cfg.minCarbsG);
  return { calories: Math.round(calories), protein_g: protein, carbs_g: carbs, fat_g: fat, bmr, tdee };
}
