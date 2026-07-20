-- File Organization (Cub Folder Agent) + Document Import (Cub Upload Agent) tables.
-- Mirrors docs/agent-office/02-database.md sections 2.4 and 2.6.

CREATE TABLE IF NOT EXISTS file_categories (
  id          TEXT PRIMARY KEY,
  name_th     TEXT NOT NULL,
  icon_key    TEXT NOT NULL,
  parent_id   TEXT REFERENCES file_categories(id)
);

CREATE TABLE IF NOT EXISTS folder_rules (
  id            TEXT PRIMARY KEY,
  category_id   TEXT NOT NULL REFERENCES file_categories(id),
  match_type    TEXT NOT NULL CHECK (match_type IN ('extension', 'filename_pattern')),
  pattern       TEXT NOT NULL,
  priority      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS files (
  id                  TEXT PRIMARY KEY,
  owner_id            TEXT NOT NULL REFERENCES users(id),
  name                TEXT NOT NULL,
  path                TEXT NOT NULL,
  category_id         TEXT REFERENCES file_categories(id),
  size_bytes          INTEGER NOT NULL,
  mime_type           TEXT,
  source              TEXT NOT NULL CHECK (source IN ('manual', 'desktop_auto', 'scan')),
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trashed', 'backed_up')),
  organized_by_agent  INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_files_owner_category ON files(owner_id, category_id);

CREATE TABLE IF NOT EXISTS uploads (
  id                    TEXT PRIMARY KEY,
  file_id               TEXT REFERENCES files(id),
  source_type           TEXT NOT NULL CHECK (source_type IN ('manual_upload', 'scan', 'desktop_watch')),
  original_path         TEXT,
  validation_status      TEXT NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('pending', 'passed', 'rejected')),
  validation_note_th     TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS desktop_watch_config (
  user_id           TEXT PRIMARY KEY REFERENCES users(id),
  watched_path      TEXT NOT NULL,
  is_enabled        INTEGER NOT NULL DEFAULT 1,
  last_scanned_at   TEXT
);
