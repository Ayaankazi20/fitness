import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';
import { AppError } from '../utils/errors.js';

export const notFoundHandler: RequestHandler = (_req, res) => { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }); };

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) return void res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  if (err instanceof ZodError) return void res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) } });
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    return void res.status(tooBig ? 413 : 400).json({ error: { code: tooBig ? 'IMAGE_TOO_LARGE' : 'INVALID_UPLOAD', message: tooBig ? 'Image is too large. Try a smaller photo.' : err.message } });
  }
  if (err?.type === 'entity.parse.failed') return void res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Malformed JSON body' } });
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
};
