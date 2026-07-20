-- Cub Search Agent + Cub AI Agent tables.
-- Mirrors docs/agent-office/02-database.md sections 2.5 and 2.8.

-- 'trigram' tokenizer (not the unicode61 default) because Thai script has
-- no spaces between words: a word-boundary tokenizer would treat an entire
-- run like "เอกสารรายงานเดือนมกราคม" as one opaque token, so a query for
-- "รายงาน" (a substring, not the whole token) would never match. Trigram
-- indexes every 3-character slice instead, which supports substring search
-- in any script without needing a Thai word-segmentation library — the gap
-- flagged in docs/agent-office/05-development-plan.md's risk #3.
CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
  file_id UNINDEXED,
  title,
  content,
  keywords,
  tokenize = 'trigram'
);

CREATE TABLE IF NOT EXISTS search_queries_log (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  query_text    TEXT NOT NULL,
  result_count  INTEGER NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  file_id     TEXT REFERENCES files(id),
  title_th    TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id                TEXT PRIMARY KEY,
  conversation_id   TEXT NOT NULL REFERENCES ai_conversations(id),
  role              TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content           TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS ai_file_insights (
  file_id                 TEXT PRIMARY KEY REFERENCES files(id),
  summary_th              TEXT,
  suggested_name          TEXT,
  suggested_category_id   TEXT REFERENCES file_categories(id),
  generated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
