import { Router } from 'express';
import multer from 'multer';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter, perUserLimiter } from '../middleware/rateLimit.js';
import * as S from '../schemas/index.js';
import * as auth from '../services/auth.service.js';
import * as profile from '../services/profile.service.js';
import * as weight from '../services/weight.service.js';
import * as stats from '../services/stats.service.js';
import { getScanUsage } from '../services/usage.service.js';
import type { Deps } from '../app.js';

export function buildRouter({ food, meals, nutrition, coach }: Deps): Router {
  const r = Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.MAX_IMAGE_MB * 1024 * 1024, files: 1 } });
  const uid = (req: import('express').Request) => req.userId!;

  r.get('/health', (_req, res) => void res.json({ status: 'ok', ai_mode: env.AI_MODE, nutrition_mode: env.NUTRITION_MODE }));

  // ---- auth
  r.post('/auth/register', authLimiter(), async (req, res) => { const b = S.registerSchema.parse(req.body); res.status(201).json(await auth.register(b.email, b.password)); });
  r.post('/auth/login', authLimiter(), async (req, res) => { const b = S.loginSchema.parse(req.body); res.json(await auth.login(b.email, b.password)); });
  r.post('/auth/refresh', authLimiter(), async (req, res) => { res.json(await auth.refresh(S.refreshSchema.parse(req.body).refresh_token)); });
  r.post('/auth/logout', async (req, res) => { await auth.logout(S.refreshSchema.parse(req.body).refresh_token); res.status(204).end(); });
  r.post('/auth/forgot-password', authLimiter(), async (req, res) => { await auth.requestPasswordReset(S.forgotSchema.parse(req.body).email); res.status(202).json({ message: 'If that email is registered, a reset code has been sent.' }); });
  r.post('/auth/reset-password', authLimiter(), async (req, res) => { const b = S.resetSchema.parse(req.body); await auth.resetPassword(b.email, b.code, b.password); res.status(204).end(); });
  r.post('/auth/change-password', requireAuth, async (req, res) => { const b = S.changePasswordSchema.parse(req.body); res.json({ tokens: await auth.changePassword(uid(req), b.current_password, b.new_password) }); });
  r.get('/auth/me', requireAuth, async (req, res) => void res.json(await auth.me(uid(req))));

  // everything below requires a valid access token
  r.use(requireAuth);

  // ---- onboarding / profile / goals / targets
  r.post('/onboarding', async (req, res) => { const b = S.onboardingSchema.parse(req.body); res.status(201).json(await profile.saveOnboarding(uid(req), b.profile, b.goal)); });
  r.get('/profile', async (req, res) => void res.json(await profile.getProfile(uid(req))));
  r.put('/profile', async (req, res) => void res.json(await profile.updateProfile(uid(req), S.profileUpdateSchema.parse(req.body))));
  r.put('/goals', async (req, res) => void res.json(await profile.setGoal(uid(req), S.goalSchema.parse(req.body))));
  r.get('/nutrition/targets', async (req, res) => void res.json((await profile.getProfile(uid(req))).targets));
  r.put('/nutrition/targets', async (req, res) => void res.json(await profile.setManualTargets(uid(req), S.targetsSchema.parse(req.body))));
  r.post('/nutrition/targets/recalculate', async (req, res) => void res.json(await profile.recalculateTargets(uid(req))));

  // ---- food
  r.post('/food/analyze', perUserLimiter('analyze', () => env.ANALYZE_RATE_LIMIT_PER_MIN), upload.single('image'), async (req, res) => void res.json(await food.analyze(uid(req), req.file)));
  r.get('/food/search', async (req, res) => { const { q } = S.foodSearchSchema.parse(req.query); const { results, warnings } = await nutrition.search(q);
    res.json({ results: results.map((f) => ({ food_item_id: f.foodItemId, name: f.name, source: f.source, per_100g: f.per100g })), warnings }); });
  r.get('/scan/usage', async (req, res) => void res.json(await getScanUsage(uid(req))));

  // ---- meals
  r.post('/meals', async (req, res) => void res.status(201).json(await meals.create(uid(req), S.mealCreateSchema.parse(req.body))));
  r.get('/meals', async (req, res) => void res.json(await meals.list(uid(req), S.mealQuerySchema.parse(req.query))));
  r.get('/meals/:id', async (req, res) => void res.json(await meals.get(uid(req), S.idParam.parse(req.params).id)));
  r.put('/meals/:id', async (req, res) => void res.json(await meals.update(uid(req), S.idParam.parse(req.params).id, S.mealUpdateSchema.parse(req.body))));
  r.delete('/meals/:id', async (req, res) => { await meals.remove(uid(req), S.idParam.parse(req.params).id); res.status(204).end(); });

  // ---- dashboard / progress / weight
  r.get('/dashboard', async (req, res) => { const q = S.dashboardQuerySchema.parse(req.query); res.json(await stats.dashboard(uid(req), q.date, q.tz)); });
  r.get('/progress', async (req, res) => { const q = S.progressQuerySchema.parse(req.query); res.json(await stats.progress(uid(req), q.range, q.tz)); });
  r.post('/weight', async (req, res) => { const b = S.weightSchema.parse(req.body); res.status(201).json(await weight.addWeight(uid(req), b.weight_kg, b.date)); });
  r.get('/weight', async (req, res) => void res.json(await weight.listWeights(uid(req))));
  r.delete('/weight/:id', async (req, res) => { await weight.deleteWeight(uid(req), S.idParam.parse(req.params).id); res.status(204).end(); });

  // ---- AI coach
  r.post('/ai/chat', perUserLimiter('chat', () => env.AI_RATE_LIMIT_PER_MIN), async (req, res) => { const b = S.chatSchema.parse(req.body); res.json(await coach.chat(uid(req), b.message, b.conversation_id, b.tz ?? 0)); });
  r.get('/ai/conversations/latest', async (req, res) => void res.json(await coach.latest(uid(req))));
  return r;
}
