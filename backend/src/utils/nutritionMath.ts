export interface Per100g { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number; sugar_g: number; sodium_mg: number }
export interface Nutrition { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number; sugar_g: number; sodium_mg: number }

const r1 = (n: number) => Math.round(n * 10) / 10;

/** nutrition = per100g * grams / 100 (e.g. 187 kcal/100g * 150g = 280.5 kcal). */
export function calculateServing(per100: Per100g, grams: number): Nutrition {
  const f = grams / 100;
  return {
    calories: r1(per100.calories * f), protein_g: r1(per100.protein_g * f), carbs_g: r1(per100.carbs_g * f),
    fat_g: r1(per100.fat_g * f), fiber_g: r1(per100.fiber_g * f), sugar_g: r1(per100.sugar_g * f), sodium_mg: Math.round(per100.sodium_mg * f),
  };
}
export const emptyNutrition = (): Nutrition => ({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0 });
export function sumNutrition(list: Nutrition[]): Nutrition {
  const t = list.reduce((a, n) => ({
    calories: a.calories + n.calories, protein_g: a.protein_g + n.protein_g, carbs_g: a.carbs_g + n.carbs_g, fat_g: a.fat_g + n.fat_g,
    fiber_g: a.fiber_g + n.fiber_g, sugar_g: a.sugar_g + n.sugar_g, sodium_mg: a.sodium_mg + n.sodium_mg,
  }), emptyNutrition());
  return { calories: r1(t.calories), protein_g: r1(t.protein_g), carbs_g: r1(t.carbs_g), fat_g: r1(t.fat_g), fiber_g: r1(t.fiber_g), sugar_g: r1(t.sugar_g), sodium_mg: Math.round(t.sodium_mg) };
}
