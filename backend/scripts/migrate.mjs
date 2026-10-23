// Applies prisma/migrations/*/migration.sql in order using pg (offline-friendly equivalent of `prisma migrate deploy`).
import pg from 'pg'; import fs from 'node:fs'; import path from 'node:path';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
await c.query('CREATE TABLE IF NOT EXISTS _applied_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())');
const dir = 'prisma/migrations';
for (const m of fs.readdirSync(dir).filter(d => fs.statSync(path.join(dir, d)).isDirectory()).sort()) {
  const done = await c.query('SELECT 1 FROM _applied_migrations WHERE name=$1', [m]);
  if (done.rowCount) continue;
  await c.query('BEGIN');
  try { await c.query(fs.readFileSync(path.join(dir, m, 'migration.sql'), 'utf8')); await c.query('INSERT INTO _applied_migrations(name) VALUES($1)', [m]); await c.query('COMMIT'); console.log('applied', m); }
  catch (e) { await c.query('ROLLBACK'); console.error('FAILED', m, e.message); process.exit(1); }
}
await c.end();
