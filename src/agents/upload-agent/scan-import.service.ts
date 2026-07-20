import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import type { AgentDb } from "../../shared/db/client";
import { validateFile } from "./file-validator";

export type FileSource = "manual" | "desktop_auto" | "scan";
export type UploadSourceType = "manual_upload" | "scan" | "desktop_watch";

export interface ImportOutcome {
  success: boolean;
  reasonTh: string;
  fileId?: string;
  fileName?: string;
}

const SOURCE_TO_UPLOAD_TYPE: Record<FileSource, UploadSourceType> = {
  manual: "manual_upload",
  scan: "scan",
  desktop_auto: "desktop_watch",
};

/**
 * Shared import core behind Upload Agent's three capabilities
 * (manual-upload, scan-import, desktop-auto-import) — validates the file,
 * skips it if it was already imported from the same path, and otherwise
 * inserts `files` + `uploads` rows. Doesn't touch the event bus; the
 * caller (UploadAgent) publishes `file.imported` on success.
 */
export function importFile(db: AgentDb, ownerId: string, sourcePath: string, source: FileSource): ImportOutcome {
  const existing = db
    .prepare("SELECT id FROM files WHERE owner_id = ? AND path = ? AND status = 'active'")
    .get(ownerId, sourcePath) as { id: string } | undefined;
  if (existing) {
    return { success: false, reasonTh: "ไฟล์นี้ถูกนำเข้าไปแล้ว" };
  }

  const validation = validateFile(sourcePath);
  const uploadId = randomUUID();

  if (!validation.valid) {
    db.prepare(`
      INSERT INTO uploads (id, source_type, original_path, validation_status, validation_note_th)
      VALUES (?, ?, ?, 'rejected', ?)
    `).run(uploadId, SOURCE_TO_UPLOAD_TYPE[source], sourcePath, validation.reasonTh ?? "ไม่ผ่านการตรวจสอบ");
    return { success: false, reasonTh: validation.reasonTh ?? "ไม่ผ่านการตรวจสอบ" };
  }

  const fileId = randomUUID();
  const fileName = basename(sourcePath);

  db.prepare(`
    INSERT INTO files (id, owner_id, name, path, size_bytes, source, status)
    VALUES (?, ?, ?, ?, ?, ?, 'active')
  `).run(fileId, ownerId, fileName, sourcePath, validation.sizeBytes ?? 0, source);

  db.prepare(`
    INSERT INTO uploads (id, file_id, source_type, original_path, validation_status)
    VALUES (?, ?, ?, ?, 'passed')
  `).run(uploadId, fileId, SOURCE_TO_UPLOAD_TYPE[source], sourcePath);

  return { success: true, reasonTh: "นำเข้าไฟล์สำเร็จ", fileId, fileName };
}
