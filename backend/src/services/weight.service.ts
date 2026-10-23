import { prisma } from '../config/db.js';
import { notFound } from '../utils/errors.js';
import { todayString } from '../utils/dates.js';

const dto = (w: { id: string; weightKg: number; loggedOn: Date }) => ({ id: w.id, weight_kg: w.weightKg, date: w.loggedOn.toISOString().slice(0, 10) });

export async function addWeight(userId: string, weightKg: number, date?: string) {
  const day = new Date((date ?? todayString()) + 'T00:00:00Z');
  const w = await prisma.weightLog.upsert({ where: { userId_loggedOn: { userId, loggedOn: day } }, create: { userId, weightKg, loggedOn: day }, update: { weightKg } });
  const latest = await prisma.weightLog.findFirst({ where: { userId }, orderBy: { loggedOn: 'desc' } });
  if (latest?.id === w.id) await prisma.userProfile.updateMany({ where: { userId }, data: { weightKg } });
  return dto(w);
}
export async function listWeights(userId: string) {
  const rows = await prisma.weightLog.findMany({ where: { userId }, orderBy: { loggedOn: 'asc' } });
  const logs = rows.map(dto);
  const first = logs[0], last = logs[logs.length - 1];
  return { logs, summary: { start_kg: first?.weight_kg ?? null, current_kg: last?.weight_kg ?? null, change_kg: first && last ? Math.round((last.weight_kg - first.weight_kg) * 10) / 10 : null } };
}
export async function deleteWeight(userId: string, id: string) {
  const r = await prisma.weightLog.deleteMany({ where: { id, userId } });
  if (!r.count) throw notFound('Weight log');
}
