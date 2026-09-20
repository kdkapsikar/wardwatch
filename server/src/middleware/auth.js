import { HttpError } from '../lib/httpError.js';
import { resolveSession, tokenFromRequest } from '../services/sessions.js';

/** Attach `req.auth` ({ role, user } or null) from the Authorization: Bearer token. */
export async function loadSession(req, _res, next) {
  req.sessionToken = tokenFromRequest(req);
  req.auth = await resolveSession(req.sessionToken);
  next();
}

export const requireRole = (role) => (req, _res, next) => {
  if (!req.auth) throw new HttpError(401, 'unauthenticated', 'Please sign in');
  if (req.auth.role !== role) throw new HttpError(403, 'forbidden', 'You do not have access to this area');
  next();
};
