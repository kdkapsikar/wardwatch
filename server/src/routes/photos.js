import { Router } from 'express';
import { query } from '../db/pool.js';
import { HttpError } from '../lib/httpError.js';

const NAME_RE = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;
const router = Router();

// GET /uploads/:name - photos are addressed by unguessable random names and are immutable.
router.get('/:name', async (req, res) => {
  if (!NAME_RE.test(req.params.name)) throw new HttpError(404, 'not_found', 'Not found');
  const { rows } = await query('SELECT content_type, data FROM photos WHERE name = $1', [req.params.name]);
  if (!rows[0]) throw new HttpError(404, 'not_found', 'Not found');
  res.set({
    'Content-Type': rows[0].content_type,
    'Cache-Control': 'public, max-age=31536000, immutable',
    // The web app may be served from a different origin than this API (e.g. GitHub Pages).
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  res.send(rows[0].data);
});

export default router;
