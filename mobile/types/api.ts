export type MealType = 'BREAKFAST' | 'LUNCH' | 'SNACK' | 'DINNER';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type ActivityLevel = 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'VERY_ACTIVE' | 'EXTREME';
export type GoalType = 'LOSE_WEIGHT' | 'MAINTAIN' | 'GAIN_MUSCLE' | 'GAIN_WEIGHT';

export interface Nutrition { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number; sugar_g: number; sodium_mg: number }
export interface Per100g extends Nutrition {}
export interface Tokens { access_token: string; refresh_token: string }
export interface Me { id: string; email: string; name: string | null; onboarded: boolean }
export interface Targets { calories: number; protein_g: number; carbs_g: number; fat_g: number; is_manual: boolean; is_estimate: boolean; disclaimer: string }
export interface ProfileResponse {
  profile: { name: string; age: number; gender: Gender; height_cm: number; weight_kg: number; activity_level: ActivityLevel; dietary_preference: string | null; allergies: string[]; food_preferences: string[] };
  goal: { goal_type: GoalType; target_weight_kg: number | null } | null; targets: Targets | null;
}

/** Editable food row used by the scan result + manual entry screens. Nutrition is recomputed locally from per_100g. */
export interface DraftFood {
  key: string; name: string; weight_g: number; food_item_id: string | null; per_100g: Per100g | null;
  confidence: number | null; ai_detected: boolean; needs_review: boolean; uncertainty?: string; matched: boolean;
}
export interface AnalyzeFood { key: string; name: string; matched_name: string | null; food_item_id: string | null; weight_g: number; confidence: number; matched: boolean; needs_review: boolean; uncertainty?: string; per_100g: Per100g | null; nutrition: Nutrition | null }
export interface AnalyzeResponse { scan_id: string; foods: AnalyzeFood[]; totals: Nutrition; overall_confidence: number; low_confidence: boolean; warnings: { code: string; message: string }[]; suggested_actions: string[]; notes: string | null }
export interface FoodSearchResult { food_item_id: string; name: string; source: string; per_100g: Per100g }

export interface MealItem extends Nutrition { id: string; name: string; weight_g: number; food_item_id: string | null; ai_detected: boolean; confidence: number | null }
export interface Meal { id: string; meal_type: MealType; eaten_at: string; items: MealItem[]; totals: Nutrition }
export interface Dashboard {
  date: string; name: string; targets: Targets; consumed: Nutrition; meal_count: number;
  remaining: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  meals_by_type: { meal_type: MealType; meals: Meal[]; totals: Nutrition }[];
  weight: { current_kg: number; start_kg: number | null; change_kg: number | null; target_kg: number | null };
  weekly: { days_logged: number; days_in_range: number; days_target_achieved: number; avg_calories: number; avg_protein_g: number; days: { date: string; calories: number; achieved: boolean }[] };
}
export interface Progress {
  range: 'week' | 'month'; targets: { calories: number; protein_g: number };
  series: { date: string; calories: number; protein_g: number; achieved: boolean; meal_count: number }[];
  summary: { days_logged: number; days_in_range: number; days_target_achieved: number; avg_calories: number; avg_protein_g: number };
  weight: { series: { date: string; weight_kg: number }[]; change_kg: number | null };
}
export interface WeightResponse { logs: { id: string; weight_kg: number; date: string }[]; summary: { start_kg: number | null; current_kg: number | null; change_kg: number | null } }
export interface ChatMessage { id?: string; role: 'USER' | 'ASSISTANT'; content: string }
