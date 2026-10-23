import { describe, expect, it } from 'vitest';
import { GeminiService } from '../src/services/gemini.service.js';
import { curryMeal, makePng } from './helpers.js';
import { AppError } from '../src/utils/errors.js';

/** Exercises the REAL GeminiService with a stubbed SDK client (no network / key needed). */
function svc(responses: Array<string | Error>) {
  const s = new GeminiService('test-key', 'gemini-test', 5000);
  const calls: any[] = [];
  (s as any).ai = { models: { generateContent: async (req: any) => { calls.push(req); const r = responses.shift()!; if (r instanceof Error) throw r; return { text: r }; } } };
  return { s, calls };
}
const img = { buffer: makePng(), mimeType: 'image/png' };

describe('GeminiService (real code path, stubbed SDK)', () => {
  it('sends the image + schema-constrained JSON request and parses the result', async () => {
    const { s, calls } = svc([JSON.stringify(curryMeal)]);
    const r = await s.identifyFood(img);
    expect(r.foods[0]!.name).toBe('Chicken Curry');
    const req = calls[0];
    expect(req.model).toBe('gemini-test');
    expect(req.config.responseMimeType).toBe('application/json');
    expect(req.config.responseJsonSchema.required).toContain('foods');
    expect(req.contents[0].parts[0].inlineData.mimeType).toBe('image/png');
    expect(req.contents[0].parts[1].text).toMatch(/Do NOT output calories/);
  });
  it('repairs invalid JSON with one retry', async () => {
    const { s, calls } = svc(['sorry, here are the foods: rice', JSON.stringify(curryMeal)]);
    expect((await s.identifyFood(img)).overall_confidence).toBe(0.89);
    expect(calls).toHaveLength(2);
  });
  it('fails with AI_INVALID_RESPONSE if the repair is also invalid', async () => {
    const { s, calls } = svc(['nope', '{"foods": 5}']);
    await expect(s.identifyFood(img)).rejects.toMatchObject({ code: 'AI_INVALID_RESPONSE' });
    expect(calls).toHaveLength(2);
  });
  it('maps timeouts, rate limits and outages to typed errors', async () => {
    const t = Object.assign(new Error('t'), { name: 'TimeoutError' });
    await expect(svc([t]).s.identifyFood(img)).rejects.toMatchObject({ status: 504, code: 'AI_TIMEOUT' });
    await expect(svc([Object.assign(new Error('x'), { status: 429 })]).s.identifyFood(img)).rejects.toMatchObject({ code: 'AI_BUSY' });
    await expect(svc([new Error('boom')]).s.identifyFood(img)).rejects.toBeInstanceOf(AppError);
  });
  it('coach reply passes system prompt and context, rejects empty answers', async () => {
    const { s, calls } = svc(['Have dal and roti.', '  ']);
    expect(await s.reply({ system: 'SYS', history: [{ role: 'USER', content: 'hi' }], message: 'what now', context: { remaining: { calories: 600 } } })).toBe('Have dal and roti.');
    expect(calls[0].config.systemInstruction).toBe('SYS');
    expect(calls[0].contents.at(-1).parts[0].text).toContain('"calories":600');
    await expect(s.reply({ system: 'S', history: [], message: 'm', context: {} })).rejects.toMatchObject({ code: 'AI_INVALID_RESPONSE' });
  });
  it('refuses to start without an API key', () => {
    expect(() => new GeminiService('' as any)).toThrow(/GEMINI_API_KEY/);
  });
});
