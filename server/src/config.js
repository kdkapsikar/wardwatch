import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ quiet: true });

const num = (value, fallback) => (value === undefined || value === '' ? fallback : Number(value));
const bool = (value, fallback) => (value === undefined || value === '' ? fallback : value === 'true');

const env = process.env.NODE_ENV || 'development';

export const config = {
  env,
  isProd: env === 'production',
  isTest: env === 'test',
  port: num(process.env.PORT, 3001),
  databaseUrl: process.env.DATABASE_URL,
  uploadDir: path.resolve(process.env.UPLOAD_DIR || './uploads'),
  clientDistDir: path.resolve(process.env.CLIENT_DIST_DIR || '../client/dist'),
  sessionTtlHours: num(process.env.SESSION_TTL_HOURS, 12),
  trustProxy: num(process.env.TRUST_PROXY, 0),
  cookieSecure: bool(process.env.COOKIE_SECURE, env === 'production'),
  overdueDays: num(process.env.OVERDUE_DAYS, 7),
  maxPhotos: 5,
  maxPhotoBytes: 5 * 1024 * 1024,
};

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is not set. Copy server/.env.example to server/.env first.');
}
