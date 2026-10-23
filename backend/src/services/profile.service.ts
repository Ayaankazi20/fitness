import { prisma } from '../config/db.js';
import { AppError, notFound } from '../utils/errors.js';
import { calculateTargets } from './calorie.service.js';
import type { Gender, ActivityLevel, GoalType } from '../generated/prisma/enums.js';
import type { z } from 'zod';
import type { goalSchema, profileSchema, targetsSchema } from '../schemas/index.js';
import { todayString } from '../utils/dates.js';

type ProfileIn = z.infer<typeof profileSchema>;
type GoalIn = z.infer<typeof goalSchema>;
type TargetsIn = z.infer<typeof targetsSchema>;

const profileData = (p: ProfileIn) => ({ name: p.name, age: p.age, gender: p.gender as Gender, heightCm: p.height_cm, weightKg: p.weight_kg, activityLevel: p.activity_level as ActivityLevel, dietaryPreference: p.dietary_preference ?? null, allergies: p.allergies ?? [], foodPreferences: p.food_preferences ?? [] });

export const targetsDto = (t: { calories: number; proteinG: number; carbsG: number; fatG: number; bmr: number | null; tdee: number | null; isManual: boolean }) =>
  ({ calories: t.calories, protein_g: t.proteinG, carbs_g: t.carbsG, fat_g: t.fatG, bmr: t.bmr, tdee: t.tdee, is_manual: t.isManual, is_estimate: true, disclaimer: 'Estimated daily target, not a guaranteed requirement or medical advice.' });

export async function saveOnboarding(userId: string, profile: ProfileIn, goal: GoalIn) {
  const computed = calculateTargets({ age: profile.age, gender: profile.gender, heightCm: profile.height_cm, weightKg: profile.weight_kg, activityLevel: profile.activity_level }, goal.goal_type);
  await prisma.$transaction(async (tx) => {
    await tx.userProfile.upsert({ where: { userId }, create: { userId, ...profileData(profile) }, update: profileData(profile) });
    await tx.fitnessGoal.updateMany({ where: { userId, isActive: true }, data: { isActive: false } });
    await tx.fitnessGoal.create({ data: { userId, goalType: goal.goal_type as GoalType, targetWeightKg: goal.target_weight_kg ?? null } });
    await tx.nutritionTarget.updateMany({ where: { userId, isActive: true }, data: { isActive: false } });
    await tx.nutritionTarget.create({ data: { userId, calories: computed.calories, proteinG: computed.protein_g, carbsG: computed.carbs_g, fatG: computed.fat_g, bmr: computed.bmr, tdee: computed.tdee } });
    const today = new Date(todayString() + 'T00:00:00Z');
    await tx.weightLog.upsert({ where: { userId_loggedOn: { userId, loggedOn: today } }, create: { userId, weightKg: profile.weight_kg, loggedOn: today }, update: { weightKg: profile.weight_kg } });
  });
  return getProfile(userId);
}

export async function getProfile(userId: string) {
  const [p, g, t] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.fitnessGoal.findFirst({ where: { userId, isActive: true }, orderBy: { createdAt: 'desc' } }),
    prisma.nutritionTarget.findFirst({ where: { userId, isActive: true }, orderBy: { createdAt: 'desc' } }),
  ]);
  if (!p) throw notFound('Profile');
  return {
    profile: { name: p.name, age: p.age, gender: p.gender, height_cm: p.heightCm, weight_kg: p.weightKg, activity_level: p.activityLevel, dietary_preference: p.dietaryPreference, allergies: p.allergies, food_preferences: p.foodPreferences },
    goal: g ? { goal_type: g.goalType, target_weight_kg: g.targetWeightKg } : null,
    targets: t ? targetsDto(t) : null,
  };
}

async function recomputeIfAuto(userId: string) {
  const [p, g, t] = await Promise.all([
    prisma.userProfile.findUniqueOrThrow({ where: { userId } }),
    prisma.fitnessGoal.findFirst({ where: { userId, isActive: true }, orderBy: { createdAt: 'desc' } }),
    prisma.nutritionTarget.findFirst({ where: { userId, isActive: true } }),
  ]);
  if (!g || t?.isManual) return;
  await replaceTargets(userId, p, g.goalType, false);
}
async function replaceTargets(userId: string, p: { age: number; gender: Gender; heightCm: number; weightKg: number; activityLevel: ActivityLevel }, goal: GoalType, force: boolean) {
  const c = calculateTargets(p, goal);
  await prisma.$transaction([
    prisma.nutritionTarget.updateMany({ where: { userId, isActive: true }, data: { isActive: false } }),
    prisma.nutritionTarget.create({ data: { userId, calories: c.calories, proteinG: c.protein_g, carbsG: c.carbs_g, fatG: c.fat_g, bmr: c.bmr, tdee: c.tdee, isManual: false } }),
  ]);
  void force;
}

export async function updateProfile(userId: string, patch: Partial<ProfileIn>) {
  const cur = await prisma.userProfile.findUnique({ where: { userId } });
  if (!cur) throw notFound('Profile');
  await prisma.userProfile.update({ where: { userId }, data: {
    ...(patch.name !== undefined && { name: patch.name }), ...(patch.age !== undefined && { age: patch.age }), ...(patch.gender && { gender: patch.gender }),
    ...(patch.height_cm !== undefined && { heightCm: patch.height_cm }), ...(patch.weight_kg !== undefined && { weightKg: patch.weight_kg }),
    ...(patch.activity_level && { activityLevel: patch.activity_level }), ...(patch.dietary_preference !== undefined && { dietaryPreference: patch.dietary_preference }),
    ...(patch.allergies && { allergies: patch.allergies }), ...(patch.food_preferences && { foodPreferences: patch.food_preferences }),
  } });
  await recomputeIfAuto(userId);
  return getProfile(userId);
}

export async function setGoal(userId: string, goal: GoalIn) {
  if (!(await prisma.userProfile.findUnique({ where: { userId } }))) throw new AppError(409, 'ONBOARDING_REQUIRED', 'Complete your profile first.');
  await prisma.$transaction([
    prisma.fitnessGoal.updateMany({ where: { userId, isActive: true }, data: { isActive: false } }),
    prisma.fitnessGoal.create({ data: { userId, goalType: goal.goal_type as GoalType, targetWeightKg: goal.target_weight_kg ?? null } }),
  ]);
  const p = await prisma.userProfile.findUniqueOrThrow({ where: { userId } });
  await replaceTargets(userId, p, goal.goal_type as GoalType, true);
  return getProfile(userId);
}

export async function setManualTargets(userId: string, t: TargetsIn) {
  const cur = await prisma.nutritionTarget.findFirst({ where: { userId, isActive: true } });
  await prisma.$transaction([
    prisma.nutritionTarget.updateMany({ where: { userId, isActive: true }, data: { isActive: false } }),
    prisma.nutritionTarget.create({ data: { userId, calories: t.calories, proteinG: t.protein_g, carbsG: t.carbs_g, fatG: t.fat_g, bmr: cur?.bmr ?? null, tdee: cur?.tdee ?? null, isManual: true } }),
  ]);
  return (await getProfile(userId)).targets;
}

export async function recalculateTargets(userId: string) {
  const [p, g] = await Promise.all([prisma.userProfile.findUnique({ where: { userId } }), prisma.fitnessGoal.findFirst({ where: { userId, isActive: true } })]);
  if (!p || !g) throw new AppError(409, 'ONBOARDING_REQUIRED', 'Complete onboarding first.');
  await replaceTargets(userId, p, g.goalType, true);
  return (await getProfile(userId)).targets;
}
