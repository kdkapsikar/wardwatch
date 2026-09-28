-- 010_mandal_adhyaksh.sql : a second admin-level role, scoped to a set of constituencies instead of
-- the whole city. Reuses the `admins` table and its login/session/notes machinery rather than adding
-- a parallel table, since a Mandal Adhyaksh's dashboard is the mayor/admin dashboard, just filtered -
-- see server/src/services/stats.js and services/roster.js.
--
--   role         : 'admin' (the mayor's office, unchanged, sees every constituency) or
--                  'mandal_adhyaksh' (sees only the constituencies in admin_wards below).
--   admin_wards  : one constituency has at most one Mandal Adhyaksh (ward_id is the primary key);
--                  one Mandal Adhyaksh can cover many constituencies (admin_id is not unique).

ALTER TABLE admins ADD COLUMN role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'mandal_adhyaksh'));

CREATE TABLE admin_wards (
  ward_id  INTEGER PRIMARY KEY REFERENCES wards (id),
  admin_id INTEGER NOT NULL REFERENCES admins (id) ON DELETE CASCADE
);
CREATE INDEX admin_wards_admin_idx ON admin_wards (admin_id);
