-- Widen notifications.type to include 'achievement' so unlocking one can
-- surface both in the Notification Center and as a toast (see
-- agent-core/achievement-engine.ts, which already publishes
-- achievement.unlocked — this migration just lets Notify Agent persist it).
-- SQLite can't ALTER a CHECK constraint in place, so recreate the table.

CREATE TABLE notifications_new (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  agent_id      TEXT REFERENCES agents(id),
  type          TEXT NOT NULL CHECK (type IN ('task', 'new_file', 'important_doc', 'license', 'update', 'security', 'backup', 'achievement')),
  title_th      TEXT NOT NULL,
  message_th    TEXT NOT NULL,
  is_read       INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO notifications_new SELECT * FROM notifications;
DROP TABLE notifications;
ALTER TABLE notifications_new RENAME TO notifications;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
