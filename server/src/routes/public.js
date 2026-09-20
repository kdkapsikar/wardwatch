import { Router } from 'express';
import { query } from '../db/pool.js';
import { HttpError } from '../lib/httpError.js';
import { normalizePublicId } from '../lib/ids.js';
import { parse, issueSchema } from '../lib/validation.js';
import { removeImages, saveImages } from '../lib/files.js';
import { photosUpload } from '../middleware/upload.js';
import { lookupLimiter, submitLimiter } from '../middleware/rateLimit.js';
import { createIssue, getIssue } from '../services/issues.js';

const router = Router();

// GET /api/wards - populates the ward dropdown
router.get('/wards', async (_req, res) => {
  const { rows } = await query('SELECT id, number, name FROM wards ORDER BY number');
  res.json({ wards: rows });
});

// POST /api/issues - citizen submits a concern (multipart/form-data, no login)
router.post('/issues', submitLimiter, photosUpload, async (req, res) => {
  const data = parse(issueSchema, req.body ?? {});
  const photos = await saveImages(req.files);
  try {
    const issue = await createIssue({ ...data, photos });
    res.status(201).json({ issue_id: issue.public_id, created_at: issue.created_at });
  } catch (err) {
    await removeImages(photos);
    throw err;
  }
});

// GET /api/issues/:publicId - public status + update history (no contact details)
router.get('/issues/:publicId', lookupLimiter, async (req, res) => {
  const publicId = normalizePublicId(req.params.publicId);
  const issue = publicId && (await getIssue(publicId));
  if (!issue) throw new HttpError(404, 'not_found', 'No issue found with that ID');
  res.json({ issue });
});

export default router;
