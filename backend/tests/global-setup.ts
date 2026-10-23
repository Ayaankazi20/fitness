import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';

const ADMIN = process.env.TEST_ADMIN_URL ?? 'postgresql://postgres:postgres@localhost:5433/postgres';
const TEST_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/fitness_test';

/** Recreates a clean test database and applies every migration once per run. */
export default async function setup() {
  const admin = new pg.Client({ connectionString: ADMIN }); await admin.connect();
  await admin.query('DROP DATABASE IF EXISTS fitness_test WITH (FORCE)'); await admin.query('CREATE DATABASE fitness_test'); await admin.end();
  const c = new pg.Client({ connectionString: TEST_URL }); await c.connect();
  const dir = path.resolve('prisma/migrations');
  for (const m of fs.readdirSync(dir).filter((d) => fs.statSync(path.join(dir, d)).isDirectory()).sort()) await c.query(fs.readFileSync(path.join(dir, m, 'migration.sql'), 'utf8'));
  await c.end();
}
