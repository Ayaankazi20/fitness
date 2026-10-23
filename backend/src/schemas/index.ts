import { z } from 'zod';

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
const password = z.string().min(8, 'Password must be at least 8 characters').max(128);
export const registerSchema = z.object({ email, password });
export const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
export const forgotSchema = z.object({ email });
export const resetSchema = z.object({ email, code: z.string().trim().min(8).max(8), password });
export const changePasswordSchema = z.object({ current_password: z.string().min(1).max(128), new_password: password });
export const refreshSchema = z.object({ refresh_token: z.string().min(20).max(256) });

export const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;
export const ACTIVITY = ['SEDENTARY', 'LIGHT', 'MODERATE', 'VERY_ACTIVE', 'EXTREME'] as const;
export const GOALS = ['LOSE_WEIGHT', 'MAINTAIN', 'GAIN_MUSCLE', 'GAIN_WEIGHT'] as const;
export const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER'] as const;

const list = z.array(z.string().trim().min(1).max(40)).max(20);
export const profileSchema = z.object({
  name: z.string().trim().min(1).max(60),
  age: z.number().int().min(13).max(100),
  gender: z.enum(GENDERS),
  height_cm: z.number().min(100).max(250),
  weight_kg: z.number().min(25).max(350),
  activity_level: z.enum(ACTIVITY),
  dietary_preference: z.string().trim().max(40).optional(),
  allergies: list.optional(),
  food_preferences: list.optional(),
});
export const goalSchema = z.object({ goal_type: z.enum(GOALS), target_weight_kg: z.number().min(25).max(350).optional() });
export const onboardingSchema = z.object({ profile: profileSchema, goal: goalSchema });
export const profileUpdateSchema = profileSchema.partial();
export const targetsSchema = z.object({
  calories: z.number().int().min(800).max(6000), protein_g: z.number().int().min(0).max(500),
  carbs_g: z.number().int().min(0).max(900), fat_g: z.number().int().min(0).max(300),
});

const nutrient = z.number().min(0).max(100000);
export const customPer100Schema = z.object({ calories: nutrient, protein_g: nutrient, carbs_g: nutrient, fat_g: nutrient, fiber_g: nutrient.default(0), sugar_g: nutrient.default(0), sodium_mg: nutrient.default(0) });
export const mealItemInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  weight_g: z.number().min(1).max(5000),
  food_item_id: z.uuid().optional(),
  custom_per_100g: customPer100Schema.optional(),
  ai_detected: z.boolean().optional(),
  confidence: z.number().min(0).max(1).optional(),
});
export const mealCreateSchema = z.object({
  meal_type: z.enum(MEAL_TYPES), eaten_at: z.iso.datetime({ offset: true }).optional(),
  items: z.array(mealItemInputSchema).min(1).max(30), scan_id: z.uuid().optional(),
});
export const mealUpdateSchema = z.object({
  meal_type: z.enum(MEAL_TYPES).optional(), eaten_at: z.iso.datetime({ offset: true }).optional(),
  items: z.array(mealItemInputSchema).min(1).max(30).optional(),
});
export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const tzSchema = z.coerce.number().int().min(-840).max(840).default(0);
export const mealQuerySchema = z.object({ date: dateStr.optional(), from: dateStr.optional(), to: dateStr.optional(), tz: tzSchema, limit: z.coerce.number().int().min(1).max(200).default(100) });
export const weightSchema = z.object({ weight_kg: z.number().min(25).max(350), date: dateStr.optional() });
export const progressQuerySchema = z.object({ range: z.enum(['week', 'month']).default('week'), tz: tzSchema });
export const dashboardQuerySchema = z.object({ date: dateStr.optional(), tz: tzSchema });
export const chatSchema = z.object({ message: z.string().trim().min(1).max(1000), conversation_id: z.uuid().optional(), tz: tzSchema.optional() });
export const foodSearchSchema = z.object({ q: z.string().trim().min(2).max(80) });
export const idParam = z.object({ id: z.uuid() });
