-- 012_account_first_last_name.sql : the new Accounts page (services/roster.js) edits a first name and
-- a last name as two separate fields, so corporators and admins each get real first_name/last_name
-- columns. `name` stays - it is what every other query in the app already selects (issue "assigned
-- to", update history "by", dashboards, notes author) - and becomes a denormalised "first + last"
-- convenience the application keeps in sync on every write (createAccount/updateAccount in
-- services/roster.js, and scripts/create-user.js), so none of that existing SQL has to change.
--
-- Backfill splits the existing single `name` at its LAST space: "Asha Patil" -> "Asha" / "Patil"; a
-- one-word name (no space) becomes first_name = the whole thing, last_name = ''.

ALTER TABLE corporators ADD COLUMN first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE corporators ADD COLUMN last_name  TEXT NOT NULL DEFAULT '';
ALTER TABLE admins      ADD COLUMN first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE admins      ADD COLUMN last_name  TEXT NOT NULL DEFAULT '';

UPDATE corporators SET
  first_name = CASE WHEN position(' ' in reverse(name)) = 0 THEN name
                     ELSE left(name, length(name) - position(' ' in reverse(name))) END,
  last_name  = CASE WHEN position(' ' in reverse(name)) = 0 THEN ''
                     ELSE right(name, position(' ' in reverse(name)) - 1) END;

UPDATE admins SET
  first_name = CASE WHEN position(' ' in reverse(name)) = 0 THEN name
                     ELSE left(name, length(name) - position(' ' in reverse(name))) END,
  last_name  = CASE WHEN position(' ' in reverse(name)) = 0 THEN ''
                     ELSE right(name, position(' ' in reverse(name)) - 1) END;
