import { afterAll, beforeEach } from 'vitest';
import { prisma } from '../src/config/db.js';

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE users, food_items, usage_counters RESTART IDENTITY CASCADE');
});
afterAll(async () => { await prisma.$disconnect(); });
