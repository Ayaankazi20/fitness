import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { FakeVision, curryMeal, makeApp, makePng } from './helpers.js';
import { calculateServing } from '../src/utils/nutritionMath.js';
import { prisma } from '../src/config/db.js';

/** The MVP acceptance flow: register -> login -> onboarding -> dashboard -> scan -> edit portion -> save -> dashboard/history/daily totals. */
describe('end-to-end: scan a meal and track it', () => {
  it('works from registration to updated daily totals', async () => {
    const app = makeApp({ vision: new FakeVision(curryMeal) });

    // Register + login
    const email = 'e2e@example.com';
    expect((await request(app).post('/api/auth/register').send({ email, password: 'password123' })).status).toBe(201);
    const login = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
    const auth = { Authorization: `Bearer ${login.body.tokens.access_token}` };
    expect((await request(app).get('/api/auth/me').set(auth)).body.onboarded).toBe(false);

    // Onboarding + goal -> estimated targets
    const ob = await request(app).post('/api/onboarding').set(auth).send({ profile: { name: 'Ayaan', age: 22, gender: 'MALE', height_cm: 175, weight_kg: 72, activity_level: 'LIGHT' }, goal: { goal_type: 'GAIN_MUSCLE' } });
    expect(ob.status).toBe(201);
    const target = ob.body.targets.calories as number;
    expect(ob.body.targets.is_estimate).toBe(true);

    // Dashboard starts empty
    let dash = (await request(app).get('/api/dashboard').set(auth)).body;
    expect(dash.consumed.calories).toBe(0); expect(dash.remaining.calories).toBe(target); expect(dash.meal_count).toBe(0);

    // Scan food: upload -> Gemini (fake) -> USDA/Indian DB lookup -> calculation
    const scan = await request(app).post('/api/food/analyze').set(auth).attach('image', makePng(640, 480), { filename: 'lunch.jpg.png', contentType: 'image/png' });
    expect(scan.status).toBe(200);
    expect(scan.body.foods.map((f: any) => f.name)).toEqual(['Chicken Curry', 'Cooked Rice', 'Salad']);
    expect(scan.body.foods.every((f: any) => f.matched && f.per_100g && f.nutrition)).toBe(true);

    // User edits a portion on-device (instant recalculation from per_100g), removes nothing, then saves
    const edited = scan.body.foods.map((f: any) => ({ ...f, weight_g: f.name === 'Chicken Curry' ? 250 : f.weight_g }));
    const curry = edited.find((f: any) => f.name === 'Chicken Curry');
    expect(calculateServing(curry.per_100g, 250).calories).toBe(400);
    const save = await request(app).post('/api/meals').set(auth).send({
      meal_type: 'LUNCH', scan_id: scan.body.scan_id,
      items: edited.map((f: any) => ({ name: f.name, weight_g: f.weight_g, food_item_id: f.food_item_id, ai_detected: true, confidence: f.confidence })),
    });
    expect(save.status).toBe(201);
    const expected = edited.reduce((s: number, f: any) => s + calculateServing(f.per_100g, f.weight_g).calories, 0);
    expect(save.body.totals.calories).toBeCloseTo(expected, 1);
    expect(save.body.items.find((i: any) => i.name === 'Chicken Curry').calories).toBe(400);

    // Dashboard, history and daily totals update
    dash = (await request(app).get('/api/dashboard').set(auth)).body;
    expect(dash.consumed.calories).toBeCloseTo(expected, 1);
    expect(dash.remaining.calories).toBeCloseTo(target - expected, 1);
    expect(dash.meal_count).toBe(1);
    expect(dash.meals_by_type.find((g: any) => g.meal_type === 'LUNCH').meals[0].id).toBe(save.body.id);
    const history = (await request(app).get('/api/meals').set(auth)).body;
    expect(history.meals).toHaveLength(1); expect(history.meals[0].items).toHaveLength(3);
    const prog = (await request(app).get('/api/progress').query({ range: 'week' }).set(auth)).body;
    expect(prog.series.at(-1).calories).toBeCloseTo(expected, 1);

    // The scan record links to the saved meal and keeps the user's final corrections
    const row = await prisma.foodScan.findUniqueOrThrow({ where: { id: scan.body.scan_id } });
    expect(row.mealId).toBe(save.body.id); expect(row.status).toBe('COMPLETED');
    expect((row.finalFoods as any[]).find((f) => f.name === 'Chicken Curry').weight_g).toBe(250);
    // images are never stored: the DB only has parsed results
    expect(JSON.stringify(row.detectedFoods)).not.toMatch(/base64|iVBOR/);
  });
});
