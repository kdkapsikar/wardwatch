import { Router } from 'express';
import { HttpError } from '../lib/httpError.js';
import { normalizePublicId } from '../lib/ids.js';
import {
  adminListQuerySchema, noteSchema, parse,
  rosterAssignSchema, rosterCorporatorSchema, rosterEditPersonSchema, rosterMandalAdhyakshSchema,
} from '../lib/validation.js';
import { requireRole } from '../middleware/auth.js';
import { getIssue, listIssues } from '../services/issues.js';
import { createNote, deleteNote, listNotes, updateNote } from '../services/notes.js';
import {
  assignMandalAdhyaksh, createCorporator, createMandalAdhyaksh,
  deactivateCorporator, deactivateMandalAdhyaksh, getRoster, updateCorporator, updateMandalAdhyaksh,
} from '../services/roster.js';
import { getDashboard } from '../services/stats.js';

const router = Router();
router.use(requireRole('admin'));

// A Mandal Adhyaksh sees only their assigned constituencies; the mayor/admin sees the whole city.
const wardScope = (req) => (req.auth.user.role === 'mandal_adhyaksh' ? req.auth.user.wards.map((w) => w.id) : null);

// Managing who covers which constituency is the mayor/admin's job, not a Mandal Adhyaksh's own.
function requireMayor(req, _res, next) {
  if (req.auth.user.role !== 'admin') throw new HttpError(403, 'forbidden', 'You do not have access to this area');
  next();
}

// GET /api/admin/dashboard - totals, constituency-wise counts, category split, corporator performance
// (scoped to the caller's constituencies when they are a Mandal Adhyaksh)
router.get('/dashboard', async (req, res) => {
  res.json(await getDashboard(req.auth.user.id, wardScope(req)));
});

// GET /api/admin/issues?status=&category=&ward=<number>&overdue=1&page= - city-wide issue list (drill-down target)
router.get('/issues', async (req, res) => {
  const { ward, ...filters } = parse(adminListQuerySchema, req.query);
  res.json(await listIssues({ wardNumber: ward, wardIds: wardScope(req) }, filters));
});

// GET /api/admin/issues/:publicId - the full record (read-only), incl. citizen contact and location
router.get('/issues/:publicId', async (req, res) => {
  const publicId = normalizePublicId(req.params.publicId);
  const issue = publicId && (await getIssue(publicId, { staff: true, staffWardIds: wardScope(req) }));
  if (!issue) throw new HttpError(404, 'not_found', 'Issue not found');
  res.json({ issue });
});

// ---- Private notes. Everything below is scoped to the signed-in admin (see services/notes.js). ----

// The :id param is a bigint; reject anything else as "not found" instead of letting Postgres 500.
router.param('noteId', (req, _res, next, value) => {
  if (!/^\d{1,18}$/.test(value)) return next(new HttpError(404, 'not_found', 'Note not found'));
  req.noteId = value;
  return next();
});

// GET /api/admin/notes[?issue=<publicId>]
router.get('/notes', async (req, res) => {
  const issuePublicId = req.query.issue ? normalizePublicId(req.query.issue) : undefined;
  if (req.query.issue && !issuePublicId) return res.json({ notes: [], totals: { count: 0, budget_total: 0 } });
  return res.json(await listNotes(req.auth.user.id, { issuePublicId }));
});

// POST /api/admin/notes  { body, budget_amount?, issue? }
router.post('/notes', async (req, res) => {
  const data = parse(noteSchema, req.body ?? {});
  let issuePublicId;
  if (req.body?.issue) {
    issuePublicId = normalizePublicId(req.body.issue);
    if (!issuePublicId) throw new HttpError(400, 'validation_error', 'Please fix the highlighted fields', { issue: 'Invalid issue ID' });
  }
  res.status(201).json({ note: await createNote(req.auth.user.id, { ...data, issuePublicId }) });
});

// PUT /api/admin/notes/:noteId  { body, budget_amount? }  (null/empty budget clears it)
router.put('/notes/:noteId', async (req, res) => {
  const data = parse(noteSchema, req.body ?? {});
  res.json({ note: await updateNote(req.auth.user.id, req.noteId, data) });
});

// DELETE /api/admin/notes/:noteId
router.delete('/notes/:noteId', async (req, res) => {
  await deleteNote(req.auth.user.id, req.noteId);
  res.status(204).end();
});

// ---- Roster: which corporator / Mandal Adhyaksh covers each constituency. Mayor/admin only - a ----
// ---- Mandal Adhyaksh can see their own scoped dashboard above, but not manage anyone's roles.   ----

// GET /api/admin/roster - the constituency-first list the "Manage roles" screen is built around
router.get('/roster', requireMayor, async (req, res) => {
  res.json(await getRoster());
});

// POST /api/admin/roster/corporators  { ward_id, name, username }
router.post('/roster/corporators', requireMayor, async (req, res) => {
  const data = parse(rosterCorporatorSchema, req.body ?? {});
  res.status(201).json({ corporator: await createCorporator(data) });
});

// PUT /api/admin/roster/corporators/:id  { name, username } - edits the same account in place
router.put('/roster/corporators/:id', requireMayor, async (req, res) => {
  const data = parse(rosterEditPersonSchema, req.body ?? {});
  res.json({ corporator: await updateCorporator(req.params.id, data) });
});

// PUT /api/admin/roster/corporators/:id/deactivate
router.put('/roster/corporators/:id/deactivate', requireMayor, async (req, res) => {
  res.json({ corporator: await deactivateCorporator(req.params.id) });
});

// POST /api/admin/roster/mandal-adhyaksh  { name, username } - created unassigned; assign below
router.post('/roster/mandal-adhyaksh', requireMayor, async (req, res) => {
  const data = parse(rosterMandalAdhyakshSchema, req.body ?? {});
  res.status(201).json({ mandal_adhyaksh: await createMandalAdhyaksh(data) });
});

// PUT /api/admin/roster/mandal-adhyaksh/:id  { name, username } - edits the same account in place
router.put('/roster/mandal-adhyaksh/:id', requireMayor, async (req, res) => {
  const data = parse(rosterEditPersonSchema, req.body ?? {});
  res.json({ mandal_adhyaksh: await updateMandalAdhyaksh(req.params.id, data) });
});

// PUT /api/admin/roster/mandal-adhyaksh/:id/deactivate
router.put('/roster/mandal-adhyaksh/:id/deactivate', requireMayor, async (req, res) => {
  res.json({ mandal_adhyaksh: await deactivateMandalAdhyaksh(req.params.id) });
});

// PUT /api/admin/roster/wards/:wardId/mandal-adhyaksh  { admin_id: number|null }
router.put('/roster/wards/:wardId/mandal-adhyaksh', requireMayor, async (req, res) => {
  const wardId = Number(req.params.wardId);
  if (!Number.isInteger(wardId) || wardId < 1) throw new HttpError(404, 'not_found', 'Constituency not found');
  const { admin_id: adminId } = parse(rosterAssignSchema, req.body ?? {});
  res.json(await assignMandalAdhyaksh(wardId, adminId));
});

export default router;
