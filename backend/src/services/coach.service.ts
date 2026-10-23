import { prisma } from '../config/db.js';
import { COACH_SYSTEM_PROMPT, SAFETY_REPLY, UNSAFE_PATTERNS } from '../ai/prompts.js';
import type { CoachModel } from '../ai/foodSchema.js';
import { notFound } from '../utils/errors.js';
import { dashboard } from './stats.service.js';

export const DISCLAIMER = 'AI suggestions are general estimates, not medical advice.';
export const isUnsafe = (m: string) => UNSAFE_PATTERNS.some((r) => r.test(m));

export class CoachService {
  constructor(private model: CoachModel) {}

  async buildContext(userId: string, tz: number) {
    const [d, profile, goal] = await Promise.all([dashboard(userId, undefined, tz), prisma.userProfile.findUniqueOrThrow({ where: { userId } }), prisma.fitnessGoal.findFirst({ where: { userId, isActive: true } })]);
    return {
      goal: goal?.goalType, current_weight_kg: profile.weightKg, target_weight_kg: goal?.targetWeightKg ?? null, height_cm: profile.heightCm, activity_level: profile.activityLevel,
      dietary_preference: profile.dietaryPreference, allergies: profile.allergies, food_preferences: profile.foodPreferences,
      targets: { calories: d.targets.calories, protein_g: d.targets.protein_g, carbs_g: d.targets.carbs_g, fat_g: d.targets.fat_g },
      consumed_today: d.consumed, remaining: { calories: Math.max(0, d.remaining.calories), protein_g: Math.max(0, d.remaining.protein_g), carbs_g: Math.max(0, d.remaining.carbs_g), fat_g: Math.max(0, d.remaining.fat_g) },
    };
  }

  async chat(userId: string, message: string, conversationId: string | undefined, tz = 0) {
    let convo = conversationId ? await prisma.aiConversation.findFirst({ where: { id: conversationId, userId } }) : null;
    if (conversationId && !convo) throw notFound('Conversation');
    convo ??= await prisma.aiConversation.create({ data: { userId, title: message.slice(0, 50) } });
    const unsafe = isUnsafe(message);
    let reply = SAFETY_REPLY;
    if (!unsafe) {
      const history = (await prisma.aiMessage.findMany({ where: { conversationId: convo.id }, orderBy: { createdAt: 'desc' }, take: 10 })).reverse().map((m) => ({ role: m.role, content: m.content }));
      const context = await this.buildContext(userId, tz);
      reply = await this.model.reply({ system: COACH_SYSTEM_PROMPT, history, message, context });
    }
    await prisma.aiMessage.createMany({ data: [{ conversationId: convo.id, role: 'USER', content: message }, { conversationId: convo.id, role: 'ASSISTANT', content: reply }] });
    await prisma.aiConversation.update({ where: { id: convo.id }, data: { updatedAt: new Date() } });
    return { conversation_id: convo.id, reply, safety_triggered: unsafe, disclaimer: DISCLAIMER };
  }

  async latest(userId: string) {
    const c = await prisma.aiConversation.findFirst({ where: { userId }, orderBy: { updatedAt: 'desc' }, include: { messages: { orderBy: { createdAt: 'asc' }, take: 100 } } });
    return c ? { conversation_id: c.id, messages: c.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, created_at: m.createdAt.toISOString() })) } : { conversation_id: null, messages: [] };
  }
}
