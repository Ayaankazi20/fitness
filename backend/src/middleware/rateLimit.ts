import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { env } from '../config/env.js';

const limited = (code: string, message: string) => (_req: Request, res: Response) =>
  void res.status(429).json({ error: { code, message } });

/** Per-IP limiter for unauthenticated auth routes. */
export const authLimiter = () => rateLimit({ windowMs: 15 * 60_000, limit: () => env.AUTH_RATE_LIMIT_MAX, standardHeaders: true, legacyHeaders: false, handler: limited('RATE_LIMITED', 'Too many attempts. Please try again later.') });

/** Per-user limiter (route must be behind requireAuth). */
export const perUserLimiter = (name: string, max: () => number, windowMs = 60_000) =>
  rateLimit({ windowMs, limit: max, standardHeaders: true, legacyHeaders: false, keyGenerator: (req) => `${name}:${req.userId ?? 'anon'}`, handler: limited('RATE_LIMITED', 'You are doing that too quickly. Please wait a moment.') });
