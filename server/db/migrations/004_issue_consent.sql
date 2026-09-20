-- 004_issue_consent.sql : when the citizen ticked "I confirm the information is accurate and may be
-- used by the local administration for issue resolution". Set by the API on every new submission
-- (the API refuses submissions without consent); NULL only for issues filed before this migration.

ALTER TABLE issues ADD COLUMN consent_at TIMESTAMPTZ;
