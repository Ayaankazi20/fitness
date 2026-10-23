import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { calculateBmr, calculateTargets, calculateTdee } from '../src/services/calorie.service.js';
import { makeApp, onboardedUser, registerUser, onboardingBody } from './helpers.js';

const body = { age: 25, gender: 'MALE', heightCm: 180, weightKg: 80, activityLevel: 'MODERATE' } as const;

describe('calorie targets', () => {
  it('computes BMR/TDEE (Mifflin-St Jeor)', () => {
    expect(calculateBmr(body)).toBe(1805);
    expect(calculateTdee(1805, 'MODERATE')).toBe(2798);
  });
  it('adjusts by goal and derives macros', () => {
    const lose = calculateTargets(body, 'LOSE_WEIGHT');
    expect(lose.calories).toBe(2298); expect(lose.protein_g).toBe(160);
    expect(lose.calories).toBeLessThan(calculateTargets(body, 'MAINTAIN').calories);
    expect(calculateTargets(body, 'GAIN_MUSCLE').calories).toBe(3098);
    // macros add up to (roughly) the calorie target
    const kcal = lose.protein_g * 4 + lose.carbs_g * 4 + lose.fat_g * 9;
    expect(Math.abs(kcal - lose.calories)).toBeLessThan(15);
  });
  it('never goes below the safety floor', () => {
    const t = calculateTargets({ age: 60, gender: 'FEMALE', heightCm: 150, weightKg: 45, activityLevel: 'SEDENTARY' }, 'LOSE_WEIGHT');
    expect(t.calories).toBeGreaterThanOrEqual(1200);
  });
  it('onboarding stores estimated targets; manual edits are kept', async () => {
    const app = makeApp();
    const u = await onboardedUser(app);
    const p = await request(app).get('/api/profile').set(u.auth);
    expect(p.body.targets).toMatchObject({ calories: 2298, is_estimate: true, is_manual: false });
    expect(p.body.targets.disclaimer).toMatch(/estimated/i);
    const m = await request(app).put('/api/nutrition/targets').set(u.auth).send({ calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 60 });
    expect(m.body).toMatchObject({ calories: 2000, is_manual: true });
    // changing profile does not overwrite a manual target
    await request(app).put('/api/profile').set(u.auth).send({ weight_kg: 78 });
    expect((await request(app).get('/api/nutrition/targets').set(u.auth)).body.calories).toBe(2000);
    // explicit recalculation restores the computed estimate
    expect((await request(app).post('/api/nutrition/targets/recalculate').set(u.auth)).body.is_manual).toBe(false);
  });
  it('validates onboarding input and requires onboarding before goals', async () => {
    const app = makeApp(); const u = await registerUser(app);
    const bad = await request(app).post('/api/onboarding').set(u.auth).send({ ...onboardingBody, profile: { ...onboardingBody.profile, age: 5 } });
    expect(bad.status).toBe(400);
    expect((await request(app).put('/api/goals').set(u.auth).send({ goal_type: 'MAINTAIN' })).status).toBe(409);
  });
});
