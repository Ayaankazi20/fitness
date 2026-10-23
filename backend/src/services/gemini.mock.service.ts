import { createHash } from 'node:crypto';
import type { CoachModel, ImageInput, VisionResult, VisionService } from '../ai/foodSchema.js';

const MEALS: VisionResult[] = [
  { foods: [{ name: 'Chicken Curry', estimated_weight_g: 150, confidence: 0.91 }, { name: 'Cooked Rice', estimated_weight_g: 200, confidence: 0.95 }, { name: 'Salad', estimated_weight_g: 100, confidence: 0.8 }], overall_confidence: 0.89 },
  { foods: [{ name: 'Chapati', estimated_weight_g: 80, confidence: 0.93 }, { name: 'Dal', estimated_weight_g: 180, confidence: 0.9 }, { name: 'Paneer Curry', estimated_weight_g: 120, confidence: 0.82 }], overall_confidence: 0.87 },
  { foods: [{ name: 'Poha', estimated_weight_g: 200, confidence: 0.92 }], overall_confidence: 0.92 },
  { foods: [{ name: 'Idli', estimated_weight_g: 120, confidence: 0.94 }, { name: 'Sambar', estimated_weight_g: 150, confidence: 0.85 }], overall_confidence: 0.9 },
  { foods: [{ name: 'Vada Pav', estimated_weight_g: 130, confidence: 0.9 }], overall_confidence: 0.9 },
];

/** DEVELOPMENT ONLY (AI_MODE=mock): deterministic fake "vision" keyed on image bytes. Never used in production. */
export class MockGeminiService implements VisionService, CoachModel {
  async identifyFood(image: ImageInput): Promise<VisionResult> {
    const h = createHash('sha256').update(image.buffer).digest()[0]!;
    const m = MEALS[h % MEALS.length]!;
    return { ...m, notes: 'Development mock: not a real image analysis. Portion sizes are visual estimates.' };
  }
  async reply({ context, message }: Parameters<CoachModel['reply']>[0]): Promise<string> {
    const rem = (context as any).remaining ?? {};
    const kcal = Math.round(rem.calories ?? 0), protein = Math.round(rem.protein_g ?? 0);
    return `(dev mock coach) You have about ${kcal} kcal and ${protein} g protein left today (estimates). Try 2 chapatis with dal and a bowl of curd, or paneer bhurji with a salad. You asked: "${message.slice(0, 80)}". I'm not a medical professional; for health conditions please consult a qualified healthcare professional.`;
  }
}
