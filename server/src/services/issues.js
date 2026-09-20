import { query, withTransaction } from '../db/pool.js';
import { HttpError } from '../lib/httpError.js';
import { generatePublicId } from '../lib/ids.js';
import { CLOSING_STATUSES, OPEN_STATUSES } from '../lib/constants.js';

export const PAGE_SIZE = 20;

/**
 * Citizen files an issue: assigns the ward's corporator and writes the first history row.
 * The caller has already validated the consent declaration, so consent_at is stamped here.
 */
export async function createIssue({
  ward_id, category, title, description, address, latitude, longitude, name, phone, photos,
}) {
  return withTransaction(async (db) => {
    const ward = await db.query('SELECT id FROM wards WHERE id = $1', [ward_id]);
    if (!ward.rowCount) {
      throw new HttpError(400, 'validation_error', 'Please fix the highlighted fields', {
        ward_id: 'Select a valid ward',
      });
    }
    const corporator = await db.query(
      'SELECT id FROM corporators WHERE ward_id = $1 AND is_active = true',
      [ward_id],
    );

    // ON CONFLICT DO NOTHING lets us retry a (very unlikely) ID collision
    // without aborting the transaction.
    let issue;
    for (let attempt = 0; attempt < 5 && !issue; attempt += 1) {
      const result = await db.query(
        `INSERT INTO issues
           (public_id, ward_id, corporator_id, category, title, description, address,
            citizen_name, citizen_phone, photos, latitude, longitude, consent_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())
         ON CONFLICT (public_id) DO NOTHING
         RETURNING id, public_id, created_at`,
        [generatePublicId(), ward_id, corporator.rows[0]?.id ?? null, category, title, description,
         address ?? null, name, phone, photos, latitude ?? null, longitude ?? null],
      );
      issue = result.rows[0];
    }
    if (!issue) throw new Error('Could not allocate a unique issue ID');

    await db.query(
      `INSERT INTO issue_updates (issue_id, status, remark) VALUES ($1, 'submitted', 'Issue received')`,
      [issue.id],
    );
    return { public_id: issue.public_id, created_at: issue.created_at };
  });
}

/**
 * Load one issue with its update history.
 *  - public view (default): no citizen contact details.
 *  - `corporatorId`: restricts to that corporator's issues and includes contact details + coordinates.
 * Returns null if not found (or not visible to that corporator).
 */
export async function getIssue(publicId, { corporatorId } = {}) {
  const params = [publicId];
  let scope = '';
  if (corporatorId !== undefined) {
    params.push(corporatorId);
    scope = 'AND i.corporator_id = $2';
  }
  const { rows } = await query(
    `SELECT i.id, i.public_id, i.category, i.title, i.description, i.address, i.status, i.photos,
            i.created_at, i.updated_at, i.resolved_at, i.citizen_name, i.citizen_phone,
            i.latitude, i.longitude,
            w.number AS ward_number, w.name AS ward_name
       FROM issues i JOIN wards w ON w.id = i.ward_id
      WHERE i.public_id = $1 ${scope}`,
    params,
  );
  const row = rows[0];
  if (!row) return null;

  const updates = await query(
    `SELECT u.status, u.remark, u.photos, u.created_at, c.name AS corporator_name
       FROM issue_updates u LEFT JOIN corporators c ON c.id = u.corporator_id
      WHERE u.issue_id = $1
      ORDER BY u.created_at, u.id`,
    [row.id],
  );

  const issue = {
    public_id: row.public_id,
    category: row.category,
    title: row.title,
    description: row.description,
    address: row.address,
    status: row.status,
    photos: row.photos,
    ward: { number: row.ward_number, name: row.ward_name },
    created_at: row.created_at,
    updated_at: row.updated_at,
    resolved_at: row.resolved_at,
    updates: updates.rows.map((u) => ({
      status: u.status,
      remark: u.remark,
      photos: u.photos,
      // null = filed by the citizen; otherwise the corporator's name (a public official).
      by: u.corporator_name,
      created_at: u.created_at,
    })),
  };
  if (corporatorId !== undefined) {
    issue.citizen = { name: row.citizen_name, phone: row.citizen_phone };
    // Precise coordinates are for the assigned corporator only, like the contact details.
    issue.location = row.latitude === null ? null : { latitude: row.latitude, longitude: row.longitude };
  }
  return issue;
}

/** Corporator's inbox: paged list plus per-status counts for the filter tabs. */
export async function listCorporatorIssues(corporatorId, { status, page }) {
  const filters = ['corporator_id = $1'];
  const params = [corporatorId];
  if (status === 'open') {
    params.push(OPEN_STATUSES);
    filters.push(`status = ANY($${params.length})`);
  } else if (status) {
    params.push(status);
    filters.push(`status = $${params.length}`);
  }
  const where = filters.join(' AND ');

  const [list, total, counts] = await Promise.all([
    query(
      `SELECT i.public_id, i.title, i.category, i.status, i.address, i.created_at, i.updated_at,
              w.number AS ward_number, w.name AS ward_name
         FROM issues i JOIN wards w ON w.id = i.ward_id
        WHERE ${where}
        ORDER BY (i.status IN ('resolved','rejected')), i.created_at DESC
        LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
      params,
    ),
    query(`SELECT count(*)::int AS n FROM issues WHERE ${where}`, params),
    query(
      'SELECT status, count(*)::int AS n FROM issues WHERE corporator_id = $1 GROUP BY status',
      [corporatorId],
    ),
  ]);

  const byStatus = Object.fromEntries(counts.rows.map((r) => [r.status, r.n]));
  return {
    issues: list.rows.map((r) => ({
      public_id: r.public_id,
      title: r.title,
      category: r.category,
      status: r.status,
      address: r.address,
      ward: { number: r.ward_number, name: r.ward_name },
      created_at: r.created_at,
      updated_at: r.updated_at,
    })),
    total: total.rows[0].n,
    page,
    page_size: PAGE_SIZE,
    counts: byStatus,
  };
}

/**
 * Corporator posts an update (status change and/or remark and/or photos).
 * Locks the issue row so two concurrent updates cannot interleave.
 */
export async function addUpdate(publicId, corporatorId, { status, remark, photos }) {
  await withTransaction(async (db) => {
    const { rows } = await db.query(
      'SELECT id, status FROM issues WHERE public_id = $1 AND corporator_id = $2 FOR UPDATE',
      [publicId, corporatorId],
    );
    const issue = rows[0];
    if (!issue) throw new HttpError(404, 'not_found', 'Issue not found');

    const newStatus = status ?? issue.status;
    const changed = newStatus !== issue.status;
    if (!changed && !remark && photos.length === 0) {
      throw new HttpError(400, 'validation_error', 'Nothing to update', {
        remark: 'Change the status, or add a remark or photo',
      });
    }
    // A repeated remark on an already-closed issue is fine, but closing needs an explanation.
    if (changed && CLOSING_STATUSES.includes(newStatus) && !remark) {
      throw new HttpError(400, 'validation_error', 'Please fix the highlighted fields', {
        remark: 'Add a remark explaining the outcome',
      });
    }

    await db.query(
      `INSERT INTO issue_updates (issue_id, corporator_id, status, remark, photos)
       VALUES ($1, $2, $3, $4, $5)`,
      [issue.id, corporatorId, newStatus, remark ?? null, photos],
    );
    await db.query(
      `UPDATE issues
          SET status = $2::text,
              updated_at = now(),
              resolved_at = CASE WHEN $2::text = 'resolved' THEN COALESCE(resolved_at, now()) ELSE NULL END
        WHERE id = $1`,
      [issue.id, newStatus],
    );
  });
  return getIssue(publicId, { corporatorId });
}
