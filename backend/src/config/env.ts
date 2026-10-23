import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  CORS_ORIGINS: z.string().default('*'),
  AI_MODE: z.enum(['real', 'mock']).default('real'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  GEMINI_TIMEOUT_MS: z.coerce.number().default(30000),
  NUTRITION_MODE: z.enum(['real', 'mock']).default('real'),
  USDA_API_KEY: z.string().optional(),
  USDA_TIMEOUT_MS: z.coerce.number().default(8000),
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('FitScan AI <no-reply@example.com>'),
  RESET_CODE_TTL_MIN: z.coerce.number().default(30),
  MAX_IMAGE_MB: z.coerce.number().default(8),
  FREE_SCAN_LIMIT_PER_MONTH: z.coerce.number().default(20),
  PREMIUM_SCAN_LIMIT_PER_MONTH: z.coerce.number().default(1000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(30),
  ANALYZE_RATE_LIMIT_PER_MIN: z.coerce.number().default(6),
  AI_RATE_LIMIT_PER_MIN: z.coerce.number().default(12),
});

export type Env = z.infer<typeof schema>;
// Plain mutable object so tests can adjust limits.
export const env: Env = schema.parse(process.env);

export function assertProductionConfig(e: Env = env): void {
  if (e.AI_MODE === 'real' && !e.GEMINI_API_KEY) throw new Error('AI_MODE=real requires GEMINI_API_KEY');
  if (e.NUTRITION_MODE === 'real' && !e.USDA_API_KEY) throw new Error('NUTRITION_MODE=real requires USDA_API_KEY');
  if (e.NODE_ENV === 'production' && !e.SMTP_URL) throw new Error('Set SMTP_URL in production so password reset emails can be delivered');
  if (e.NODE_ENV === 'production' && e.CORS_ORIGINS === '*') throw new Error('Set CORS_ORIGINS explicitly in production');
}
