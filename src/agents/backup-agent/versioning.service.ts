import { randomUUID } from "node:crypto";
import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import type { AgentDb } from "../../shared/db/client";

export interface BackupJobResult {
  jobId: string;
  totalFiles: number;
  totalBytes: number;
}

const DEFAULT_CAPACITY_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB, matches the poster's local-storage framing

/** Backs up every active file owned by `ownerId` (or just `onlyFileId` when given) into `backupDir`, versioned per file. */
export function runBackup(
  db: AgentDb,
  backupDir: string,
  ownerId: string,
  type: "auto" | "manual",
  onlyFileId?: string,
): BackupJobResult {
  const jobId = randomUUID();
  db.prepare("INSERT INTO backup_jobs (id, type, status) VALUES (?, ?, 'running')").run(jobId, type);

  const files = onlyFileId
    ? (db.prepare("SELECT id, name, path FROM files WHERE id = ? AND status = 'active'").all(onlyFileId) as unknown as FileRow[])
    : (db.prepare("SELECT id, name, path FROM files WHERE owner_id = ? AND status = 'active'").all(ownerId) as unknown as FileRow[]);

  let totalBytes = 0;
  for (const file of files) {
    totalBytes += backupOneFile(db, backupDir, jobId, file);
  }

  db.prepare(`
    UPDATE backup_jobs SET status = 'completed', total_files = ?, size_bytes = ?, finished_at = datetime('now')
    WHERE id = ?
  `).run(files.length, totalBytes, jobId);

  refreshStorageStatus(db);

  return { jobId, totalFiles: files.length, totalBytes };
}

interface FileRow {
  id: string;
  name: string;
  path: string;
}

function backupOneFile(db: AgentDb, backupDir: string, jobId: string, file: FileRow): number {
  const nextVersion = getNextVersionNo(db, file.id);
  const fileBackupDir = join(backupDir, file.id);
  mkdirSync(fileBackupDir, { recursive: true });
  const storagePath = join(fileBackupDir, `v${nextVersion}${extname(file.name)}`);
  copyFileSync(file.path, storagePath);
  const sizeBytes = statSync(storagePath).size;

  db.prepare(`
    INSERT INTO backup_versions (id, file_id, backup_job_id, version_no, storage_path, size_bytes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), file.id, jobId, nextVersion, storagePath, sizeBytes);

  return sizeBytes;
}

function getNextVersionNo(db: AgentDb, fileId: string): number {
  const row = db
    .prepare("SELECT COALESCE(MAX(version_no), 0) as maxVersion FROM backup_versions WHERE file_id = ?")
    .get(fileId) as { maxVersion: number };
  return row.maxVersion + 1;
}

export function refreshStorageStatus(db: AgentDb): void {
  const row = db.prepare("SELECT COALESCE(SUM(size_bytes), 0) as used FROM backup_versions").get() as { used: number };
  db.prepare(`
    INSERT INTO backup_storage_status (id, total_capacity_bytes, used_bytes)
    VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET used_bytes = excluded.used_bytes, checked_at = datetime('now')
  `).run(DEFAULT_CAPACITY_BYTES, row.used);
}
