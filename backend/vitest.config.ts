import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node', fileParallelism: false, testTimeout: 30000, hookTimeout: 60000,
    setupFiles: ['tests/setup.ts'], globalSetup: ['tests/global-setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/fitness_test',
      JWT_SECRET: 'test-secret-test-secret-test-secret', AI_MODE: 'mock', NUTRITION_MODE: 'mock',
      AUTH_RATE_LIMIT_MAX: '1000', AI_RATE_LIMIT_PER_MIN: '1000', BCRYPT_ROUNDS: '4'
    }
  }
});
