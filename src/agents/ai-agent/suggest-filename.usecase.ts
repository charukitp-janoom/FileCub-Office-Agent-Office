import { extname } from "node:path";
import type { LlmClient } from "./llm-client";

const SYSTEM_PROMPT =
  "คุณคือ Cub AI Agent ผู้ช่วยตั้งชื่อไฟล์ของ FileCub Office ตอบกลับด้วยชื่อไฟล์ภาษาไทยที่สื่อความหมายเพียงบรรทัดเดียว ห้ามใส่นามสกุลไฟล์ ห้ามอธิบายเพิ่ม";

/** Falls back to "<category>-<date>" when the LLM isn't configured/reachable. */
export async function suggestFilename(
  llm: LlmClient,
  originalName: string,
  content: string,
  categoryNameTh?: string,
): Promise<string> {
  const extension = extname(originalName);
  const reply = await llm.complete(
    SYSTEM_PROMPT,
    `ไฟล์เดิมชื่อ "${originalName}" หมวดหมู่ "${categoryNameTh ?? "ไม่ทราบ"}" เนื้อหา:\n\n${content}`,
  );
  if (reply) return `${reply.trim().replace(/[\\/:*?"<>|]/g, "")}${extension}`;

  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${categoryNameTh ?? "เอกสาร"}-${datePart}${extension}`;
}
