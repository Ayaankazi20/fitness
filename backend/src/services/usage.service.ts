import { prisma } from '../config/db.js';
import { getUserPlan, scanLimitFor } from '../config/plans.js';
import { AppError } from '../utils/errors.js';

const period = () => new Date().toISOString().slice(0, 7);

export async function getScanUsage(userId: string) {
  const plan = await getUserPlan(userId);
  const row = await prisma.usageCounter.findUnique({ where: { userId_feature_period: { userId, feature: 'food_scan', period: period() } } });
  return { plan, used: row?.count ?? 0, limit: scanLimitFor(plan) };
}
export async function assertScanQuota(userId: string) {
  const u = await getScanUsage(userId);
  if (u.used >= u.limit) throw new AppError(429, 'QUOTA_EXCEEDED', `You've used all ${u.limit} AI scans for this month. You can still log meals manually.`, u);
}
/** Only successful analyses consume quota. */
export async function consumeScan(userId: string) {
  await prisma.usageCounter.upsert({
    where: { userId_feature_period: { userId, feature: 'food_scan', period: period() } },
    create: { userId, feature: 'food_scan', period: period(), count: 1 }, update: { count: { increment: 1 } },
  });
}
