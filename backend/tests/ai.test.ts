import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { parseVisionResponse } from '../src/ai/foodSchema.js';
import { sanitizeDetected } from '../src/services/food.service.js';
import { FakeVision, curryMeal, makeApp, makePng, onboardedUser } from './helpers.js';
import { AppError } from '../src/utils/errors.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/db.js';
import { isUnsafe } from '../src/services/coach.service.js';

describe('Gemini response validation', () => {
  it('accepts a valid response (and strips code fences)', () => {
    const json = JSON.stringify(curryMeal);
    expect(parseVisionResponse(json).foods).toHaveLength(3);
    expect(parseVisionResponse('```json\n' + json + '\n```').overall_confidence).toBe(0.89);
  });
  it('rejects invalid JSON, wrong shapes and out-of-range values', () => {
    const code = (fn: () => unknown) => { try { fn(); } catch (e) { return (e as AppError).code; } };
    expect(code(() => parseVisionResponse('not json'))).toBe('AI_INVALID_RESPONSE');
    expect(code(() => parseVisionResponse(''))).toBe('AI_INVALID_RESPONSE');
    expect(code(() => parseVisionResponse('{"foods":"rice"}'))).toBe('AI_INVALID_RESPONSE');
    expect(code(() => parseVisionResponse(JSON.stringify({ foods: [{ name: 'x', estimated_weight_g: 100, confidence: 1.7 }], overall_confidence: 0.5 })))).toBe('AI_INVALID_RESPONSE');
    expect(code(() => parseVisionResponse(JSON.stringify({ foods: [{ name: 'x', estimated_weight_g: -5, confidence: 0.5 }], overall_confidence: 0.5 })))).toBe('AI_INVALID_RESPONSE');
  });
  it('sanitizes: dedupes and clamps portion estimates', () => {
    const out = sanitizeDetected([{ name: 'Rice', estimated_weight_g: 2.4, confidence: 0.9 }, { name: 'rice ', estimated_weight_g: 100, confidence: 0.9 }, { name: 'Dal', estimated_weight_g: 4000, confidence: 0.9 }]);
    expect(out.map((f) => [f.name, f.estimated_weight_g])).toEqual([['Rice', 5], ['Dal', 2000]]);
  });
});

describe('POST /api/food/analyze', () => {
  const analyze = (app: any, u: any, buf: Buffer | null, name = 'meal.png', type = 'image/png') => {
    const r = request(app).post('/api/food/analyze').set(u.auth);
    return buf ? r.attach('image', buf, { filename: name, contentType: type }) : r;
  };

  it('identifies foods, looks up nutrition per 100g and calculates the serving', async () => {
    const vision = new FakeVision(curryMeal); const app = makeApp({ vision });
    const u = await onboardedUser(app);
    const res = await analyze(app, u, makePng());
    expect(res.status).toBe(200);
    expect(res.body.is_estimate).toBe(true);
    const curry = res.body.foods.find((f: any) => f.name === 'Chicken Curry');
    expect(curry).toMatchObject({ matched: true, match_source: 'INDIAN_LOCAL', weight_g: 150 });
    // 160 kcal/100g x 150 g from the nutrition DB (NOT from the AI)
    expect(curry.per_100g.calories).toBe(160); expect(curry.nutrition.calories).toBe(240);
    const rice = res.body.foods.find((f: any) => f.name === 'Cooked Rice');
    expect(rice.nutrition.calories).toBe(260);
    const sum = res.body.foods.reduce((a: number, f: any) => a + f.nutrition.calories, 0);
    expect(res.body.totals.calories).toBeCloseTo(sum, 1);
    expect(vision.calls).toBe(1);
    const scan = await prisma.foodScan.findUnique({ where: { id: res.body.scan_id } });
    expect(scan?.status).toBe('COMPLETED'); expect(scan?.overallConfidence).toBe(0.89);
  });
  it('returns NO_FOOD_DETECTED with recovery actions', async () => {
    const app = makeApp({ vision: new FakeVision({ foods: [], overall_confidence: 0.2, image_issues: ['not_food'] }) });
    const u = await onboardedUser(app);
    const res = await analyze(app, u, makePng());
    expect(res.status).toBe(422); expect(res.body.error.code).toBe('NO_FOOD_DETECTED');
    expect(res.body.error.details.actions).toEqual(['try_again', 'enter_manually']);
    expect((await prisma.foodScan.findFirst())?.status).toBe('NO_FOOD');
    // failed analyses do not consume quota
    expect(await prisma.usageCounter.count()).toBe(0);
  });
  it('flags low confidence, blur and unknown foods but still returns results', async () => {
    const app = makeApp({ vision: new FakeVision({ foods: [{ name: 'Mystery Dish', estimated_weight_g: 120, confidence: 0.3 }, { name: 'Dal', estimated_weight_g: 150, confidence: 0.4 }], overall_confidence: 0.35, image_issues: ['blurry', 'poor_lighting'] }) });
    const u = await onboardedUser(app);
    const res = await analyze(app, u, makePng());
    expect(res.status).toBe(200); expect(res.body.low_confidence).toBe(true);
    const codes = res.body.warnings.map((w: any) => w.code);
    expect(codes).toEqual(expect.arrayContaining(['LOW_CONFIDENCE', 'BLURRY_IMAGE', 'POOR_LIGHTING', 'UNKNOWN_FOOD']));
    expect(res.body.suggested_actions).toEqual(['try_again', 'enter_manually']);
    const mystery = res.body.foods.find((f: any) => f.name === 'Mystery Dish');
    expect(mystery).toMatchObject({ matched: false, needs_review: true, nutrition: null });
  });
  it('surfaces invalid AI output (502), timeouts (504) and outages without crashing', async () => {
    const u0 = makeApp(); const u = await onboardedUser(u0);
    for (const [err, status, code] of [[new AppError(502, 'AI_INVALID_RESPONSE', 'bad'), 502, 'AI_INVALID_RESPONSE'], [new AppError(504, 'AI_TIMEOUT', 'slow'), 504, 'AI_TIMEOUT'], [new AppError(502, 'AI_FAILURE', 'down'), 502, 'AI_FAILURE']] as const) {
      const app = makeApp({ vision: new FakeVision(async () => { throw err; }) });
      const res = await analyze(app, u, makePng());
      expect([res.status, res.body.error.code]).toEqual([status, code]);
    }
    expect(await prisma.foodScan.count({ where: { status: 'FAILED' } })).toBe(3);
  });
  it('validates the upload: missing, wrong type, tiny and oversized images', async () => {
    const app = makeApp(); const u = await onboardedUser(app);
    expect((await analyze(app, u, null)).body.error.code).toBe('NO_IMAGE');
    expect((await analyze(app, u, Buffer.from('%PDF-1.4 hello world this is not an image'), 'x.pdf', 'application/pdf')).status).toBe(415);
    expect((await analyze(app, u, makePng(40, 40))).body.error.code).toBe('IMAGE_TOO_SMALL');
    const big = await analyze(app, u, Buffer.alloc((env.MAX_IMAGE_MB + 1) * 1024 * 1024, 1));
    expect([big.status, big.body.error.code]).toEqual([413, 'IMAGE_TOO_LARGE']);
    expect((await analyze(app, { auth: {} }, makePng())).status).toBe(401);
  });
  it('enforces the monthly scan quota (plan limits are configuration)', async () => {
    const app = makeApp(); const u = await onboardedUser(app);
    const old = env.FREE_SCAN_LIMIT_PER_MONTH; env.FREE_SCAN_LIMIT_PER_MONTH = 2;
    try {
      expect((await analyze(app, u, makePng())).status).toBe(200); expect((await analyze(app, u, makePng())).status).toBe(200);
      const third = await analyze(app, u, makePng());
      expect([third.status, third.body.error.code]).toEqual([429, 'QUOTA_EXCEEDED']);
      expect((await request(app).get('/api/scan/usage').set(u.auth)).body).toMatchObject({ used: 2, limit: 2, plan: 'free' });
    } finally { env.FREE_SCAN_LIMIT_PER_MONTH = old; }
  });
  it('applies a per-user rate limit', async () => {
    const app = makeApp(); const u = await onboardedUser(app);
    const old = env.ANALYZE_RATE_LIMIT_PER_MIN; env.ANALYZE_RATE_LIMIT_PER_MIN = 1;
    try { await analyze(app, u, makePng()); expect((await analyze(app, u, makePng())).status).toBe(429); } finally { env.ANALYZE_RATE_LIMIT_PER_MIN = old; }
  });
});

describe('AI coach', () => {
  it('passes the user context to the model and stores the conversation', async () => {
    let seen: any;
    const app = makeApp({ coachModel: { async reply(a) { seen = a; return 'Try dal and roti.'; } } });
    const u = await onboardedUser(app);
    await request(app).post('/api/meals').set(u.auth).send({ meal_type: 'LUNCH', items: [{ name: 'Cooked Rice', weight_g: 200 }] });
    const res = await request(app).post('/api/ai/chat').set(u.auth).send({ message: 'I have 600 calories remaining. What should I eat?' });
    expect(res.status).toBe(200); expect(res.body.reply).toBe('Try dal and roti.'); expect(res.body.disclaimer).toMatch(/not medical advice/i);
    expect(seen.context).toMatchObject({ goal: 'LOSE_WEIGHT', current_weight_kg: 80, allergies: ['peanuts'], dietary_preference: 'vegetarian' });
    expect(seen.context.remaining.calories).toBe(2298 - 260);
    expect(seen.system).toMatch(/healthcare professional/);
    const hist = await request(app).get('/api/ai/conversations/latest').set(u.auth);
    expect(hist.body.messages.map((m: any) => m.role)).toEqual(['USER', 'ASSISTANT']);
  });
  it('blocks unsafe requests without calling the model', async () => {
    let called = false;
    const app = makeApp({ coachModel: { async reply() { called = true; return 'x'; } } });
    const u = await onboardedUser(app);
    for (const m of ['How can I starve myself to lose weight fast', 'I want to eat only 500 calories a day']) {
      expect(isUnsafe(m)).toBe(true);
      const res = await request(app).post('/api/ai/chat').set(u.auth).send({ message: m });
      expect(res.body.safety_triggered).toBe(true); expect(res.body.reply).toMatch(/healthcare professional/i);
    }
    expect(called).toBe(false);
    expect(isUnsafe('What should I eat for dinner?')).toBe(false);
  });
});
