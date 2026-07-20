import type { LlmClient } from "./llm-client";

const SYSTEM_PROMPT = "คุณคือ Cub AI Agent ผู้ช่วยสรุปเอกสารของ FileCub Office ตอบเป็นภาษาไทย กระชับ ไม่เกิน 3 ประโยค";

/** Falls back to a plain truncation when the LLM isn't configured/reachable. */
export async function summarize(llm: LlmClient, fileName: string, content: string): Promise<string> {
  const reply = await llm.complete(SYSTEM_PROMPT, `สรุปเนื้อหาไฟล์ "${fileName}" ต่อไปนี้:\n\n${content}`);
  if (reply) return reply.trim();

  const excerpt = content.trim().slice(0, 120);
  return excerpt.length < content.trim().length
    ? `(สรุปอัตโนมัติแบบออฟไลน์) ${excerpt}…`
    : `(สรุปอัตโนมัติแบบออฟไลน์) ${excerpt || "ไม่มีเนื้อหาให้สรุป"}`;
}
