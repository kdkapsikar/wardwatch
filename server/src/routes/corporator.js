import { Router } from 'express';
import { HttpError } from '../lib/httpError.js';
import { normalizePublicId } from '../lib/ids.js';
import { parse, updateSchema, listQuerySchema } from '../lib/validation.js';
import { removeImages, saveImages } from '../lib/files.js';
import { requireRole } from '../middleware/auth.js';
import { photosUpload } from '../middleware/upload.js';
import { addUpdate, getIssue, listCorporatorIssues } from '../services/issues.js';

const router = Router();
router.use(requireRole('corporator'));

// GET /api/corporator/issues?status=open|submitted|...&page=1
router.get('/issues', async (req, res) => {
  const { status, page } = parse(listQuerySchema, req.query);
  res.json(await listCorporatorIssues(req.auth.user.id, { status, page }));
});

// The :publicId param is validated once for every route below.
router.param('publicId', (req, _res, next, value) => {
  req.publicId = normalizePublicId(value);
  if (!req.publicId) return next(new HttpError(404, 'not_found', 'Issue not found'));
  return next();
});

// GET /api/corporator/issues/:publicId - full detail incl. citizen contact
router.get('/issues/:publicId', async (req, res) => {
  const issue = await getIssue(req.publicId, { corporatorId: req.auth.user.id });
  if (!issue) throw new HttpError(404, 'not_found', 'Issue not found');
  res.json({ issue });
});

// POST /api/corporator/issues/:publicId/updates - status / remark / photos (multipart)
router.post('/issues/:publicId/updates', photosUpload, async (req, res) => {
  const data = parse(updateSchema, req.body ?? {});
  const photos = await saveImages(req.files);
  try {
    const issue = await addUpdate(req.publicId, req.auth.user.id, { ...data, photos });
    res.status(201).json({ issue });
  } catch (err) {
    await removeImages(photos);
    throw err;
  }
});

export default router;
