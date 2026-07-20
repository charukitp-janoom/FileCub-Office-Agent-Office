import { DatabaseSync } from "node:sqlite";

/**
 * Thin wrapper around node:sqlite. Swap for better-sqlite3 in the Electron
 * build if the bundled Node/Electron version doesn't ship node:sqlite —
 * the call surface (exec/prepare/get/all/run) is intentionally compatible.
 */
export type AgentDb = DatabaseSync;

export function openDb(path = ":memory:"): AgentDb {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA journal_mode = WAL;");
  return db;
}
