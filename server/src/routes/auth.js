import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { query } from '../db/pool.js';
import { BCRYPT_ROUNDS } from '../lib/constants.js';
import { HttpError } from '../lib/httpError.js';
import { parse, loginSchema } from '../lib/validation.js';
import { loginLimiter } from '../middleware/rateLimit.js';
import { createSession, destroySession, findUser } from '../services/sessions.js';

// Compared against when the username does not exist, so response time does not reveal valid usernames.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

const router = Router();

const ACCOUNT_SQL = {
  admin: 'SELECT id, password_hash, is_active FROM admins WHERE lower(username) = lower($1)',
  corporator: 'SELECT id, password_hash, is_active FROM corporators WHERE lower(username) = lower($1)',
};

/**
 * POST /api/auth/login - one door for corporators and admins; the role comes from whichever table
 * holds the account, so nobody can pick the wrong sign-in page. If the same username exists in both
 * tables, the password decides which account you get.
 */
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = parse(loginSchema, req.body ?? {});

  const found = await Promise.all(
    Object.entries(ACCOUNT_SQL).map(async ([role, sql]) => {
      const { rows } = await query(sql, [username]);
      return rows.map((row) => ({ role, ...row }));
    }),
  );
  const candidates = found.flat();

  // Unknown usernames still pay for one bcrypt compare, so response time does not reveal them.
  if (candidates.length === 0) await bcrypt.compare(password, DUMMY_HASH);

  let match = null;
  let inactiveMatch = false;
  for (const candidate of candidates) {
    if (await bcrypt.compare(password, candidate.password_hash)) {
      if (candidate.is_active) {
        match = candidate;
        break;
      }
      inactiveMatch = true;
    }
  }

  if (!match) {
    // The client always gets the same generic message; the real reason goes to the server log only
    // (never the password), so operators can tell a typo from a deactivated account.
    if (!config.isTest) {
      const reason = candidates.length === 0 ? 'unknown_username' : inactiveMatch ? 'account_inactive' : 'wrong_password';
      console.warn(`login_failed username=${JSON.stringify(username)} reason=${reason} ip=${req.ip}`);
    }
    throw new HttpError(401, 'invalid_credentials', 'Invalid username or password');
  }

  const token = await createSession(match.role, match.id);
  // The web app keeps this token and sends it as `Authorization: Bearer <token>`. It is an opaque
  // random value (only its hash is stored server-side), not a JWT, and expires with the session.
  res.json({ token, auth: { role: match.role, user: await findUser(match.role, match.id) } });
});

// GET /api/auth/me - 200 with { auth: null } when signed out, so the SPA boot is not a console error
router.get('/me', (req, res) => res.json({ auth: req.auth }));

router.post('/logout', async (req, res) => {
  await destroySession(req.sessionToken);
  res.status(204).end();
});

export default router;
