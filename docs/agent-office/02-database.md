# 02. Database Design

Engine อ้างอิง: SQLite (local, offline-first) — syntax เข้ากันได้กับ PostgreSQL
เกือบทั้งหมด หากภายหลังต้องขึ้น central sync server

## 2.1 ERD (text form)

```
users ──< user_levels
  │
  ├──< user_achievements >── achievements
  │
  ├──< files ──< file_versions
  │      │
  │      ├──< search_index (FTS5, 1:1)
  │      └──< uploads
  │
  ├──< agent_activity_logs >── agents
  │
  ├──< notifications >── agents
  │
  ├──< security_events
  │
  ├──< permissions
  │
  ├──< ai_conversations ──< ai_messages
  │
  ├──< backup_jobs ──< backup_versions >── files
  │
  └──< dashboard_stats_daily

agents ──< agent_capabilities
file_categories ──< file_categories (self, parent_id) ──< folder_rules
```

## 2.2 ตาราง Core (ผู้ใช้/สิทธิ์)

```sql
CREATE TABLE users (
  id            TEXT PRIMARY KEY,          -- uuid
  username      TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  email         TEXT,
  role          TEXT NOT NULL DEFAULT 'staff'  -- admin | staff | viewer
                CHECK (role IN ('admin','staff','viewer')),
  coin_balance  INTEGER NOT NULL DEFAULT 0,     -- FileCub Coin
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE permissions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  resource_type TEXT NOT NULL,     -- 'file' | 'folder' | 'agent' | 'system'
  resource_id   TEXT,              -- NULL = ทั้งระบบ (global grant)
  access_level  TEXT NOT NULL,     -- 'read' | 'write' | 'admin'
  granted_by    TEXT REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE security_events (
  id            TEXT PRIMARY KEY,
  user_id       TEXT REFERENCES users(id),
  event_type    TEXT NOT NULL,     -- 'login' | 'permission_check' | 'anomaly' | 'file_access_denied'
  severity      TEXT NOT NULL DEFAULT 'info',  -- info | warning | critical
  description_th TEXT NOT NULL,
  metadata_json TEXT,              -- JSON: ip, device, resource ที่เกี่ยวข้อง
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_security_events_user ON security_events(user_id, created_at);
```

## 2.3 ตาราง Agent Framework (generic ใช้ได้กับ agent ทั้ง 7 + อนาคต)

```sql
CREATE TABLE agents (
  id            TEXT PRIMARY KEY,          -- 'folder' | 'search' | 'upload' | ...
  name_th       TEXT NOT NULL,             -- 'Cub Folder Agent'
  nickname_th   TEXT NOT NULL,             -- 'น้องโฟลเดอร์'
  role_title_th TEXT NOT NULL,             -- 'File Organization Specialist'
  icon_key      TEXT NOT NULL,
  is_enabled    INTEGER NOT NULL DEFAULT 1,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE agent_capabilities (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL REFERENCES agents(id),
  feature_key   TEXT NOT NULL,             -- 'auto-organize'
  label_th      TEXT NOT NULL,
  description_th TEXT NOT NULL,
  is_enabled    INTEGER NOT NULL DEFAULT 1,
  UNIQUE(agent_id, feature_key)
);

-- ตารางหัวใจ: ทุก action ของทุก agent log ที่นี่ที่เดียว
-- ใช้เป็นแหล่งข้อมูลให้ทั้ง Dashboard และ Achievement engine
CREATE TABLE agent_activity_logs (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL REFERENCES agents(id),
  user_id       TEXT NOT NULL REFERENCES users(id),
  event_name    TEXT NOT NULL,             -- 'file.organized', 'backup.completed', ...
  target_type   TEXT,                      -- 'file' | 'folder' | 'backup_job' | ...
  target_id     TEXT,
  status        TEXT NOT NULL DEFAULT 'success',  -- success | failed | pending
  summary_th    TEXT NOT NULL,             -- ข้อความสรุปสำหรับ log/notify
  exp_gained    INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_activity_agent_time ON agent_activity_logs(agent_id, created_at);
CREATE INDEX idx_activity_user_time ON agent_activity_logs(user_id, created_at);
```

## 2.4 Agent 1 — Cub Folder Agent

```sql
CREATE TABLE file_categories (
  id          TEXT PRIMARY KEY,
  name_th     TEXT NOT NULL,          -- 'เอกสารรายงาน', 'รูปภาพ'
  icon_key    TEXT NOT NULL,
  parent_id   TEXT REFERENCES file_categories(id)
);

CREATE TABLE folder_rules (
  id            TEXT PRIMARY KEY,
  category_id   TEXT NOT NULL REFERENCES file_categories(id),
  match_type    TEXT NOT NULL,        -- 'extension' | 'filename_pattern' | 'content_keyword'
  pattern       TEXT NOT NULL,        -- '.docx' / 'report*' / 'ใบเสนอราคา'
  priority      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE files (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL REFERENCES users(id),
  name          TEXT NOT NULL,
  path          TEXT NOT NULL,
  category_id   TEXT REFERENCES file_categories(id),
  size_bytes    INTEGER NOT NULL,
  mime_type     TEXT,
  source        TEXT NOT NULL,        -- 'manual' | 'desktop_auto' | 'scan'
  status        TEXT NOT NULL DEFAULT 'active',  -- active | trashed | backed_up
  organized_by_agent INTEGER NOT NULL DEFAULT 0, -- 1 ถ้า Folder Agent จัดให้อัตโนมัติ
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_files_owner_category ON files(owner_id, category_id);
```

## 2.5 Agent 2 — Cub Search Agent

```sql
-- Full-text search รองรับภาษาไทย (ใช้ FTS5 + custom tokenizer หรือ external segmenter)
CREATE VIRTUAL TABLE search_index USING fts5(
  file_id UNINDEXED,
  title,
  content,
  keywords
);

CREATE TABLE search_queries_log (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  query_text   TEXT NOT NULL,
  result_count INTEGER NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## 2.6 Agent 3 — Cub Upload Agent

```sql
CREATE TABLE uploads (
  id            TEXT PRIMARY KEY,
  file_id       TEXT REFERENCES files(id),
  source_type   TEXT NOT NULL,   -- 'manual_upload' | 'scan' | 'desktop_watch'
  original_path TEXT,            -- path ต้นทางก่อนย้ายเข้า FileCub Office
  validation_status TEXT NOT NULL DEFAULT 'pending', -- pending|passed|rejected
  validation_note_th TEXT,       -- เช่น 'ไฟล์เสียหาย', 'ไฟล์ซ้ำ'
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE desktop_watch_config (
  user_id       TEXT PRIMARY KEY REFERENCES users(id),
  watched_path  TEXT NOT NULL,    -- path ของ Desktop
  is_enabled    INTEGER NOT NULL DEFAULT 1,
  last_scanned_at TEXT
);
```

## 2.7 Agent 4 — Cub Security Agent

ใช้ `permissions`, `security_events` ที่นิยามไว้แล้วใน 2.2 เพิ่มเติม:

```sql
CREATE TABLE protected_files (
  file_id       TEXT PRIMARY KEY REFERENCES files(id),
  protected_by  TEXT NOT NULL REFERENCES users(id),
  reason_th     TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## 2.8 Agent 5 — Cub AI Agent

```sql
CREATE TABLE ai_conversations (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  file_id       TEXT REFERENCES files(id),  -- NULL ถ้าเป็นคำถามทั่วไปเกี่ยวกับโปรแกรม
  title_th      TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE ai_messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES ai_conversations(id),
  role            TEXT NOT NULL,   -- 'user' | 'assistant'
  content         TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE ai_file_insights (
  file_id         TEXT PRIMARY KEY REFERENCES files(id),
  summary_th      TEXT,
  suggested_name  TEXT,
  suggested_category_id TEXT REFERENCES file_categories(id),
  generated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## 2.9 Agent 6 — Cub Notify Agent

```sql
CREATE TABLE notifications (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  agent_id      TEXT REFERENCES agents(id),   -- agent ที่เป็นต้นเหตุ (nullable = system)
  type          TEXT NOT NULL,   -- 'task' | 'new_file' | 'important_doc' | 'license' | 'update'
  title_th      TEXT NOT NULL,
  message_th    TEXT NOT NULL,
  is_read       INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read);
```

## 2.10 Agent 7 — Cub Backup Agent

```sql
CREATE TABLE backup_jobs (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL,     -- 'auto' | 'manual'
  status        TEXT NOT NULL DEFAULT 'running',  -- running|completed|failed
  total_files   INTEGER NOT NULL DEFAULT 0,
  size_bytes    INTEGER NOT NULL DEFAULT 0,
  started_at    TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at   TEXT
);

CREATE TABLE backup_versions (
  id            TEXT PRIMARY KEY,
  file_id       TEXT NOT NULL REFERENCES files(id),
  backup_job_id TEXT NOT NULL REFERENCES backup_jobs(id),
  version_no    INTEGER NOT NULL,
  storage_path  TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE backup_storage_status (
  id              INTEGER PRIMARY KEY CHECK (id = 1),  -- singleton row
  total_capacity_bytes INTEGER NOT NULL,
  used_bytes      INTEGER NOT NULL,
  checked_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## 2.11 Dashboard & Achievement (อ่านจาก agent_activity_logs เป็นหลัก)

```sql
-- สรุปรายวัน (materialized, คำนวณโดย scheduled job จาก agent_activity_logs)
CREATE TABLE dashboard_stats_daily (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id),
  stat_date          TEXT NOT NULL,     -- 'YYYY-MM-DD'
  files_added        INTEGER NOT NULL DEFAULT 0,
  files_organized    INTEGER NOT NULL DEFAULT 0,
  storage_saved_bytes INTEGER NOT NULL DEFAULT 0,
  files_backed_up    INTEGER NOT NULL DEFAULT 0,
  ai_tasks_completed INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, stat_date)
);

CREATE TABLE user_levels (
  user_id       TEXT PRIMARY KEY REFERENCES users(id),
  level_name    TEXT NOT NULL DEFAULT 'Beginner',
  -- Beginner -> Office User -> File Master -> AI Commander
  current_exp   INTEGER NOT NULL DEFAULT 0,
  next_level_exp INTEGER NOT NULL DEFAULT 1000
);

CREATE TABLE achievements (
  id            TEXT PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,    -- 'DESKTOP_CLEANER'
  name_th       TEXT NOT NULL,           -- 'Desktop Cleaner'
  description_th TEXT NOT NULL,          -- 'จัด Desktop สำเร็จ 100 ไฟล์'
  icon_key      TEXT NOT NULL,           -- '🏆'
  criteria_event TEXT NOT NULL,          -- event_name ที่นับ เช่น 'file.organized'
  criteria_count INTEGER NOT NULL        -- จำนวนครั้งที่ต้องถึง
);

CREATE TABLE user_achievements (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  achievement_id  TEXT NOT NULL REFERENCES achievements(id),
  unlocked_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, achievement_id)
);
```

### ตัวอย่างข้อมูลตั้งต้น (seed) สำหรับ achievements

```sql
INSERT INTO achievements (id, code, name_th, description_th, icon_key, criteria_event, criteria_count) VALUES
 ('ach-1', 'DESKTOP_CLEANER', 'Desktop Cleaner', 'จัด Desktop สำเร็จ 100 ไฟล์', '🏆', 'file.organized', 100),
 ('ach-2', 'FILE_GUARDIAN',   'File Guardian',   'Backup สำเร็จ 1000 ไฟล์',     '🏆', 'backup.completed', 1000),
 ('ach-3', 'SEARCH_MASTER',   'Search Master',   'ค้นหาไฟล์สำเร็จ 500 ครั้ง',    '🔍', 'file.searched', 500),
 ('ach-4', 'AI_PARTNER',      'AI Partner',      'สนทนากับ Cub AI Agent 100 ครั้ง', '🤖', 'ai.summary_ready', 100);
```

Achievement engine เป็น consumer ตัวหนึ่งของ `agent_activity_logs`: ทุกครั้งที่มี log ใหม่
ให้เทียบ `event_name` กับ `criteria_event`, นับจำนวนสะสมของ user นั้น และปลดล็อกเมื่อถึง
`criteria_count` — ไม่ต้องเขียน logic เฉพาะใน agent แต่ละตัว
