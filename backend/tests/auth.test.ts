import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { makeApp, registerUser } from './helpers.js';
import { prisma } from '../src/config/db.js';

const app = makeApp();

describe('authentication', () => {
  it('registers a user, hashes the password, and returns tokens', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'A@Example.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('a@example.com');
    expect(res.body.tokens.access_token).toBeTruthy();
    const row = await prisma.user.findUnique({ where: { email: 'a@example.com' } });
    expect(row?.passwordHash).not.toContain('password123');
    expect(row?.passwordHash.startsWith('$2')).toBe(true);
  });
  it('rejects duplicate email and weak passwords', async () => {
    await registerUser(app, 'dup@example.com');
    expect((await request(app).post('/api/auth/register').send({ email: 'dup@example.com', password: 'password123' })).status).toBe(409);
    const weak = await request(app).post('/api/auth/register').send({ email: 'w@example.com', password: 'short' });
    expect(weak.status).toBe(400); expect(weak.body.error.code).toBe('VALIDATION_ERROR');
  });
  it('logs in with valid credentials', async () => {
    await registerUser(app, 'login@example.com');
    const res = await request(app).post('/api/auth/login').send({ email: 'login@example.com', password: 'password123' });
    expect(res.status).toBe(200); expect(res.body.tokens.refresh_token).toBeTruthy();
  });
  it('rejects invalid password and unknown email with the same error', async () => {
    await registerUser(app, 'bad@example.com');
    const wrong = await request(app).post('/api/auth/login').send({ email: 'bad@example.com', password: 'wrongpassword' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'password123' });
    expect(wrong.status).toBe(401); expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });
  it('protects routes (missing, malformed and valid token)', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/dashboard').set('Authorization', 'Bearer nope')).status).toBe(401);
    const u = await registerUser(app);
    const me = await request(app).get('/api/auth/me').set(u.auth);
    expect(me.status).toBe(200); expect(me.body.onboarded).toBe(false);
  });
  it('rotates refresh tokens and detects reuse', async () => {
    const u = await registerUser(app);
    const r1 = await request(app).post('/api/auth/refresh').send({ refresh_token: u.refresh });
    expect(r1.status).toBe(200);
    const reuse = await request(app).post('/api/auth/refresh').send({ refresh_token: u.refresh });
    expect(reuse.status).toBe(401);
    // reuse revokes the whole family, including the freshly issued token
    expect((await request(app).post('/api/auth/refresh').send({ refresh_token: r1.body.refresh_token })).status).toBe(401);
  });
  it('logout revokes the refresh token', async () => {
    const u = await registerUser(app);
    expect((await request(app).post('/api/auth/logout').send({ refresh_token: u.refresh })).status).toBe(204);
    expect((await request(app).post('/api/auth/refresh').send({ refresh_token: u.refresh })).status).toBe(401);
  });
});
