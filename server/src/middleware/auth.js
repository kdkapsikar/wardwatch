import { HttpError } from '../lib/httpError.js';
import { COOKIE_NAME, resolveSession } from '../services/sessions.js';

/** Attach `req.auth` ({ role, user } or null) from the session cookie. */
export async function loadSession(req, _res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  req.sessionToken = token;
  req.auth = await resolveSession(token);
  next();
}

export const requireRole = (role) => (req, _res, next) => {
  if (!req.auth) throw new HttpError(401, 'unauthenticated', 'Please sign in');
  if (req.auth.role !== role) throw new HttpError(403, 'forbidden', 'You do not have access to this area');
  next();
};
