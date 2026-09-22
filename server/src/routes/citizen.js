import { Router } from 'express';
import { query } from '../db/pool.js';
import { HttpError } from '../lib/httpError.js';
import { normalizePublicId } from '../lib/ids.js';
import { parse, otpRequestSchema, otpVerifySchema } from '../lib/validation.js';
import { requireRole } from '../middleware/auth.js';
import { otpRequestLimiter, otpVerifyLimiter } from '../middleware/rateLimit.js';
import { getIssue, listCitizenIssues } from '../services/issues.js';
import { sendOtp, verifyOtp } from '../services/otp.js';
import { createSession, findUser } from '../services/sessions.js';

const router = Router();

// POST /api/citizen/otp/request { phone } - "sends" a 4-digit code (a fixed placeholder for now -
// see services/otp.js). Always 204 for a well-formed number, whether or not it has reported anything.
router.post('/otp/request', otpRequestLimiter, async (req, res) => {
  const { phone } = parse(otpRequestSchema, req.body ?? {});
  await sendOtp(phone);
  res.status(204).end();
});

// POST /api/citizen/otp/verify { phone, code } - a citizen's identity IS their phone number, so this
// both signs in and "signs up": the first successful verification creates the account, which then
// immediately sees every issue already filed with that number.
router.post('/otp/verify', otpVerifyLimiter, async (req, res) => {
  const { phone, code } = parse(otpVerifySchema, req.body ?? {});
  if (!verifyOtp(phone, code)) throw new HttpError(401, 'invalid_otp', 'Incorrect code. Please try again.');

  const { rows } = await query(
    `INSERT INTO citizens (phone) VALUES ($1)
     ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
     RETURNING id`,
    [phone],
  );
  const citizenId = rows[0].id;
  const token = await createSession('citizen', citizenId);
  res.json({ token, auth: { role: 'citizen', user: await findUser('citizen', citizenId) } });
});

router.use(requireRole('citizen'));

// GET /api/citizen/issues - everything this phone number has reported.
router.get('/issues', async (req, res) => {
  res.json({ issues: await listCitizenIssues(req.auth.user.phone) });
});

// GET /api/citizen/issues/:publicId - the full record, only if it was filed with this phone number.
router.get('/issues/:publicId', async (req, res) => {
  const publicId = normalizePublicId(req.params.publicId);
  const issue = publicId && (await getIssue(publicId, { citizenPhone: req.auth.user.phone }));
  if (!issue) throw new HttpError(404, 'not_found', 'Issue not found');
  res.json({ issue });
});

export default router;
