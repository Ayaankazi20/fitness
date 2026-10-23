import { z } from 'zod';
import { AppError } from '../utils/errors.js';

export const detectedFoodSchema = z.object({
  name: z.string().trim().min(1).max(80),
  estimated_weight_g: z.number().positive().max(5000),
  confidence: z.number().min(0).max(1),
  portion_description: z.string().max(120).optional(),
  uncertainty: z.string().max(200).optional(),
});
export const visionResultSchema = z.object({
  foods: z.array(detectedFoodSchema).max(15),
  overall_confidence: z.number().min(0).max(1),
  notes: z.string().max(500).optional(),
  image_issues: z.array(z.enum(['blurry', 'poor_lighting', 'not_food', 'multiple_dishes'])).optional(),
});
export type DetectedFood = z.infer<typeof detectedFoodSchema>;
export type VisionResult = z.infer<typeof visionResultSchema>;

/** JSON Schema handed to Gemini for structured output (validated again with zod on our side). */
export const GEMINI_FOOD_JSON_SCHEMA = {
  type: 'object',
  properties: {
    foods: { type: 'array', items: { type: 'object', properties: {
      name: { type: 'string' }, estimated_weight_g: { type: 'number' }, confidence: { type: 'number' },
      portion_description: { type: 'string' }, uncertainty: { type: 'string' },
    }, required: ['name', 'estimated_weight_g', 'confidence'] } },
    overall_confidence: { type: 'number' }, notes: { type: 'string' },
    image_issues: { type: 'array', items: { type: 'string', enum: ['blurry', 'poor_lighting', 'not_food', 'multiple_dishes'] } },
  },
  required: ['foods', 'overall_confidence'],
};

/** Never trust model output: strip fences, parse, validate. Throws AI_INVALID_RESPONSE. */
export function parseVisionResponse(text: string | undefined | null): VisionResult {
  const raw = (text ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let json: unknown;
  try { json = JSON.parse(raw); } catch { throw new AppError(502, 'AI_INVALID_RESPONSE', 'The AI returned an unreadable response.'); }
  const parsed = visionResultSchema.safeParse(json);
  if (!parsed.success) throw new AppError(502, 'AI_INVALID_RESPONSE', 'The AI returned an unexpected response.', parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`));
  return parsed.data;
}

export interface ImageInput { buffer: Buffer; mimeType: string }
export interface VisionService { identifyFood(image: ImageInput): Promise<VisionResult> }
export interface CoachContext { text: string }
export interface CoachModel { reply(args: { system: string; history: Array<{ role: 'USER' | 'ASSISTANT'; content: string }>; message: string; context: Record<string, unknown> }): Promise<string> }
