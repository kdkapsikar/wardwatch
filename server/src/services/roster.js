// Two related but separate concerns:
//   - Accounts: WHO exists - corporators and admins (Mayor/Admin or Mandal Adhyaksh), each with a
//     first/last name, a username and a role. Managed on the Accounts page (list/create/edit/deactivate).
//   - Roster: WHICH constituency each corporator/Mandal Adhyaksh currently covers. Managed on Manage
//     roles, which only ever picks an *existing* account (from Accounts) for a constituency - it does
//     not create people itself.
// Both are Mayor/Admin only - see the requireMayor guard in routes/admin.js.
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db/pool.js';
import { HttpError } from '../lib/httpError.js';
import { BCRYPT_ROUNDS } from '../lib/constants.js';

// PLACEHOLDER passwords, same spirit as the rest of the app's default accounts (see README) - simple
// for now, a security layer (forced reset, admin-set passwords) can come later. Deliberately no
// default for 'admin': that role is not self-service creatable here (see createAccount).
const DEFAULT_PASSWORD = { corporator: 'corporator123', mandal_adhyaksh: 'mandal12345' };

/** "Asha" + "Patil" -> "Asha Patil"; "Asha" + "" -> "Asha". Kept in sync into the `name` column on
 *  every write so every OTHER query in the app (issue "assigned to", update history "by", dashboards,
 *  notes author) can keep reading one plain name without knowing about first/last at all. */
const fullName = (firstName, lastName) => [firstName, lastName].filter(Boolean).join(' ').trim();

async function usernameTaken(username) {
  const { rows } = await query(
    `SELECT 1 FROM corporators WHERE lower(username) = lower($1)
     UNION SELECT 1 FROM admins WHERE lower(username) = lower($1)`,
    [username],
  );
  return rows.length > 0;
}

function usernameTakenError() {
  return new HttpError(400, 'validation_error', 'Please fix the highlighted fields', { username: 'That username is already taken' });
}

// ---------------------------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------------------------

/** Every account in the system, whatever role it holds - the Accounts page's list. */
export async function listAccounts() {
  const [corps, admins] = await Promise.all([
    query(
      `SELECT c.id, c.first_name, c.last_name, c.username, c.is_active,
              w.id AS ward_id, w.number AS ward_number, w.name AS ward_name, w.name_mr AS ward_name_mr
         FROM corporators c
         LEFT JOIN wards w ON w.id = c.ward_id
        ORDER BY c.first_name, c.last_name, c.id`,
    ),
    query(
      `SELECT a.id, a.first_name, a.last_name, a.username, a.is_active, a.role,
              count(aw.ward_id)::int AS ward_count
         FROM admins a
         LEFT JOIN admin_wards aw ON aw.admin_id = a.id
        GROUP BY a.id
        ORDER BY (a.role = 'admin') DESC, a.first_name, a.last_name, a.id`,
    ),
  ]);
  const accounts = [
    ...corps.rows.map((r) => ({
      id: r.id,
      role: 'corporator',
      first_name: r.first_name,
      last_name: r.last_name,
      username: r.username,
      is_active: r.is_active,
      ward: r.ward_id ? { id: r.ward_id, number: r.ward_number, name: r.ward_name, name_mr: r.ward_name_mr } : null,
    })),
    ...admins.rows.map((r) => ({
      id: r.id,
      role: r.role,
      first_name: r.first_name,
      last_name: r.last_name,
      username: r.username,
      is_active: r.is_active,
      ward_count: r.role === 'mandal_adhyaksh' ? r.ward_count : undefined,
    })),
  ];
  return { accounts };
}

/** Creates a corporator or Mandal Adhyaksh account, not yet assigned to any constituency - assign it
 *  from Manage roles afterwards. Admin accounts are not self-service creatable here (see the README's
 *  Known limitations) - use `npm run user:create`. */
export async function createAccount({ role, first_name: firstName, last_name: lastName, username }) {
  if (await usernameTaken(username)) throw usernameTakenError();
  const name = fullName(firstName, lastName);
  const hash = await bcrypt.hash(DEFAULT_PASSWORD[role], BCRYPT_ROUNDS);

  if (role === 'corporator') {
    const { rows } = await query(
      `INSERT INTO corporators (ward_id, first_name, last_name, name, username, password_hash)
       VALUES (NULL, $1, $2, $3, $4, $5)
       RETURNING id, first_name, last_name, username, is_active`,
      [firstName, lastName, name, username, hash],
    );
    return { ...rows[0], role: 'corporator', ward: null };
  }
  const { rows } = await query(
    `INSERT INTO admins (first_name, last_name, name, username, password_hash, role)
     VALUES ($1, $2, $3, $4, $5, 'mandal_adhyaksh')
     RETURNING id, first_name, last_name, username, is_active`,
    [firstName, lastName, name, username, hash],
  );
  return { ...rows[0], role: 'mandal_adhyaksh', ward_count: 0 };
}

/** Edits an existing account's own name/username in place - the same account and history, not a
 *  replacement. Works for any role, including renaming the Mayor/Admin's own account. */
export async function updateAccount(role, id, { first_name: firstName, last_name: lastName, username }) {
  const name = fullName(firstName, lastName);
  const table = role === 'corporator' ? 'corporators' : 'admins';
  const roleFilter = role === 'corporator' ? '' : ' AND role = $2';
  const params = role === 'corporator' ? [id] : [id, role];

  const existing = await query(`SELECT username FROM ${table} WHERE id = $1${roleFilter}`, params);
  if (!existing.rowCount) {
    throw new HttpError(404, 'not_found', role === 'mandal_adhyaksh' ? 'Mandal Adhyaksh not found' : role === 'admin' ? 'Admin not found' : 'Corporator not found');
  }
  if (existing.rows[0].username.toLowerCase() !== username.toLowerCase() && (await usernameTaken(username))) {
    throw usernameTakenError();
  }
  const { rows } = await query(
    `UPDATE ${table} SET first_name = $1, last_name = $2, name = $3, username = $4 WHERE id = $5${role === 'corporator' ? '' : ' AND role = $6'}
     RETURNING id, first_name, last_name, username, is_active`,
    role === 'corporator' ? [firstName, lastName, name, username, id] : [firstName, lastName, name, username, id, role],
  );
  return { ...rows[0], role };
}

/** Deactivates a corporator or Mandal Adhyaksh account (blocks login, ends live sessions). Admin
 *  accounts cannot be deactivated here - see the README's Known limitations. */
export async function deactivateAccount(role, id) {
  if (role === 'corporator') {
    const { rows } = await query('UPDATE corporators SET is_active = false WHERE id = $1 RETURNING id, first_name, last_name, username, is_active', [id]);
    if (!rows[0]) throw new HttpError(404, 'not_found', 'Corporator not found');
    return { ...rows[0], role: 'corporator' };
  }
  if (role === 'mandal_adhyaksh') {
    const { rows } = await query(
      `UPDATE admins SET is_active = false WHERE id = $1 AND role = 'mandal_adhyaksh' RETURNING id, first_name, last_name, username, is_active`,
      [id],
    );
    if (!rows[0]) throw new HttpError(404, 'not_found', 'Mandal Adhyaksh not found');
    return { ...rows[0], role: 'mandal_adhyaksh' };
  }
  throw new HttpError(400, 'validation_error', 'Please fix the highlighted fields', { role: 'Admin accounts cannot be deactivated here' });
}

// ---------------------------------------------------------------------------------------------
// Roster: which constituency each corporator/Mandal Adhyaksh covers
// ---------------------------------------------------------------------------------------------

/** The constituency-first picture Manage roles is built around: every constituency with its current
 *  corporator and current Mandal Adhyaksh (either may be null). Who can be *picked* for either slot
 *  comes from listAccounts(), not from here. */
export async function getRoster() {
  const { rows } = await query(
    `SELECT w.id, w.number, w.name, w.name_mr,
            c.id AS corporator_id, c.first_name AS corporator_first_name, c.last_name AS corporator_last_name, c.username AS corporator_username,
            ma.id AS mandal_adhyaksh_id, ma.first_name AS mandal_first_name, ma.last_name AS mandal_last_name, ma.username AS mandal_adhyaksh_username
       FROM wards w
       LEFT JOIN corporators c  ON c.ward_id = w.id AND c.is_active = true
       LEFT JOIN admin_wards aw ON aw.ward_id = w.id
       LEFT JOIN admins ma      ON ma.id = aw.admin_id
      ORDER BY w.number`,
  );
  return {
    wards: rows.map((r) => ({
      id: r.id,
      number: r.number,
      name: r.name,
      name_mr: r.name_mr,
      corporator: r.corporator_id
        ? { id: r.corporator_id, name: fullName(r.corporator_first_name, r.corporator_last_name), username: r.corporator_username }
        : null,
      mandal_adhyaksh: r.mandal_adhyaksh_id
        ? { id: r.mandal_adhyaksh_id, name: fullName(r.mandal_first_name, r.mandal_last_name), username: r.mandal_adhyaksh_username }
        : null,
    })),
  };
}

/**
 * Assigns (or, with `corporatorId` null, clears) which corporator covers one constituency. Exactly one
 * active corporator per constituency: assigning someone new moves them here from wherever they were
 * (if anywhere) and frees whoever covered this constituency before them.
 */
export async function assignCorporator(wardId, corporatorId) {
  return withTransaction(async (db) => {
    const ward = await db.query('SELECT id, number, name, name_mr FROM wards WHERE id = $1', [wardId]);
    if (!ward.rowCount) throw new HttpError(404, 'not_found', 'Constituency not found');

    if (corporatorId === null) {
      await db.query('UPDATE corporators SET ward_id = NULL WHERE ward_id = $1', [wardId]);
      return { ward: ward.rows[0], corporator: null };
    }

    const corp = await db.query('SELECT id, first_name, last_name, username FROM corporators WHERE id = $1 AND is_active = true', [corporatorId]);
    if (!corp.rowCount) {
      throw new HttpError(400, 'validation_error', 'Please fix the highlighted fields', { corporator_id: 'Choose a valid corporator' });
    }
    // Free this constituency's current corporator (if it is someone else), then move the chosen one in.
    await db.query('UPDATE corporators SET ward_id = NULL WHERE ward_id = $1 AND id <> $2', [wardId, corporatorId]);
    await db.query('UPDATE corporators SET ward_id = $1 WHERE id = $2', [wardId, corporatorId]);
    return { ward: ward.rows[0], corporator: { id: corp.rows[0].id, name: fullName(corp.rows[0].first_name, corp.rows[0].last_name), username: corp.rows[0].username } };
  });
}

/**
 * Assigns (or, with `adminId` null, clears) which Mandal Adhyaksh covers one constituency. One
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
      `SELECT id, first_name, last_name, username FROM admins WHERE id = $1 AND role = 'mandal_adhyaksh' AND is_active = true`,
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
    return { ward: ward.rows[0], mandal_adhyaksh: { id: admin.rows[0].id, name: fullName(admin.rows[0].first_name, admin.rows[0].last_name), username: admin.rows[0].username } };
  });
}
