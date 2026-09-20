import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { getDashboard } from '../services/stats.js';

const router = Router();
router.use(requireRole('admin'));

// GET /api/admin/dashboard - totals, ward-wise counts, corporator performance
router.get('/dashboard', async (_req, res) => {
  res.json(await getDashboard());
});

export default router;
