import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { makeApp, onboardedUser, registerUser } from './helpers.js';

const app = makeApp();
describe('weight tracking', () => {
  it('adds, upserts per day, retrieves history with summary, and deletes', async () => {
    const u = await onboardedUser(app);
    const a = await request(app).post('/api/weight').set(u.auth).send({ weight_kg: 79.4, date: '2026-09-20' });
    expect(a.status).toBe(201); expect(a.body).toMatchObject({ weight_kg: 79.4, date: '2026-09-20' });
    await request(app).post('/api/weight').set(u.auth).send({ weight_kg: 78.2 });
    const dup = await request(app).post('/api/weight').set(u.auth).send({ weight_kg: 78.0, date: '2026-09-20' });
    expect(dup.body.id).toBe(a.body.id);
    const list = await request(app).get('/api/weight').set(u.auth);
    expect(list.body.logs.map((l: any) => l.date)).toEqual(['2026-09-20', new Date().toISOString().slice(0, 10)]);
    expect(list.body.summary).toMatchObject({ start_kg: 78, current_kg: 78.2, change_kg: 0.2 });
    // latest weight syncs to the profile
    expect((await request(app).get('/api/profile').set(u.auth)).body.profile.weight_kg).toBe(78.2);
    expect((await request(app).delete(`/api/weight/${a.body.id}`).set(u.auth)).status).toBe(204);
    expect((await request(app).get('/api/weight').set(u.auth)).body.logs).toHaveLength(1);
  });
  it('validates input and isolates users', async () => {
    const u = await onboardedUser(app), other = await registerUser(app);
    expect((await request(app).post('/api/weight').set(u.auth).send({ weight_kg: 5 })).status).toBe(400);
    expect((await request(app).post('/api/weight').set(u.auth).send({ weight_kg: 70, date: '20-09-2026' })).status).toBe(400);
    const w = await request(app).post('/api/weight').set(u.auth).send({ weight_kg: 70 });
    expect((await request(app).delete(`/api/weight/${w.body.id}`).set(other.auth)).status).toBe(404);
    expect((await request(app).get('/api/weight')).status).toBe(401);
  });
});
