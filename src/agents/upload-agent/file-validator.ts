import { existsSync, statSync } from "node:fs";
import { extname } from "node:path";

export interface ValidationResult {
  valid: boolean;
  reasonTh?: string;
  sizeBytes?: number;
}

/** Basic sanity checks before a file is imported into FileCub Office. */
export function validateFile(path: string): ValidationResult {
  if (!existsSync(path)) {
    return { valid: false, reasonTh: "ไม่พบไฟล์ต้นทาง" };
  }

  const stats = statSync(path);
  if (!stats.isFile()) {
    return { valid: false, reasonTh: "ไม่ใช่ไฟล์ (อาจเป็นโฟลเดอร์)" };
  }
  if (stats.size === 0) {
    return { valid: false, reasonTh: "ไฟล์เสียหายหรือมีขนาด 0 ไบต์" };
  }
  if (!extname(path)) {
    return { valid: false, reasonTh: "ไฟล์ไม่มีนามสกุล" };
  }

  return { valid: true, sizeBytes: stats.size };
}
