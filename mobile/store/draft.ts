import { create } from 'zustand';
import type { AnalyzeResponse, DraftFood, FoodSearchResult, MealType } from '../types/api';
import { defaultMealType } from '../utils/nutrition';

interface DraftState {
  scanId: string | null; foods: DraftFood[]; mealType: MealType; warnings: { code: string; message: string }[]; overall: number | null; editingMealId: string | null;
  loadScan: (r: AnalyzeResponse) => void; startManual: () => void; startEdit: (mealId: string, mealType: MealType, foods: DraftFood[]) => void;
  setWeight: (key: string, g: number) => void; remove: (key: string) => void; add: (f: FoodSearchResult) => void; replace: (key: string, f: FoodSearchResult) => void;
  setMealType: (t: MealType) => void; clear: () => void;
}
const fresh = () => ({ scanId: null as string | null, foods: [] as DraftFood[], mealType: defaultMealType() as MealType, warnings: [] as { code: string; message: string }[], overall: null as number | null, editingMealId: null as string | null });
let seq = 0;
const fromResult = (f: FoodSearchResult, grams = 100): DraftFood => ({ key: `m${++seq}`, name: f.name, weight_g: grams, food_item_id: f.food_item_id, per_100g: f.per_100g, confidence: null, ai_detected: false, needs_review: false, matched: true });

export const useDraft = create<DraftState>((set) => ({
  ...fresh(),
  loadScan: (r) => set({ ...fresh(), scanId: r.scan_id, overall: r.overall_confidence, warnings: r.warnings,
    foods: r.foods.map((f) => ({ key: f.key, name: f.matched_name ?? f.name, weight_g: f.weight_g, food_item_id: f.food_item_id, per_100g: f.per_100g, confidence: f.confidence, ai_detected: true, needs_review: f.needs_review, uncertainty: f.uncertainty, matched: f.matched })) }),
  startManual: () => set(fresh()),
  startEdit: (editingMealId, mealType, foods) => set({ ...fresh(), foods, mealType, editingMealId }),
  setWeight: (key, g) => set((s) => ({ foods: s.foods.map((f) => (f.key === key ? { ...f, weight_g: Math.max(1, Math.min(5000, Math.round(g))) } : f)) })),
  remove: (key) => set((s) => ({ foods: s.foods.filter((f) => f.key !== key) })),
  add: (f) => set((s) => ({ foods: [...s.foods, fromResult(f)] })),
  replace: (key, f) => set((s) => ({ foods: s.foods.map((x) => (x.key === key ? { ...fromResult(f, x.weight_g), key, ai_detected: x.ai_detected, confidence: x.confidence } : x)) })),
  setMealType: (mealType) => set({ mealType }),
  clear: () => set(fresh()),
}));
