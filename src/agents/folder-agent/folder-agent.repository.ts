import type { AgentDb } from "../../shared/db/client";

export interface FileRow {
  id: string;
  name: string;
  path: string;
  category_id: string | null;
  organized_by_agent: number;
}

export interface CategoryRow {
  id: string;
  name_th: string;
  icon_key: string;
}

export function getFile(db: AgentDb, fileId: string): FileRow | undefined {
  return db.prepare("SELECT id, name, path, category_id, organized_by_agent FROM files WHERE id = ?").get(fileId) as
    | FileRow
    | undefined;
}

export function getCategory(db: AgentDb, categoryId: string): CategoryRow | undefined {
  return db.prepare("SELECT id, name_th, icon_key FROM file_categories WHERE id = ?").get(categoryId) as
    | CategoryRow
    | undefined;
}

/** True if Cub Security Agent has flagged this file as protected — Folder Agent must not re-file it automatically. */
export function isProtected(db: AgentDb, fileId: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM protected_files WHERE file_id = ?").get(fileId));
}

export function organizeFile(db: AgentDb, fileId: string, categoryId: string): void {
  db.prepare(`
    UPDATE files
    SET category_id = ?, organized_by_agent = 1, updated_at = datetime('now')
    WHERE id = ?
  `).run(categoryId, fileId);
}

export function listOrganizedFiles(db: AgentDb, ownerId: string, limit = 20) {
  return db
    .prepare(`
      SELECT f.id, f.name, f.path, f.source, c.name_th as categoryNameTh, c.icon_key as categoryIcon
      FROM files f
      LEFT JOIN file_categories c ON c.id = f.category_id
      WHERE f.owner_id = ? AND f.organized_by_agent = 1
      ORDER BY f.updated_at DESC
      LIMIT ?
    `)
    .all(ownerId, limit);
}
