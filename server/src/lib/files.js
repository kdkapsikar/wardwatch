import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { HttpError } from './httpError.js';

/** Identify an image by its magic bytes - never trust the client's filename or Content-Type. */
export function detectImageExt(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

/**
 * Validate every uploaded file, then write them under random names.
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

  await fs.mkdir(config.uploadDir, { recursive: true });
  const saved = [];
  try {
    for (const { buffer, ext } of validated) {
      const name = `${randomUUID()}.${ext}`;
      await fs.writeFile(path.join(config.uploadDir, name), buffer, { flag: 'wx' });
      saved.push(`/uploads/${name}`);
    }
  } catch (err) {
    await removeImages(saved);
    throw err;
  }
  return saved;
}

/** Best-effort cleanup, used when a DB write fails after files were saved. */
export async function removeImages(urls) {
  await Promise.all(
    urls.map((url) => fs.unlink(path.join(config.uploadDir, path.basename(url))).catch(() => {})),
  );
}
