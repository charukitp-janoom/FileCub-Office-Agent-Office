-- Real authentication, closing the gap flagged in SECURITY.md: the API
-- previously had none — every request silently acted as a hardcoded admin
-- user. FileCub Office is a single-tenant local/LAN app (one instance, one
-- owner), so this is password-protecting that instance, not multi-tenant
-- login: no username, just a password gate on the existing owner account.

ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN password_salt TEXT;

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  -- Only a SHA-256 hash of the session token is stored, same reasoning as
  -- password hashing: a database read/leak shouldn't hand out valid
  -- sessions directly.
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
