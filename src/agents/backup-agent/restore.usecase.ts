import { copyFileSync, existsSync } from "node:fs";
import type { AgentDb } from "../../shared/db/client";

export interface RestoreOutcome {
  success: boolean;
  reasonTh: string;
  versionNo?: number;
}

/** Restores a file to a specific backup version (or the latest one, if `versionNo` is omitted). */
export function restoreFile(db: AgentDb, fileId: string, versionNo?: number): RestoreOutcome {
  const file = db.prepare("SELECT path FROM files WHERE id = ?").get(fileId) as { path: string } | undefined;
  if (!file) return { success: false, reasonTh: "ไม่พบไฟล์ที่ระบุ" };

  const version = versionNo
    ? (db
        .prepare("SELECT version_no, storage_path FROM backup_versions WHERE file_id = ? AND version_no = ?")
        .get(fileId, versionNo) as VersionRow | undefined)
    : (db
        .prepare("SELECT version_no, storage_path FROM backup_versions WHERE file_id = ? ORDER BY version_no DESC LIMIT 1")
        .get(fileId) as VersionRow | undefined);

  if (!version) return { success: false, reasonTh: "ไม่พบเวอร์ชันสำรองของไฟล์นี้" };
  if (!existsSync(version.storage_path)) return { success: false, reasonTh: "ไฟล์สำรองหายไปจากที่เก็บ" };

  copyFileSync(version.storage_path, file.path);
  return { success: true, reasonTh: `กู้คืนไฟล์เป็นเวอร์ชัน ${version.version_no} เรียบร้อย`, versionNo: version.version_no };
}

interface VersionRow {
  version_no: number;
  storage_path: string;
}
