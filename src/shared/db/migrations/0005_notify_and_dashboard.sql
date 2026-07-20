-- Cub Notify Agent + Agent Office Dashboard tables.
-- Mirrors docs/agent-office/02-database.md sections 2.9 and 2.11 — the
-- notification `type` list is widened from the doc's original suggestion
-- to match the events this app actually publishes (security, backup).

CREATE TABLE IF NOT EXISTS notifications (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  agent_id      TEXT REFERENCES agents(id),
  type          TEXT NOT NULL CHECK (type IN ('task', 'new_file', 'important_doc', 'license', 'update', 'security', 'backup')),
  title_th      TEXT NOT NULL,
  message_th    TEXT NOT NULL,
  is_read       INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS dashboard_stats_daily (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL REFERENCES users(id),
  stat_date             TEXT NOT NULL,
  files_added           INTEGER NOT NULL DEFAULT 0,
  files_organized       INTEGER NOT NULL DEFAULT 0,
  storage_saved_bytes   INTEGER NOT NULL DEFAULT 0,
  files_backed_up       INTEGER NOT NULL DEFAULT 0,
  ai_tasks_completed    INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, stat_date)
);
