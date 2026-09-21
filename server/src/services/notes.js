import { query } from '../db/pool.js';
import { HttpError } from '../lib/httpError.js';

// PRIVACY: every function takes the admin's id and puts `admin_id = $1` in the WHERE clause. That is
// the whole access-control story for notes - there is deliberately no query that reads across admins.

const SELECT = `
  SELECT n.id, n.body, n.budget_amount::float8 AS budget_amount, n.created_at, n.updated_at,
         i.public_id AS issue_public_id, i.title AS issue_title
    FROM admin_notes n LEFT JOIN issues i ON i.id = n.issue_id`;

const serialize = (r) => ({
  id: String(r.id),
  body: r.body,
  budget_amount: r.budget_amount,
  issue: r.issue_public_id ? { public_id: r.issue_public_id, title: r.issue_title } : null,
  created_at: r.created_at,
  updated_at: r.updated_at,
});

/** This admin's notes (newest first), optionally only those attached to one issue, plus their totals. */
export async function listNotes(adminId, { issuePublicId } = {}) {
  const params = [adminId];
  let filter = '';
  if (issuePublicId) {
    params.push(issuePublicId);
    filter = 'AND i.public_id = $2';
  }
  const [list, totals] = await Promise.all([
    query(`${SELECT} WHERE n.admin_id = $1 ${filter} ORDER BY n.created_at DESC, n.id DESC LIMIT 500`, params),
    query(
      `SELECT count(*)::int AS count, COALESCE(sum(n.budget_amount), 0)::float8 AS budget_total
         FROM admin_notes n LEFT JOIN issues i ON i.id = n.issue_id
        WHERE n.admin_id = $1 ${filter}`,
      params,
    ),
  ]);
  return { notes: list.rows.map(serialize), totals: totals.rows[0] };
}

/** Headline numbers for the dashboard card (all of this admin's notes). */
export async function notesSummary(adminId) {
  const { rows } = await query(
    `SELECT count(*)::int AS count,
            count(budget_amount)::int AS with_budget,
            COALESCE(sum(budget_amount), 0)::float8 AS budget_total
       FROM admin_notes WHERE admin_id = $1`,
    [adminId],
  );
  return rows[0];
}

async function getOwn(adminId, id) {
  const { rows } = await query(`${SELECT} WHERE n.admin_id = $1 AND n.id = $2`, [adminId, id]);
  return rows[0] ? serialize(rows[0]) : null;
}

export async function createNote(adminId, { body, budget_amount: budget, issuePublicId }) {
  let issueId = null;
  if (issuePublicId) {
    const found = await query('SELECT id FROM issues WHERE public_id = $1', [issuePublicId]);
    if (!found.rowCount) {
      throw new HttpError(400, 'validation_error', 'Please fix the highlighted fields', { issue: 'Issue not found' });
    }
    issueId = found.rows[0].id;
  }
  const { rows } = await query(
    'INSERT INTO admin_notes (admin_id, issue_id, body, budget_amount) VALUES ($1, $2, $3, $4) RETURNING id',
    [adminId, issueId, body, budget],
  );
  return getOwn(adminId, rows[0].id);
}

export async function updateNote(adminId, id, { body, budget_amount: budget }) {
  const { rowCount } = await query(
    `UPDATE admin_notes SET body = $3, budget_amount = $4, updated_at = now()
      WHERE id = $2 AND admin_id = $1`,
    [adminId, id, body, budget],
  );
  if (!rowCount) throw new HttpError(404, 'not_found', 'Note not found');
  return getOwn(adminId, id);
}

export async function deleteNote(adminId, id) {
  const { rowCount } = await query('DELETE FROM admin_notes WHERE id = $2 AND admin_id = $1', [adminId, id]);
  if (!rowCount) throw new HttpError(404, 'not_found', 'Note not found');
}
