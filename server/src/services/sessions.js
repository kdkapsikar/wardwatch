import { createHash, randomBytes } from 'node:crypto';
import { config } from '../config.js';
import { query } from '../db/pool.js';

export const COOKIE_NAME = 'ww_session';

const hash = (token) => createHash('sha256').update(token).digest('hex');

const USER_SQL = {
  admin: `SELECT id, name, username, is_active FROM admins WHERE id = $1`,
  corporator: `SELECT c.id, c.name, c.username, c.is_active, c.ward_id,
                      w.number AS ward_number, w.name AS ward_name
                 FROM corporators c JOIN wards w ON w.id = c.ward_id
                WHERE c.id = $1`,
};

export async function findUser(role, id) {
  const { rows } = await query(USER_SQL[role], [id]);
  const row = rows[0];
  if (!row || !row.is_active) return null;
  const user = { id: row.id, name: row.name, username: row.username };
  if (role === 'corporator') user.ward = { id: row.ward_id, number: row.ward_number, name: row.ward_name };
  return user;
}

export async function createSession(role, userId) {
  const token = randomBytes(32).toString('base64url');
  await query(
    `INSERT INTO sessions (token_hash, role, user_id, expires_at)
     VALUES ($1, $2, $3, now() + make_interval(hours => $4))`,
    [hash(token), role, userId, config.sessionTtlHours],
  );
  return token;
}

/** Resolve a cookie token to { role, user } or null (unknown, expired or deactivated user). */
export async function resolveSession(token) {
  if (!token) return null;
  const { rows } = await query(
    'SELECT role, user_id FROM sessions WHERE token_hash = $1 AND expires_at > now()',
    [hash(token)],
  );
  if (!rows[0]) return null;
  const user = await findUser(rows[0].role, rows[0].user_id);
  return user ? { role: rows[0].role, user } : null;
}

export async function destroySession(token) {
  if (token) await query('DELETE FROM sessions WHERE token_hash = $1', [hash(token)]);
}

export async function purgeExpiredSessions() {
  await query('DELETE FROM sessions WHERE expires_at <= now()');
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax', // blocks cross-site POSTs, which is our CSRF defence
    secure: config.cookieSecure,
    path: '/',
  };
}
