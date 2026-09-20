-- 002_sessions.sql : server-side login sessions (replaces JWTs).
-- The browser holds an opaque random token in an httpOnly cookie; only its
-- SHA-256 hash is stored here, so a DB leak does not leak usable sessions.
-- Logout / deactivation = delete the row, which takes effect immediately.

CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,
  role        TEXT    NOT NULL CHECK (role IN ('corporator','admin')),
  user_id     INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);
CREATE INDEX sessions_user_idx    ON sessions (role, user_id);
