import request from 'supertest';
import zlib from 'node:zlib';
import { createApp, buildDeps } from '../src/app.js';
import type { CoachModel, VisionResult, VisionService } from '../src/ai/foodSchema.js';
import { AppError } from '../src/utils/errors.js';

/** Builds a valid solid-color PNG of the given size (so image validation sees a real image). */
export function makePng(w = 200, h = 200, seed = 0): Buffer {
  const crc = (buf: Buffer) => { let c, crc = ~0; for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (~crc) >>> 0; };
  const chunk = (type: string, data: Buffer) => { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, cr]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, seed)]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export class FakeVision implements VisionService {
  calls = 0;
  constructor(public result: VisionResult | (() => Promise<VisionResult>)) {}
  async identifyFood(): Promise<VisionResult> { this.calls++; return typeof this.result === 'function' ? this.result() : this.result; }
}
export const curryMeal: VisionResult = { foods: [{ name: 'Chicken Curry', estimated_weight_g: 150, confidence: 0.91 }, { name: 'Cooked Rice', estimated_weight_g: 200, confidence: 0.95 }, { name: 'Salad', estimated_weight_g: 100, confidence: 0.8 }], overall_confidence: 0.89, notes: 'Portion sizes are visual estimates.' };

export function makeApp(opts: { vision?: VisionService; coachModel?: CoachModel } = {}) {
  return createApp(buildDeps({ vision: opts.vision ?? new FakeVision(curryMeal), coachModel: opts.coachModel }));
}
export type TestApp = ReturnType<typeof makeApp>;

let n = 0;
export async function registerUser(app: TestApp, email = `user${++n}-${Date.now()}@example.com`) {
  const res = await request(app).post('/api/auth/register').send({ email, password: 'password123' });
  return { email, token: res.body.tokens.access_token as string, refresh: res.body.tokens.refresh_token as string, id: res.body.user.id as string, auth: { Authorization: `Bearer ${res.body.tokens.access_token}` } };
}
export const onboardingBody = { profile: { name: 'Ayaan', age: 25, gender: 'MALE', height_cm: 180, weight_kg: 80, activity_level: 'MODERATE', dietary_preference: 'vegetarian', allergies: ['peanuts'] }, goal: { goal_type: 'LOSE_WEIGHT', target_weight_kg: 74 } };
export async function onboardedUser(app: TestApp, email?: string) {
  const u = await registerUser(app, email);
  const r = await request(app).post('/api/onboarding').set(u.auth).send(onboardingBody);
  if (r.status !== 201) throw new Error('onboarding failed ' + JSON.stringify(r.body));
  return u;
}
export { AppError };
