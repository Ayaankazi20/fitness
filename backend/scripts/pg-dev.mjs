// Starts a throwaway embedded PostgreSQL (dev/CI only; production uses real Postgres / docker-compose).
import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';
const dir = process.env.PGDATA_DIR || './.pgdata';
const port = Number(process.env.PG_PORT || 5433);
const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'postgres', port, persistent: true, createPostgresUser: process.getuid?.() === 0 });
if (!fs.existsSync(dir + '/PG_VERSION')) await pg.initialise();
await pg.start();
try { await pg.createDatabase('fitness'); } catch {}
console.log(`embedded postgres ready: postgresql://postgres:postgres@localhost:${port}/fitness`);
process.on('SIGTERM', async () => { await pg.stop(); process.exit(0); });
process.on('SIGINT', async () => { await pg.stop(); process.exit(0); });
setInterval(() => {}, 1 << 30);
