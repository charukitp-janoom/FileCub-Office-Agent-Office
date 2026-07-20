-- Cub Security Agent + Cub Backup Agent tables.
-- Mirrors docs/agent-office/02-database.md sections 2.7 and 2.10.

CREATE TABLE IF NOT EXISTS protected_files (
  file_id       TEXT PRIMARY KEY REFERENCES files(id),
  protected_by  TEXT NOT NULL REFERENCES users(id),
  reason_th     TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS backup_jobs (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL CHECK (type IN ('auto', 'manual')),
  status        TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  total_files   INTEGER NOT NULL DEFAULT 0,
  size_bytes    INTEGER NOT NULL DEFAULT 0,
  started_at    TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at   TEXT
);

CREATE TABLE IF NOT EXISTS backup_versions (
  id            TEXT PRIMARY KEY,
  file_id       TEXT NOT NULL REFERENCES files(id),
  backup_job_id TEXT NOT NULL REFERENCES backup_jobs(id),
  version_no    INTEGER NOT NULL,
  storage_path  TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_backup_versions_file ON backup_versions(file_id, version_no);

CREATE TABLE IF NOT EXISTS backup_storage_status (
  id                    INTEGER PRIMARY KEY CHECK (id = 1),
  total_capacity_bytes  INTEGER NOT NULL,
  used_bytes            INTEGER NOT NULL,
  checked_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
