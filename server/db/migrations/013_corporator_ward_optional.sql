-- 013_corporator_ward_optional.sql : corporator accounts are now created on the Accounts page,
-- independent of any constituency, and assigned to one afterwards on Manage roles (same shape as a
-- Mandal Adhyaksh's admin_wards - see services/roster.js's assignCorporator). A freshly created or
-- just-unassigned corporator has no constituency yet, so ward_id must allow NULL.
ALTER TABLE corporators ALTER COLUMN ward_id DROP NOT NULL;
