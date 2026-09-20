-- 005_photos.sql : uploaded photos live in Postgres instead of on local disk.
-- Free/cheap hosts (Render, Fly, Railway...) have ephemeral filesystems that are wiped on every
-- restart or deploy, which would silently delete citizens' evidence. The database is already the
-- thing you back up, so photos travel with it. `issues.photos` / `issue_updates.photos` still hold
-- the URL paths ("/uploads/<name>"); the API serves them from this table. Files are capped at 5 MB.

CREATE TABLE photos (
  name          TEXT PRIMARY KEY,          -- "<uuid>.<jpg|png|webp>"
  content_type  TEXT  NOT NULL CHECK (content_type IN ('image/jpeg','image/png','image/webp')),
  data          BYTEA NOT NULL CHECK (octet_length(data) <= 5 * 1024 * 1024),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
