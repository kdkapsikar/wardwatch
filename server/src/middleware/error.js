import multer from 'multer';
import { config } from '../config.js';
import { HttpError } from '../lib/httpError.js';

const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: `Each photo must be smaller than ${config.maxPhotoBytes / 1024 / 1024} MB`,
  LIMIT_FILE_COUNT: `You can attach at most ${config.maxPhotos} photos`,
  LIMIT_UNEXPECTED_FILE: `You can attach at most ${config.maxPhotos} photos`,
};

export function notFound(_req, _res, next) {
  next(new HttpError(404, 'not_found', 'Not found'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, fields: err.fields } });
  }
  if (err instanceof multer.MulterError) {
    const message = MULTER_MESSAGES[err.code] ?? 'Invalid upload';
    return res.status(400).json({ error: { code: 'invalid_upload', message, fields: { photos: message } } });
  }
  // body-parser errors (malformed JSON, payload too large) carry a safe 4xx status.
  if (err.status && err.status < 500 && err.expose) {
    return res.status(err.status).json({ error: { code: 'bad_request', message: err.message } });
  }
  console.error(`${req.method} ${req.originalUrl}`, err);
  return res.status(500).json({ error: { code: 'internal_error', message: 'Something went wrong. Please try again.' } });
}
