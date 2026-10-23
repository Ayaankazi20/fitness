import { imageSize } from 'image-size';
import { AppError } from './errors.js';
import { env } from '../config/env.js';

export function detectMime(b: Buffer): string | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.length > 12 && b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  if (b.length > 12 && b.subarray(4, 8).toString() === 'ftyp' && /^(heic|heix|hevc|heim|mif1|msf1)/.test(b.subarray(8, 12).toString())) return 'image/heic';
  return null;
}

/** Validates real file type (magic bytes, not the client's claim), size and dimensions. */
export function validateImage(file: { buffer: Buffer; size: number } | undefined): { buffer: Buffer; mimeType: string; width: number; height: number } {
  if (!file) throw new AppError(400, 'NO_IMAGE', 'Attach a photo in the "image" field.');
  if (file.size > env.MAX_IMAGE_MB * 1024 * 1024) throw new AppError(413, 'IMAGE_TOO_LARGE', `Image must be under ${env.MAX_IMAGE_MB} MB.`);
  const mimeType = detectMime(file.buffer);
  if (!mimeType) throw new AppError(415, 'INVALID_IMAGE', 'Unsupported image. Use JPG, PNG, WEBP or HEIC.');
  let width = 0, height = 0;
  try { const s = imageSize(file.buffer); width = s.width ?? 0; height = s.height ?? 0; } catch { throw new AppError(400, 'INVALID_IMAGE', 'This image could not be read.'); }
  if (width < 100 || height < 100) throw new AppError(422, 'IMAGE_TOO_SMALL', 'Image is too small to analyze. Try a closer, larger photo.');
  if (width > 12000 || height > 12000) throw new AppError(422, 'IMAGE_DIMENSIONS_TOO_LARGE', 'Image dimensions are too large.');
  return { buffer: file.buffer, mimeType, width, height };
}
