-- 001_init.sql : core WardWatch schema
-- Statuses and categories are enforced with CHECK constraints (not enums) so
-- adding a value later is a one-line migration rather than an ALTER TYPE.

CREATE TABLE wards (
  id          SERIAL PRIMARY KEY,
  number      INTEGER NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One corporator per ward (UNIQUE ward_id). Deactivate instead of deleting so
-- issue history keeps its author.
CREATE TABLE corporators (
  id             SERIAL PRIMARY KEY,
  ward_id        INTEGER NOT NULL UNIQUE REFERENCES wards (id),
  name           TEXT    NOT NULL,
  username       TEXT    NOT NULL,
  password_hash  TEXT    NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX corporators_username_key ON corporators (lower(username));

CREATE TABLE admins (
  id             SERIAL PRIMARY KEY,
  name           TEXT    NOT NULL,
  username       TEXT    NOT NULL,
  password_hash  TEXT    NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX admins_username_key ON admins (lower(username));

CREATE TABLE issues (
  id             BIGSERIAL PRIMARY KEY,
  -- Citizen-facing ID, e.g. WW-7K3M9QXA. Random (not sequential) so IDs
  -- cannot be enumerated to browse other people's issues.
  public_id      TEXT    NOT NULL UNIQUE,
  ward_id        INTEGER NOT NULL REFERENCES wards (id),
  -- Auto-assigned from the ward's corporator at submission time. NULL when the
  -- ward has no active corporator (shows up as "unassigned" for admins).
  corporator_id  INTEGER REFERENCES corporators (id),
  category       TEXT    NOT NULL
                 CHECK (category IN ('roads','water','sanitation','streetlights','drainage','parks','other')),
  title          TEXT    NOT NULL CHECK (char_length(title) BETWEEN 5 AND 120),
  description    TEXT    NOT NULL CHECK (char_length(description) BETWEEN 10 AND 2000),
  address        TEXT    CHECK (address IS NULL OR char_length(address) <= 200),
  citizen_name   TEXT    NOT NULL CHECK (char_length(citizen_name) BETWEEN 2 AND 100),
  citizen_phone  TEXT    NOT NULL,
  photos         TEXT[]  NOT NULL DEFAULT '{}',
  status         TEXT    NOT NULL DEFAULT 'submitted'
                 CHECK (status IN ('submitted','acknowledged','in_progress','resolved','rejected')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at    TIMESTAMPTZ
);
CREATE INDEX issues_corporator_status_idx ON issues (corporator_id, status);
CREATE INDEX issues_ward_status_idx       ON issues (ward_id, status);
CREATE INDEX issues_created_at_idx        ON issues (created_at DESC);

-- Append-only history. Every status change / remark / photo upload is a row;
-- `status` is the issue's status AFTER the update. The first row (status
-- 'submitted', corporator_id NULL) is written when the citizen files the issue.
CREATE TABLE issue_updates (
  id             BIGSERIAL PRIMARY KEY,
  issue_id       BIGINT  NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
  corporator_id  INTEGER REFERENCES corporators (id),
  status         TEXT    NOT NULL
                 CHECK (status IN ('submitted','acknowledged','in_progress','resolved','rejected')),
  remark         TEXT    CHECK (remark IS NULL OR char_length(remark) <= 1000),
  photos         TEXT[]  NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX issue_updates_issue_idx ON issue_updates (issue_id, created_at);
