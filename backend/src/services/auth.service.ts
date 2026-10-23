import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { AppError, unauthorized } from '../utils/errors.js';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const signAccess = (userId: string) => jwt.sign({}, env.JWT_SECRET, { subject: userId, expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'] });

async function issueTokens(userId: string) {
  const refresh = randomBytes(48).toString('hex');
  await prisma.refreshToken.create({ data: { userId, tokenHash: sha(refresh), expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86400000) } });
  return { access_token: signAccess(userId), refresh_token: refresh, token_type: 'Bearer' as const, expires_in: env.ACCESS_TOKEN_TTL };
}

export async function register(email: string, password: string) {
  if (await prisma.user.findUnique({ where: { email } })) throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
  const user = await prisma.user.create({ data: { email, passwordHash: await bcrypt.hash(password, env.BCRYPT_ROUNDS) } });
  return { user: { id: user.id, email: user.email }, tokens: await issueTokens(user.id) };
}

// Constant-ish time: always run a bcrypt compare, even for unknown emails.
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 4);
export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
  return { user: { id: user.id, email: user.email }, tokens: await issueTokens(user.id) };
}

/** Rotating refresh tokens: each token is single-use; reuse of a revoked token revokes the whole family for that user. */
export async function refresh(token: string) {
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: sha(token) } });
  if (!row || row.expiresAt < new Date()) throw unauthorized('Invalid refresh token');
  if (row.revokedAt) { await prisma.refreshToken.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } }); throw unauthorized('Refresh token reuse detected'); }
  await prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
  return issueTokens(row.userId);
}

export async function logout(token: string) {
  await prisma.refreshToken.updateMany({ where: { tokenHash: sha(token), revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function me(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
  if (!user) throw unauthorized();
  return { id: user.id, email: user.email, name: user.profile?.name ?? null, onboarded: !!user.profile };
}

// ---------------------------------------------------------------------------------------------------------
// Password reset (one-time 8-character code emailed to the user) and change password
// ---------------------------------------------------------------------------------------------------------
import { randomInt } from 'node:crypto';
import { getMailer } from './mail.service.js';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no look-alike characters (I, L, O, 0, 1)
const MAX_CODE_ATTEMPTS = 5;
const newCode = () => Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
const hashCode = (email: string, code: string) => sha(`${email}:${code.trim().toUpperCase()}`);

/** Always succeeds from the caller's point of view so the endpoint cannot be used to discover registered emails. */
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;
  const recent = await prisma.passwordResetToken.count({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 60_000) } } });
  if (recent) return; // at most one email per minute per account
  const code = newCode();
  await prisma.passwordResetToken.create({ data: { userId: user.id, codeHash: hashCode(email, code), expiresAt: new Date(Date.now() + env.RESET_CODE_TTL_MIN * 60_000) } });
  await getMailer().send(email, 'Your FitScan AI password reset code', `Your password reset code is ${code}\n\nIt expires in ${env.RESET_CODE_TTL_MIN} minutes. If you didn't ask for this, you can ignore this email.`);
}

export async function resetPassword(email: string, code: string, newPassword: string) {
  const bad = () => new AppError(400, 'INVALID_RESET_CODE', 'That code is invalid or has expired. Request a new one.');
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw bad();
  const tok = await prisma.passwordResetToken.findFirst({ where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } });
  if (!tok || tok.attempts >= MAX_CODE_ATTEMPTS) throw bad();
  if (tok.codeHash !== hashCode(email, code)) { await prisma.passwordResetToken.update({ where: { id: tok.id }, data: { attempts: { increment: 1 } } }); throw bad(); }
  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}

export async function changePassword(userId: string, current: string, next: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !(await bcrypt.compare(current, user.passwordHash))) throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'Your current password is incorrect.');
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(next, env.BCRYPT_ROUNDS) } }),
    prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  return issueTokens(userId); // keep the current device signed in
}
