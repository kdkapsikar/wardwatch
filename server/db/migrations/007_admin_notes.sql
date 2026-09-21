-- 007_admin_notes.sql : private notes (with an optional budget amount) for mayor/admin accounts.
-- Every row belongs to ONE admin; every query in the API filters on admin_id from the session, so a
-- note is invisible to every other user - other admins, corporators and the public alike.
-- A note is either attached to an issue or general (issue_id NULL). Deleting an issue keeps the note.

CREATE TABLE admin_notes (
  id             BIGSERIAL PRIMARY KEY,
  admin_id       INTEGER NOT NULL REFERENCES admins (id) ON DELETE CASCADE,
  issue_id       BIGINT  REFERENCES issues (id) ON DELETE SET NULL,
  body           TEXT    NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  -- Rupees. NULL = "no amount noted". Up to 999,999,999,999.99.
  budget_amount  NUMERIC(14,2) CHECK (budget_amount IS NULL OR budget_amount >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX admin_notes_admin_idx ON admin_notes (admin_id, created_at DESC);
CREATE INDEX admin_notes_issue_idx ON admin_notes (admin_id, issue_id);
