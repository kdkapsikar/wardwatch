// Manages who covers each constituency: the corporator (one per constituency, unchanged) and the
// Mandal Adhyaksh (a party-organisation role, scoped to one or more constituencies). Mayor/admin
// only - see the requireMayor guard in routes/admin.js.
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db/pool.js';
import { HttpError } from '../lib/httpError.js';
import { BCRYPT_ROUNDS } from '../lib/constants.js';

// PLACEHOLDER passwords, same spirit as the rest of the app's default accounts (see README) - simple
// for now, a security layer (forced reset, admin-set passwords) can come later.
const DEFAULT_CORPORATOR_PASSWORD = 'corporator123';
const DEFAULT_MANDAL_ADHYAKSH_PASSWORD = 'mandal12345';

async function usernameTaken(username) {
  const { rows } = await query(
    `SELECT 1 FROM corporators WHERE lower(username) = lower($1)
     UNION SELECT 1 FROM admins WHERE lower(username) = lower($1)`,
    [username],
  );
  return rows.length > 0;
}

/**
 * The constituency-first picture the "Manage roles" screen needs: every constituency with its
 * current corporator and current Mandal Adhyaksh (either may be null), plus the full roster of
 * existing Mandal Adhyaksh accounts to populate the assignment dropdown (prepopulated, per the brief).
 */
export async function getRoster() {
  const [wards, mandalAdhyakshList] = await Promise.all([
    query(
      `SELECT w.id, w.number, w.name, w.name_mr,
              c.id AS corporator_id, c.name AS corporator_name, c.username AS corporator_username, c.is_active AS corporator_active,
              ma.id AS mandal_adhyaksh_id, ma.name AS mandal_adhyaksh_name, ma.username AS mandal_adhyaksh_username
         FROM wards w
         LEFT JOIN corporators c  ON c.ward_id = w.id
         LEFT JOIN admin_wards aw ON aw.ward_id = w.id
         LEFT JOIN admins ma      ON ma.id = aw.admin_id
        ORDER BY w.number`,
    ),
    query(
      `SELECT a.id, a.name, a.username, a.is_active, count(aw.ward_id)::int AS ward_count
         FROM admins a
         LEFT JOIN admin_wards aw ON aw.admin_id = a.id
        WHERE a.role = 'mandal_adhyaksh'
        GROUP BY a.id
        ORDER BY a.name`,
    ),
  ]);

  return {
    wards: wards.rows.map((r) => ({
      id: r.id,
      number: r.number,
      name: r.name,
      name_mr: r.name_mr,
      corporator: r.corporator_id
        ? { id: r.corporator_id, name: r.corporator_name, username: r.corporator_username, is_active: r.corporator_active }
        : null,
      mandal_adhyaksh: r.mandal_adhyaksh_id
        ? { id: r.mandal_adhyaksh_id, name: r.mandal_adhyaksh_name, username: r.mandal_adhyaksh_username }
        : null,
    })),
    mandal_adhyaksh_list: mandalAdhyakshList.rows,
  };
}

/** Creates the corporator for a constituency that doesn't already have an active one. */
export async function createCorporator({ ward_id: wardId, name, username }) {
  const ward = await query('SELECT id FROM wards WHERE id = $1', [wardId]);
  if (!ward.rowCount) {
    throw new HttpError(400, 'validation_error', 'Please fix the highlighted fields', { ward_id: 'Select a valid constituency' });
  }
  const existing = await query('SELECT id FROM corporators WHERE ward_id = $1 AND is_active = true', [wardId]);
  if (existing.rowCount) {
    throw new HttpError(400, 'validation_error', 'Please fix the highlighted fields', {
      ward_id: 'This constituency already has a corporator - deactivate them first',
    });
  }
  if (await usernameTaken(username)) {
    throw new HttpError(400, 'validation_error', 'Please fix the highlighted fields', { username: 'That username is already taken' });
  }

  const hash = await bcrypt.hash(DEFAULT_CORPORATOR_PASSWORD, BCRYPT_ROUNDS);
  const { rows } = await query(
    `INSERT INTO corporators (ward_id, name, username, password_hash) VALUES ($1, $2, $3, $4)
     RETURNING id, name, username, is_active`,
    [wardId, name, username, hash],
  );
  return rows[0];
}

/** Edits an existing corporator's own name/username - the same account and history, not a replacement. */
export async function updateCorporator(id, { name, username }) {
  const existing = await query('SELECT id, username FROM corporators WHERE id = $1', [id]);
  if (!existing.rowCount) throw new HttpError(404, 'not_found', 'Corporator not found');
  if (existing.rows[0].username.toLowerCase() !== username.toLowerCase() && (await usernameTaken(username))) {
    throw new HttpError(400, 'validation_error', 'Please fix the highlighted fields', { username: 'That username is already taken' });
  }
  const { rows } = await query(
    'UPDATE corporators SET name = $2, username = $3 WHERE id = $1 RETURNING id, name, username, is_active',
    [id, name, username],
  );
  return rows[0];
}

export async function deactivateCorporator(id) {
  const { rows } = await query(
    'UPDATE corporators SET is_active = false WHERE id = $1 RETURNING id, name, username, is_active',
    [id],
  );
  if (!rows[0]) throw new HttpError(404, 'not_found', 'Corporator not found');
  return rows[0];
}

/** Creates a new Mandal Adhyaksh account, not yet assigned to any constituency. */
export async function createMandalAdhyaksh({ name, username }) {
  if (await usernameTaken(username)) {
    throw new HttpError(400, 'validation_error', 'Please fix the highlighted fields', { username: 'That username is already taken' });
  }
  const hash = await bcrypt.hash(DEFAULT_MANDAL_ADHYAKSH_PASSWORD, BCRYPT_ROUNDS);
  const { rows } = await query(
    `INSERT INTO admins (name, username, password_hash, role) VALUES ($1, $2, $3, 'mandal_adhyaksh')
     RETURNING id, name, username, is_active`,
    [name, username, hash],
  );
  return { ...rows[0], ward_count: 0 };
}

/** Edits an existing Mandal Adhyaksh's own name/username - their constituency assignments are untouched. */
export async function updateMandalAdhyaksh(id, { name, username }) {
  const existing = await query(`SELECT id, username FROM admins WHERE id = $1 AND role = 'mandal_adhyaksh'`, [id]);
  if (!existing.rowCount) throw new HttpError(404, 'not_found', 'Mandal Adhyaksh not found');
  if (existing.rows[0].username.toLowerCase() !== username.toLowerCase() && (await usernameTaken(username))) {
    throw new HttpError(400, 'validation_error', 'Please fix the highlighted fields', { username: 'That username is already taken' });
  }
  const { rows } = await query(
    'UPDATE admins SET name = $2, username = $3 WHERE id = $1 RETURNING id, name, username, is_active',
    [id, name, username],
  );
  return rows[0];
}

export async function deactivateMandalAdhyaksh(id) {
  const { rows } = await query(
    `UPDATE admins SET is_active = false WHERE id = $1 AND role = 'mandal_adhyaksh' RETURNING id, name, username, is_active`,
    [id],
  );
  if (!rows[0]) throw new HttpError(404, 'not_found', 'Mandal Adhyaksh not found');
  return rows[0];
}

/**
 * Assigns (or, with adminId null, clears) which Mandal Adhyaksh covers one constituency. One
 * constituency has at most one Mandal Adhyaksh; the same Mandal Adhyaksh can be assigned to many
 * constituencies by calling this once per constituency.
 */
export async function assignMandalAdhyaksh(wardId, adminId) {
  return withTransaction(async (db) => {
    const ward = await db.query('SELECT id, number, name, name_mr FROM wards WHERE id = $1', [wardId]);
    if (!ward.rowCount) throw new HttpError(404, 'not_found', 'Constituency not found');

    if (adminId === null) {
      await db.query('DELETE FROM admin_wards WHERE ward_id = $1', [wardId]);
      return { ward: ward.rows[0], mandal_adhyaksh: null };
    }

    const admin = await db.query(
      `SELECT id, name, username FROM admins WHERE id = $1 AND role = 'mandal_adhyaksh' AND is_active = true`,
      [adminId],
    );
    if (!admin.rowCount) {
      throw new HttpError(400, 'validation_error', 'Please fix the highlighted fields', { admin_id: 'Choose a valid Mandal Adhyaksh' });
    }

    await db.query(
      `INSERT INTO admin_wards (ward_id, admin_id) VALUES ($1, $2)
       ON CONFLICT (ward_id) DO UPDATE SET admin_id = EXCLUDED.admin_id`,
      [wardId, adminId],
    );
    return { ward: ward.rows[0], mandal_adhyaksh: admin.rows[0] };
  });
}
