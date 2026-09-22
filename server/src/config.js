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
  clientDistDir: path.resolve(process.env.CLIENT_DIST_DIR || '../client/dist'),
  sessionTtlHours: num(process.env.SESSION_TTL_HOURS, 12),
  trustProxy: num(process.env.TRUST_PROXY, 0),
  // Adds `upgrade-insecure-requests` to the CSP. Default on in production; turn off to test a
  // production build over plain HTTP.
  forceHttps: bool(process.env.FORCE_HTTPS, env === 'production'),
  // Exact web-app origins allowed to call the API from a browser, e.g. https://kdkapsikar.github.io
  // Leave empty when the app and API share one origin.
  corsOrigins: (process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean),
  overdueDays: num(process.env.OVERDUE_DAYS, 7),
  // PLACEHOLDER: every citizen phone number's OTP is this one fixed code until an SMS gateway is
  // wired in (see services/otp.js). Replace that file with a real send + a random per-phone code
  // when the SMS subscription is ready; nothing else needs to change.
  otpCode: process.env.OTP_CODE || '1111',
  maxPhotos: 5,
  maxPhotoBytes: 5 * 1024 * 1024,
};

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is not set. Copy server/.env.example to server/.env first.');
}
// pg happily "connects" to whatever host is in a mis-pasted value (e.g. a web URL), and the only symptom
// is a confusing connection timeout - so fail fast with a clear message. The value itself is never printed.
if (!/^postgres(ql)?:\/\//i.test(config.databaseUrl)) {
  throw new Error(
    'DATABASE_URL must be a Postgres connection string starting with postgres:// or postgresql:// ' +
      `(it currently starts with "${config.databaseUrl.slice(0, 8)}..."). Check that you did not paste another setting, such as CORS_ORIGINS, here.`,
  );
}
