import { randomUUID } from 'node:crypto';
import { query } from '../db/pool.js';
import { HttpError } from './httpError.js';

const CONTENT_TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/** Identify an image by its magic bytes - never trust the client's filename or Content-Type. */
export function detectImageExt(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

/**
 * Validate every uploaded file, then store them in the `photos` table under random names.
 * Returns public URL paths ("/uploads/<uuid>.jpg"). All-or-nothing.
 */
export async function saveImages(files = []) {
  const validated = files.map((file) => {
    const ext = detectImageExt(file.buffer);
    if (!ext) {
      throw new HttpError(400, 'invalid_image', 'Only JPEG, PNG or WebP photos are allowed', {
        photos: 'Only JPEG, PNG or WebP photos are allowed',
      });
    }
    return { buffer: file.buffer, ext };
  });

  const saved = [];
  try {
    for (const { buffer, ext } of validated) {
      const name = `${randomUUID()}.${ext}`;
      await query('INSERT INTO photos (name, content_type, data) VALUES ($1, $2, $3)', [name, CONTENT_TYPES[ext], buffer]);
      saved.push(`/uploads/${name}`);
    }
  } catch (err) {
    await removeImages(saved);
    throw err;
  }
  return saved;
}

/** Best-effort cleanup, used when a DB write fails after photos were stored. */
export async function removeImages(urls) {
  if (urls.length === 0) return;
  const names = urls.map((url) => url.split('/').pop());
  await query('DELETE FROM photos WHERE name = ANY($1)', [names]).catch(() => {});
}
