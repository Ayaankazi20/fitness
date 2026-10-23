import { env } from './env.js';

export type Plan = 'free' | 'premium';
/** Plan limits are configuration, not business logic. Swap getUserPlan for a real subscription lookup later. */
export async function getUserPlan(_userId: string): Promise<Plan> { return 'free'; }
export function scanLimitFor(plan: Plan): number {
  return plan === 'premium' ? env.PREMIUM_SCAN_LIMIT_PER_MONTH : env.FREE_SCAN_LIMIT_PER_MONTH;
}
