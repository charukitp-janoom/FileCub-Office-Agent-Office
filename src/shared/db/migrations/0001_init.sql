-- Core + agent framework tables needed for Phase 0.
-- Mirrors docs/agent-office/02-database.md sections 2.2, 2.3, 2.11.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  email         TEXT,
  role          TEXT NOT NULL DEFAULT 'staff'
                CHECK (role IN ('admin','staff','viewer')),
  coin_balance  INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS permissions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  resource_type TEXT NOT NULL,
  resource_id   TEXT,
  access_level  TEXT NOT NULL,
  granted_by    TEXT REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS security_events (
  id              TEXT PRIMARY KEY,
  user_id         TEXT REFERENCES users(id),
  event_type      TEXT NOT NULL,
  severity        TEXT NOT NULL DEFAULT 'info',
  description_th  TEXT NOT NULL,
  metadata_json   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id, created_at);

CREATE TABLE IF NOT EXISTS agents (
  id            TEXT PRIMARY KEY,
  name_th       TEXT NOT NULL,
  nickname_th   TEXT NOT NULL,
  role_title_th TEXT NOT NULL,
  icon_key      TEXT NOT NULL,
  is_enabled    INTEGER NOT NULL DEFAULT 1,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS agent_capabilities (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL REFERENCES agents(id),
  feature_key     TEXT NOT NULL,
  label_th        TEXT NOT NULL,
  description_th  TEXT NOT NULL,
  is_enabled      INTEGER NOT NULL DEFAULT 1,
  UNIQUE(agent_id, feature_key)
);

CREATE TABLE IF NOT EXISTS agent_activity_logs (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL REFERENCES agents(id),
  user_id       TEXT NOT NULL REFERENCES users(id),
  event_name    TEXT NOT NULL,
  target_type   TEXT,
  target_id     TEXT,
  status        TEXT NOT NULL DEFAULT 'success',
  summary_th    TEXT NOT NULL,
  exp_gained    INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activity_agent_time ON agent_activity_logs(agent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_user_time ON agent_activity_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_user_event ON agent_activity_logs(user_id, event_name);

CREATE TABLE IF NOT EXISTS achievements (
  id              TEXT PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  name_th         TEXT NOT NULL,
  description_th  TEXT NOT NULL,
  icon_key        TEXT NOT NULL,
  criteria_event  TEXT NOT NULL,
  criteria_count  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  achievement_id  TEXT NOT NULL REFERENCES achievements(id),
  unlocked_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS user_levels (
  user_id         TEXT PRIMARY KEY REFERENCES users(id),
  level_name      TEXT NOT NULL DEFAULT 'Beginner',
  current_exp     INTEGER NOT NULL DEFAULT 0,
  next_level_exp  INTEGER NOT NULL DEFAULT 1000
);
