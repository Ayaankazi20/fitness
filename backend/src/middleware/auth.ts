import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { unauthorized } from '../utils/errors.js';

declare global { namespace Express { interface Request { userId?: string } } }

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) throw unauthorized();
  try {
    const p = jwt.verify(h.slice(7), env.JWT_SECRET) as jwt.JwtPayload;
    if (typeof p.sub !== 'string') throw new Error('bad sub');
    req.userId = p.sub; next();
  } catch { throw unauthorized('Invalid or expired token'); }
}
