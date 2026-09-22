-- 009_citizen_login.sql : citizen sign-in via phone + OTP, so a citizen can see every issue they
-- have reported without needing an Issue ID. A citizen's identity IS their phone number - there is
-- no separate signup step, and their history (already collected on each anonymous report) attaches
-- to their account the first time they verify that number.
--
-- The OTP itself is a placeholder (see server/src/services/otp.js) until an SMS gateway is wired in.

CREATE TABLE citizens (
  id         BIGSERIAL PRIMARY KEY,
  phone      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sessions DROP CONSTRAINT sessions_role_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_role_check CHECK (role IN ('corporator','admin','citizen'));
