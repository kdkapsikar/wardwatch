-- 011_corporator_ward_unique_active.sql : the roster UI's flow for a constituency whose corporator
-- has been deactivated is "deactivate, then a create form reappears" (services/roster.js). That
-- needs more than one corporator ROW per constituency over time (history keeps its author - see
-- 001_init.sql's comment on corporators), so "one corporator per ward, ever" (a plain UNIQUE
-- constraint on ward_id) has to become "one ACTIVE corporator per ward at a time".
ALTER TABLE corporators DROP CONSTRAINT corporators_ward_id_key;
CREATE UNIQUE INDEX corporators_ward_id_active_key ON corporators (ward_id) WHERE is_active;
