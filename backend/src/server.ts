import { assertProductionConfig, env } from './config/env.js';
import { prisma } from './config/db.js';
import { createApp } from './app.js';

assertProductionConfig();
await prisma.$queryRaw`SELECT 1`;
const server = createApp().listen(env.PORT, () => console.log(`API listening on :${env.PORT} (ai=${env.AI_MODE}, nutrition=${env.NUTRITION_MODE})`));
const shutdown = () => server.close(async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
