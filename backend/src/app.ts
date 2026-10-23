import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { buildRouter } from './routes/index.js';
import { FoodAnalysisService } from './services/food.service.js';
import { MealService } from './services/meal.service.js';
import { CoachService } from './services/coach.service.js';
import { buildNutritionService, type NutritionService } from './services/nutrition.service.js';
import { GeminiService } from './services/gemini.service.js';
import { MockGeminiService } from './services/gemini.mock.service.js';
import type { CoachModel, VisionService } from './ai/foodSchema.js';

export interface Deps { food: FoodAnalysisService; meals: MealService; nutrition: NutritionService; coach: CoachService }

/** Mock vs real services are chosen by AI_MODE / NUTRITION_MODE. Tests inject their own via overrides. */
export function buildDeps(o: { vision?: VisionService; coachModel?: CoachModel; nutrition?: NutritionService } = {}): Deps {
  const ai = env.AI_MODE === 'mock' ? new MockGeminiService() : new GeminiService();
  const nutrition = o.nutrition ?? buildNutritionService();
  return { nutrition, food: new FoodAnalysisService(o.vision ?? ai, nutrition), meals: new MealService(nutrition), coach: new CoachService(o.coachModel ?? ai) };
}

export function createApp(deps: Deps = buildDeps()) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS === '*' ? true : env.CORS_ORIGINS.split(',').map((s) => s.trim()) }));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', buildRouter(deps));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
