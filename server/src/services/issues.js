import { config } from '../config.js';
import { query, withTransaction } from '../db/pool.js';
import { HttpError } from '../lib/httpError.js';
import { generatePublicId } from '../lib/ids.js';
import { deriveTitle } from '../lib/title.js';
import { OPEN_STATUSES } from '../lib/constants.js';

export const PAGE_SIZE = 20;

/**
 * Citizen files an issue: assigns the ward's corporator and writes the first history row.
 * The caller has already validated the consent declaration, so consent_at is stamped here.
 */
export async function createIssue({
  ward_id, category, title, description, address, latitude, longitude, name, phone, photos,
}) {
  // `title` is optional: the report form doesn't collect one, so it is derived from the description.
  const headline = title || deriveTitle(description);
  return withTransaction(async (db) => {
    const ward = await db.query('SELECT id FROM wards WHERE id = $1', [ward_id]);
    if (!ward.rowCount) {
      throw new HttpError(400, 'validation_error', 'Please fix the highlighted fields', {
        ward_id: 'Select a valid constituency',
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
        [generatePublicId(), ward_id, corporator.rows[0]?.id ?? null, category, headline, description,
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
 *  - `staff: true` (mayor/admin): any issue, with the same private fields plus the assigned corporator.
 * Returns null if not found (or not visible to that corporator).
 */
export async function getIssue(publicId, { corporatorId, staff = false } = {}) {
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
            w.number AS ward_number, w.name AS ward_name,
            c.name AS assigned_name
       FROM issues i JOIN wards w ON w.id = i.ward_id
       LEFT JOIN corporators c ON c.id = i.corporator_id
      WHERE i.public_id = $1 ${scope}`,
    params,
  );
  const row = rows[0];
  if (!row) return null;

  const updates = await query(
    `SELECT u.status, u.remark, u.rejection_reason, u.photos, u.created_at, u.event,
            c.name AS corporator_name,
            fw.number AS from_number, fw.name AS from_name,
            tw.number AS to_number,   tw.name AS to_name
       FROM issue_updates u
       LEFT JOIN corporators c ON c.id  = u.corporator_id
       LEFT JOIN wards fw      ON fw.id = u.from_ward_id
       LEFT JOIN wards tw      ON tw.id = u.to_ward_id
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
      rejection_reason: u.rejection_reason,
      photos: u.photos,
      event: u.event,
      // Set on transfer events: which constituency the issue left and where it went.
      transfer: u.event === 'transfer'
        ? { from: { number: u.from_number, name: u.from_name }, to: { number: u.to_number, name: u.to_name } }
        : null,
      // null = filed by the citizen; otherwise the corporator's name (a public official).
      by: u.corporator_name,
      created_at: u.created_at,
    })),
  };
  if (corporatorId !== undefined || staff) {
    issue.citizen = { name: row.citizen_name, phone: row.citizen_phone };
    issue.assigned_to = row.assigned_name; // null = unassigned
    // Precise coordinates are for the assigned corporator only, like the contact details.
    issue.location = row.latitude === null ? null : { latitude: row.latitude, longitude: row.longitude };
  }
  return issue;
}

/**
 * Paged issue list with per-status counts for filter chips. Used by the corporator inbox
 * (scope.corporatorId) and by the mayor/admin issue list (no scope; optional scope.wardNumber).
 * Filters: status ('open' = submitted/acknowledged/in_progress), category, overdue (open + older than
 * OVERDUE_DAYS). The counts honour every filter except status, so chips always add up to the list.
 */
export async function listIssues({ corporatorId, wardNumber } = {}, { status, page, category, overdue }) {
  const params = [];
  const bind = (value) => {
    params.push(value);
    return `$${params.length}`;
  };
  const base = [];
  if (corporatorId !== undefined) base.push(`i.corporator_id = ${bind(corporatorId)}`);
  if (wardNumber !== undefined) base.push(`w.number = ${bind(wardNumber)}`);
  if (category) base.push(`i.category = ${bind(category)}`);
  if (overdue) {
    base.push(`i.status = ANY(${bind(OPEN_STATUSES)}) AND i.created_at < now() - make_interval(days => ${bind(config.overdueDays)})`);
  }
  const baseWhere = base.length ? base.join(' AND ') : 'TRUE';

  // Bind the status filter last so `params` (used by the counts query) can stay a prefix of `listParams`.
  const baseParams = [...params];
  let where = baseWhere;
  if (status === 'open') where += ` AND i.status = ANY(${bind(OPEN_STATUSES)})`;
  else if (status) where += ` AND i.status = ${bind(status)}`;
  const listParams = [...params];

  const from = `FROM issues i JOIN wards w ON w.id = i.ward_id LEFT JOIN corporators c ON c.id = i.corporator_id`;
  const [list, total, counts] = await Promise.all([
    query(
      `SELECT i.public_id, i.title, i.category, i.status, i.address, i.created_at, i.updated_at,
              w.number AS ward_number, w.name AS ward_name, c.name AS corporator_name
         ${from}
        WHERE ${where}
        ORDER BY (i.status IN ('resolved','rejected')), i.created_at DESC
        LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
      listParams,
    ),
    query(`SELECT count(*)::int AS n ${from} WHERE ${where}`, listParams),
    query(`SELECT i.status, count(*)::int AS n ${from} WHERE ${baseWhere} GROUP BY i.status`, baseParams),
  ]);

  return {
    issues: list.rows.map((r) => ({
      public_id: r.public_id,
      title: r.title,
      category: r.category,
      status: r.status,
      address: r.address,
      ward: { number: r.ward_number, name: r.ward_name },
      corporator_name: r.corporator_name, // null = unassigned
      created_at: r.created_at,
      updated_at: r.updated_at,
    })),
    total: total.rows[0].n,
    page,
    page_size: PAGE_SIZE,
    counts: Object.fromEntries(counts.rows.map((r) => [r.status, r.n])),
  };
}

/** Corporator's inbox: their own issues only. */
export const listCorporatorIssues = (corporatorId, filters) => listIssues({ corporatorId }, filters);

/**
 * Corporator posts an update (status change and/or remark and/or photos).
 *  - remark is always optional;
 *  - rejecting REQUIRES a rejection_reason (photos can be attached as proof).
 * Locks the issue row so two concurrent updates cannot interleave.
 */
export async function addUpdate(publicId, corporatorId, { status, remark, rejection_reason: reason, photos }) {
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

    let rejectionReason = null;
    if (changed && newStatus === 'rejected') {
      if (!reason) {
        throw new HttpError(400, 'validation_error', 'Please fix the highlighted fields', {
          rejection_reason: 'Enter the reason for rejecting this issue',
        });
      }
      if (reason.length < 5) {
        throw new HttpError(400, 'validation_error', 'Please fix the highlighted fields', {
          rejection_reason: 'The reason must be at least 5 characters',
        });
      }
      rejectionReason = reason;
    }

    await db.query(
      `INSERT INTO issue_updates (issue_id, corporator_id, status, remark, rejection_reason, photos)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [issue.id, corporatorId, newStatus, remark ?? null, rejectionReason, photos],
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

/** Constituencies (other than the corporator's own) that have an active corporator to receive a transfer. */
export async function listTransferTargets(corporatorId) {
  const { rows } = await query(
    `SELECT w.id, w.number, w.name
       FROM wards w
       JOIN corporators c ON c.ward_id = w.id AND c.is_active = true
      WHERE w.id <> (SELECT ward_id FROM corporators WHERE id = $1)
      ORDER BY w.number`,
    [corporatorId],
  );
  return rows;
}

/**
 * Move an open issue to another constituency. It goes to that constituency's corporator, restarts as
 * 'submitted' (so they see it as new), and the history records the transfer. The sender loses access.
 */
export async function transferIssue(publicId, corporatorId, { ward_id: targetWardId, note }) {
  return withTransaction(async (db) => {
    const { rows } = await db.query(
      'SELECT id, status, ward_id FROM issues WHERE public_id = $1 AND corporator_id = $2 FOR UPDATE',
      [publicId, corporatorId],
    );
    const issue = rows[0];
    if (!issue) throw new HttpError(404, 'not_found', 'Issue not found');

    if (!OPEN_STATUSES.includes(issue.status)) {
      throw new HttpError(400, 'not_transferable', 'Only open issues can be transferred');
    }
    if (targetWardId === issue.ward_id) {
      throw new HttpError(400, 'validation_error', 'Please fix the highlighted fields', {
        ward_id: 'Choose a different constituency',
      });
    }
    const target = (await db.query(
      `SELECT w.id, w.number, w.name, c.id AS corporator_id
         FROM wards w JOIN corporators c ON c.ward_id = w.id AND c.is_active = true
        WHERE w.id = $1`,
      [targetWardId],
    )).rows[0];
    if (!target) {
      throw new HttpError(400, 'validation_error', 'Please fix the highlighted fields', {
        ward_id: 'That constituency has no active corporator to receive the issue',
      });
    }

    await db.query(
      `UPDATE issues
          SET ward_id = $2, corporator_id = $3, status = 'submitted', resolved_at = NULL, updated_at = now()
        WHERE id = $1`,
      [issue.id, target.id, target.corporator_id],
    );
    await db.query(
      `INSERT INTO issue_updates (issue_id, corporator_id, status, remark, event, from_ward_id, to_ward_id)
       VALUES ($1, $2, 'submitted', $3, 'transfer', $4, $5)`,
      [issue.id, corporatorId, note ?? null, issue.ward_id, target.id],
    );
    return { number: target.number, name: target.name };
  });
}
