import type { AgentDb } from "../../shared/db/client";
import { normalizeQuery, toFtsMatchQuery } from "./thai-query.util";

export interface SearchHit {
  fileId: string;
  name: string;
  categoryNameTh: string | null;
  snippet: string;
}

/** (Re)indexes one file. Safe to call repeatedly — clears any previous row for the same file first. */
export function indexFile(db: AgentDb, fileId: string, title: string, content: string, keywords: string): void {
  db.prepare("DELETE FROM search_index WHERE file_id = ?").run(fileId);
  db.prepare("INSERT INTO search_index (file_id, title, content, keywords) VALUES (?, ?, ?, ?)").run(
    fileId,
    title,
    content,
    keywords,
  );
}

export function removeFromIndex(db: AgentDb, fileId: string): void {
  db.prepare("DELETE FROM search_index WHERE file_id = ?").run(fileId);
}

/**
 * Substring search over indexed files (see 0003_search_and_ai.sql for why
 * the index uses the trigram tokenizer). Returns an empty array — not an
 * error — for queries shorter than 3 characters, since trigrams can't
 * match anything shorter.
 */
export function search(db: AgentDb, ownerId: string, rawQuery: string, limit = 20): SearchHit[] {
  const normalized = normalizeQuery(rawQuery);
  if (!normalized) return [];

  const rows = db
    .prepare(`
      SELECT
        s.file_id as fileId,
        f.name as name,
        c.name_th as categoryNameTh,
        snippet(search_index, 1, '[', ']', '…', 8) as snippet
      FROM search_index s
      JOIN files f ON f.id = s.file_id
      LEFT JOIN file_categories c ON c.id = f.category_id
      WHERE search_index MATCH ? AND f.owner_id = ? AND f.status = 'active'
      ORDER BY rank
      LIMIT ?
    `)
    .all(toFtsMatchQuery(normalized), ownerId, limit);

  return rows as unknown as SearchHit[];
}
