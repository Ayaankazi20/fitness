import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { FOOD_ANALYSIS_PROMPT } from '../ai/prompts.js';
import { GEMINI_FOOD_JSON_SCHEMA, parseVisionResponse, type CoachModel, type ImageInput, type VisionResult, type VisionService } from '../ai/foodSchema.js';

function mapSdkError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  const err = e as { name?: string; status?: number; message?: string };
  if (err?.name === 'AbortError' || err?.name === 'TimeoutError') return new AppError(504, 'AI_TIMEOUT', 'The AI took too long to respond. Please try again.');
  if (err?.status === 429) return new AppError(503, 'AI_BUSY', 'The AI service is busy. Please try again shortly.');
  return new AppError(502, 'AI_FAILURE', 'The AI service is unavailable right now.');
}

/** Real Gemini integration. The API key never leaves the backend. */
export class GeminiService implements VisionService, CoachModel {
  private ai: GoogleGenAI;
  constructor(apiKey = env.GEMINI_API_KEY, private model = env.GEMINI_MODEL, private timeoutMs = env.GEMINI_TIMEOUT_MS) {
    if (!apiKey) throw new Error('GEMINI_API_KEY is required for the real Gemini service');
    this.ai = new GoogleGenAI({ apiKey });
  }

  private async generate(contents: any, config: Record<string, unknown>): Promise<string> {
    try {
      const res = await this.ai.models.generateContent({ model: this.model, contents, config: { ...config, abortSignal: AbortSignal.timeout(this.timeoutMs) } as any });
      return res.text ?? '';
    } catch (e) { throw mapSdkError(e); }
  }

  async identifyFood(image: ImageInput): Promise<VisionResult> {
    const imagePart = { inlineData: { mimeType: image.mimeType, data: image.buffer.toString('base64') } };
    const config = { responseMimeType: 'application/json', responseJsonSchema: GEMINI_FOOD_JSON_SCHEMA, temperature: 0.2 };
    const first = await this.generate([{ role: 'user', parts: [imagePart, { text: FOOD_ANALYSIS_PROMPT }] }], config);
    try { return parseVisionResponse(first); }
    catch (err) {
      if (!(err instanceof AppError) || err.code !== 'AI_INVALID_RESPONSE') throw err;
      // One repair attempt: show the model its invalid output and ask for corrected JSON.
      const repaired = await this.generate([{ role: 'user', parts: [imagePart, { text: FOOD_ANALYSIS_PROMPT }] }, { role: 'model', parts: [{ text: first.slice(0, 4000) }] },
        { role: 'user', parts: [{ text: 'That response was not valid for the required schema. Return ONLY corrected JSON matching the schema.' }] }], config);
      return parseVisionResponse(repaired);
    }
  }

  async reply(args: Parameters<CoachModel['reply']>[0]): Promise<string> {
    const contents = [
      ...args.history.map((m) => ({ role: m.role === 'USER' ? 'user' : 'model', parts: [{ text: m.content }] })),
      { role: 'user', parts: [{ text: `User context (estimates): ${JSON.stringify(args.context)}\n\nUser message: ${args.message}` }] },
    ];
    const text = await this.generate(contents, { systemInstruction: args.system, temperature: 0.6, maxOutputTokens: 700 });
    if (!text.trim()) throw new AppError(502, 'AI_INVALID_RESPONSE', 'The AI returned an empty answer.');
    return text.trim();
  }
}
