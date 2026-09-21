import { Router } from 'express';
import { HttpError } from '../lib/httpError.js';
import { normalizePublicId } from '../lib/ids.js';
import { adminListQuerySchema, noteSchema, parse } from '../lib/validation.js';
import { requireRole } from '../middleware/auth.js';
import { getIssue, listIssues } from '../services/issues.js';
import { createNote, deleteNote, listNotes, updateNote } from '../services/notes.js';
import { getDashboard } from '../services/stats.js';

const router = Router();
router.use(requireRole('admin'));

// GET /api/admin/dashboard - totals, constituency-wise counts, category split, corporator performance
router.get('/dashboard', async (req, res) => {
  res.json(await getDashboard(req.auth.user.id));
});

// GET /api/admin/issues?status=&category=&ward=<number>&overdue=1&page= - city-wide issue list (drill-down target)
router.get('/issues', async (req, res) => {
  const { ward, ...filters } = parse(adminListQuerySchema, req.query);
  res.json(await listIssues({ wardNumber: ward }, filters));
});

// GET /api/admin/issues/:publicId - the full record (read-only), incl. citizen contact and location
router.get('/issues/:publicId', async (req, res) => {
  const publicId = normalizePublicId(req.params.publicId);
  const issue = publicId && (await getIssue(publicId, { staff: true }));
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

export default router;
