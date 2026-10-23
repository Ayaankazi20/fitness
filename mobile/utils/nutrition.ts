import type { DraftFood, Nutrition, Per100g } from '../types/api';

const r1 = (n: number) => Math.round(n * 10) / 10;
export const zero = (): Nutrition => ({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0 });

/** Same formula as the backend (per100g * grams / 100) so edits recalculate instantly offline; the server re-validates on save. */
export function serving(per: Per100g, grams: number): Nutrition {
  const f = grams / 100;
  return { calories: r1(per.calories * f), protein_g: r1(per.protein_g * f), carbs_g: r1(per.carbs_g * f), fat_g: r1(per.fat_g * f), fiber_g: r1(per.fiber_g * f), sugar_g: r1(per.sugar_g * f), sodium_mg: Math.round(per.sodium_mg * f) };
}
export function totalOf(foods: DraftFood[]): Nutrition {
  const t = zero();
  for (const f of foods) { if (!f.per_100g) continue; const n = serving(f.per_100g, f.weight_g); (Object.keys(t) as (keyof Nutrition)[]).forEach((k) => { t[k] += n[k]; }); }
  return { calories: r1(t.calories), protein_g: r1(t.protein_g), carbs_g: r1(t.carbs_g), fat_g: r1(t.fat_g), fiber_g: r1(t.fiber_g), sugar_g: r1(t.sugar_g), sodium_mg: Math.round(t.sodium_mg) };
}
export const round = (n: number) => Math.round(n).toLocaleString('en-US');
export const mealLabel = (t: string) => t.charAt(0) + t.slice(1).toLowerCase();
export function greeting(d = new Date()) { const h = d.getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
export const tzOffset = () => new Date().getTimezoneOffset();
export function defaultMealType(d = new Date()): 'BREAKFAST' | 'LUNCH' | 'SNACK' | 'DINNER' {
  const h = d.getHours(); return h < 11 ? 'BREAKFAST' : h < 15 ? 'LUNCH' : h < 18 ? 'SNACK' : 'DINNER';
}
export const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
