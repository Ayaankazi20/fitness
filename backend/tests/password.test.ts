import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import { makeApp, registerUser } from './helpers.js';
import { setMailer } from '../src/services/mail.service.js';
import { prisma } from '../src/config/db.js';

const app = makeApp();
let sent: { to: string; subject: string; text: string }[] = [];
beforeEach(() => { sent = []; setMailer({ async send(to, subject, text) { sent.push({ to, subject, text }); } }); });
const codeFrom = () => /code is ([A-Z0-9]{8})/.exec(sent.at(-1)!.text)![1]!;

describe('password reset', () => {
  it('emails a code, resets the password, revokes sessions, and the code is single-use', async () => {
    const u = await registerUser(app, 'reset@example.com');
    expect((await request(app).post('/api/auth/forgot-password').send({ email: 'reset@example.com' })).status).toBe(202);
    expect(sent).toHaveLength(1); expect(sent[0]!.to).toBe('reset@example.com');
    const code = codeFrom();
    // the stored value is a hash, never the code
    expect((await prisma.passwordResetToken.findFirstOrThrow()).codeHash).not.toContain(code);
    const ok = await request(app).post('/api/auth/reset-password').send({ email: 'reset@example.com', code: code.toLowerCase(), password: 'brandnewpass1' });
    expect(ok.status).toBe(204);
    expect((await request(app).post('/api/auth/login').send({ email: 'reset@example.com', password: 'password123' })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: 'reset@example.com', password: 'brandnewpass1' })).status).toBe(200);
    expect((await request(app).post('/api/auth/refresh').send({ refresh_token: u.refresh })).status).toBe(401);
    expect((await request(app).post('/api/auth/reset-password').send({ email: 'reset@example.com', code, password: 'anotherpass12' })).status).toBe(400);
  });
  it('does not reveal whether an email is registered', async () => {
    const r = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });
    expect(r.status).toBe(202); expect(sent).toHaveLength(0);
  });
  it('locks a code after 5 wrong guesses and rejects expired codes', async () => {
    await registerUser(app, 'brute@example.com');
    await request(app).post('/api/auth/forgot-password').send({ email: 'brute@example.com' });
    const code = codeFrom();
    for (let i = 0; i < 5; i++) expect((await request(app).post('/api/auth/reset-password').send({ email: 'brute@example.com', code: 'WRONGCD' + i, password: 'brandnewpass1' })).body.error.code).toBe('INVALID_RESET_CODE');
    expect((await request(app).post('/api/auth/reset-password').send({ email: 'brute@example.com', code, password: 'brandnewpass1' })).status).toBe(400);
    await prisma.passwordResetToken.updateMany({ data: { attempts: 0, expiresAt: new Date(Date.now() - 1000) } });
    expect((await request(app).post('/api/auth/reset-password').send({ email: 'brute@example.com', code, password: 'brandnewpass1' })).status).toBe(400);
  });
  it('rate-limits repeat requests to one email per minute and validates input', async () => {
    await registerUser(app, 'once@example.com');
    await request(app).post('/api/auth/forgot-password').send({ email: 'once@example.com' });
    await request(app).post('/api/auth/forgot-password').send({ email: 'once@example.com' });
    expect(sent).toHaveLength(1);
    expect((await request(app).post('/api/auth/reset-password').send({ email: 'once@example.com', code: 'ABCDEFGH', password: 'short' })).status).toBe(400);
  });
});

describe('change password', () => {
  it('requires the current password, revokes old refresh tokens, returns fresh tokens', async () => {
    const u = await registerUser(app, 'chg@example.com');
    expect((await request(app).post('/api/auth/change-password').send({ current_password: 'password123', new_password: 'newpassword1' })).status).toBe(401);
    const bad = await request(app).post('/api/auth/change-password').set(u.auth).send({ current_password: 'wrong', new_password: 'newpassword1' });
    expect(bad.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
    const ok = await request(app).post('/api/auth/change-password').set(u.auth).send({ current_password: 'password123', new_password: 'newpassword1' });
    expect(ok.status).toBe(200); expect(ok.body.tokens.refresh_token).toBeTruthy();
    expect((await request(app).post('/api/auth/refresh').send({ refresh_token: u.refresh })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: 'chg@example.com', password: 'newpassword1' })).status).toBe(200);
  });
});
