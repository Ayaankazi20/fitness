import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { makeApp, makePng, onboardedUser, registerUser } from './helpers.js';

const app = makeApp();
const today = () => new Date().toISOString().slice(0, 10);

describe('meals', () => {
  it('creates a meal; the server recalculates nutrition and ignores client-supplied numbers', async () => {
    const u = await onboardedUser(app);
    const res = await request(app).post('/api/meals').set(u.auth).send({ meal_type: 'LUNCH', items: [{ name: 'Cooked Rice', weight_g: 200, calories: 1 }, { name: 'Dal', weight_g: 150 }] });
    expect(res.status).toBe(201);
    expect(res.body.items.map((i: any) => i.calories)).toEqual([260, 157.5]);
    expect(res.body.totals.calories).toBe(417.5); expect(res.body.is_estimate).toBe(true);
    expect(res.body.meal_type).toBe('LUNCH');
  });
  it('rejects unknown foods with a helpful error, accepts custom per-100g values', async () => {
    const u = await onboardedUser(app);
    const bad = await request(app).post('/api/meals').set(u.auth).send({ meal_type: 'SNACK', items: [{ name: 'zzzxqv', weight_g: 50 }] });
    expect([bad.status, bad.body.error.code]).toEqual([422, 'FOOD_NOT_FOUND']);
    const ok = await request(app).post('/api/meals').set(u.auth).send({ meal_type: 'SNACK', items: [{ name: 'Homemade ladoo', weight_g: 50, custom_per_100g: { calories: 450, protein_g: 8, carbs_g: 60, fat_g: 20 } }] });
    expect(ok.status).toBe(201); expect(ok.body.items[0].calories).toBe(225);
  });
  it('validates input', async () => {
    const u = await onboardedUser(app);
    expect((await request(app).post('/api/meals').set(u.auth).send({ meal_type: 'BRUNCH', items: [{ name: 'x', weight_g: 1 }] })).status).toBe(400);
    expect((await request(app).post('/api/meals').set(u.auth).send({ meal_type: 'LUNCH', items: [] })).status).toBe(400);
    expect((await request(app).post('/api/meals').set(u.auth).send({ meal_type: 'LUNCH', items: [{ name: 'Dal', weight_g: -4 }] })).status).toBe(400);
  });
  it('gets, edits (portion + type), and deletes a meal; daily totals follow', async () => {
    const u = await onboardedUser(app);
    const created = await request(app).post('/api/meals').set(u.auth).send({ meal_type: 'DINNER', items: [{ name: 'Cooked Rice', weight_g: 100 }] });
    const id = created.body.id;
    expect((await request(app).get('/api/dashboard').set(u.auth)).body.consumed.calories).toBe(130);
    const upd = await request(app).put(`/api/meals/${id}`).set(u.auth).send({ meal_type: 'LUNCH', items: [{ name: 'Cooked Rice', weight_g: 300 }, { name: 'Paneer', weight_g: 50 }] });
    expect(upd.status).toBe(200); expect(upd.body.meal_type).toBe('LUNCH'); expect(upd.body.totals.calories).toBe(390 + 148);
    expect((await request(app).get(`/api/meals/${id}`).set(u.auth)).body.items).toHaveLength(2);
    expect((await request(app).get('/api/dashboard').set(u.auth)).body.consumed.calories).toBe(538);
    expect((await request(app).delete(`/api/meals/${id}`).set(u.auth)).status).toBe(204);
    expect((await request(app).get(`/api/meals/${id}`).set(u.auth)).status).toBe(404);
    expect((await request(app).get('/api/dashboard').set(u.auth)).body.consumed.calories).toBe(0);
  });
  it("isolates users: nobody can read, edit or delete another user's meal", async () => {
    const a = await onboardedUser(app), b = await registerUser(app);
    const m = await request(app).post('/api/meals').set(a.auth).send({ meal_type: 'LUNCH', items: [{ name: 'Dal', weight_g: 100 }] });
    expect((await request(app).get(`/api/meals/${m.body.id}`).set(b.auth)).status).toBe(404);
    expect((await request(app).put(`/api/meals/${m.body.id}`).set(b.auth).send({ meal_type: 'DINNER' })).status).toBe(404);
    expect((await request(app).delete(`/api/meals/${m.body.id}`).set(b.auth)).status).toBe(404);
    expect((await request(app).get('/api/meals').set(b.auth)).body.meals).toHaveLength(0);
  });
  it('lists meals by date with totals, and honors timezones', async () => {
    const u = await onboardedUser(app);
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    await request(app).post('/api/meals').set(u.auth).send({ meal_type: 'BREAKFAST', items: [{ name: 'Poha', weight_g: 200 }] });
    await request(app).post('/api/meals').set(u.auth).send({ meal_type: 'DINNER', eaten_at: yesterday, items: [{ name: 'Idli', weight_g: 100 }] });
    const t = await request(app).get('/api/meals').query({ date: today() }).set(u.auth);
    expect(t.body.meals).toHaveLength(1); expect(t.body.totals.calories).toBe(260);
    const all = await request(app).get('/api/meals').set(u.auth);
    expect(all.body.meals).toHaveLength(2);
    // 23:30 UTC is already "tomorrow" in IST (tz=-330)
    const lateUtc = `${today()}T23:30:00.000Z`;
    await request(app).post('/api/meals').set(u.auth).send({ meal_type: 'SNACK', eaten_at: lateUtc, items: [{ name: 'Samosa', weight_g: 50 }] });
    const ist = await request(app).get('/api/meals').query({ date: today(), tz: -330 }).set(u.auth);
    expect(ist.body.meals.some((m: any) => m.meal_type === 'SNACK')).toBe(false);
  });
});

describe('dashboard & progress', () => {
  it('reports consumed/remaining, meals grouped by type, weight and weekly summary', async () => {
    const u = await onboardedUser(app);
    await request(app).post('/api/meals').set(u.auth).send({ meal_type: 'BREAKFAST', items: [{ name: 'Poha', weight_g: 200 }] });
    await request(app).post('/api/meals').set(u.auth).send({ meal_type: 'LUNCH', items: [{ name: 'Roti', weight_g: 100 }, { name: 'Dal', weight_g: 200 }] });
    const d = (await request(app).get('/api/dashboard').set(u.auth)).body;
    expect(d.name).toBe('Ayaan'); expect(d.meal_count).toBe(2);
    expect(d.consumed.calories).toBe(260 + 297 + 210);
    expect(d.remaining.calories).toBe(2298 - 767);
    expect(d.targets).toMatchObject({ calories: 2298, is_estimate: true });
    expect(d.meals_by_type.map((g: any) => g.meal_type)).toEqual(['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER']);
    expect(d.meals_by_type[1].meals).toHaveLength(1);
    expect(d.weight).toMatchObject({ current_kg: 80, target_kg: 74 });
    expect(d.weekly.days).toHaveLength(7); expect(d.weekly.days_logged).toBe(1);
  });
  it('builds weekly/monthly series, averages and goal consistency', async () => {
    const u = await onboardedUser(app);
    const day = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
    // hit the target (~2298 kcal): 900g of rice-equivalent calories via custom foods
    await request(app).post('/api/meals').set(u.auth).send({ meal_type: 'LUNCH', eaten_at: day(1), items: [{ name: 'Big plate', weight_g: 1000, custom_per_100g: { calories: 230, protein_g: 10, carbs_g: 30, fat_g: 8 } }] });
    await request(app).post('/api/meals').set(u.auth).send({ meal_type: 'LUNCH', eaten_at: day(2), items: [{ name: 'Light', weight_g: 100, custom_per_100g: { calories: 300, protein_g: 10, carbs_g: 30, fat_g: 8 } }] });
    const w = (await request(app).get('/api/progress').query({ range: 'week' }).set(u.auth)).body;
    expect(w.series).toHaveLength(7);
    expect(w.summary).toMatchObject({ days_logged: 2, days_target_achieved: 1, days_in_range: 7 });
    expect(w.summary.avg_calories).toBe(1300);
    expect((await request(app).get('/api/progress').query({ range: 'month' }).set(u.auth)).body.series).toHaveLength(30);
  });
});
