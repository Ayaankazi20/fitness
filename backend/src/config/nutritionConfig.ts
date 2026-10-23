import type { ActivityLevel, GoalType } from '../generated/prisma/enums.js';

/** Tunable constants for the estimated target calculator. All outputs are estimates, not medical advice. */
export const nutritionConfig = {
  activityMultiplier: { SEDENTARY: 1.2, LIGHT: 1.375, MODERATE: 1.55, VERY_ACTIVE: 1.725, EXTREME: 1.9 } as Record<ActivityLevel, number>,
  goalCalorieAdjustment: { LOSE_WEIGHT: -500, MAINTAIN: 0, GAIN_MUSCLE: 300, GAIN_WEIGHT: 500 } as Record<GoalType, number>,
  maxDeficitFraction: 0.25,
  calorieFloor: { MALE: 1500, FEMALE: 1200, OTHER: 1350 },
  proteinPerKg: { LOSE_WEIGHT: 2.0, MAINTAIN: 1.6, GAIN_MUSCLE: 2.0, GAIN_WEIGHT: 1.6 } as Record<GoalType, number>,
  fatCalorieFraction: 0.25,
  minCarbsG: 50,
  /** A day counts as "target achieved" when calories land in this band around the target. */
  achievedBand: { min: 0.85, max: 1.1 },
};
