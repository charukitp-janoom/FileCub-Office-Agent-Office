import type { LlmClient } from "./llm-client";

const SYSTEM_PROMPT =
  "คุณคือ Cub AI Agent ผู้ช่วยตอบคำถามเกี่ยวกับการใช้งานโปรแกรม FileCub Office ตอบเป็นภาษาไทย กระชับ เป็นมิตร";

// Deterministic offline FAQ so "ตอบคำถามเกี่ยวกับโปรแกรม" still works with
// no network/API key configured — keyword-matched, checked before the LLM.
const FAQ: Array<{ keywords: string[]; answerTh: string }> = [
  {
    keywords: ["desktop", "อัตโนมัติ", "auto import"],
    answerTh: 'เปิดโหมด "Desktop Auto Import" ที่ Cub Upload Agent เพื่อให้ระบบนำเข้าไฟล์ใหม่จาก Desktop ให้อัตโนมัติ',
  },
  {
    keywords: ["จัดหมวดหมู่", "โฟลเดอร์", "folder"],
    answerTh: "Cub Folder Agent จะจัดหมวดหมู่ไฟล์ให้อัตโนมัติตามนามสกุลและชื่อไฟล์ ดูกฎการจัดหมวดหมู่ได้ที่หน้า Agent Office",
  },
  {
    keywords: ["ค้นหา", "search"],
    answerTh: "ใช้ Cub Search Agent พิมพ์คำค้นบางส่วนของชื่อไฟล์หรือหมวดหมู่ได้เลย รองรับการค้นหาแบบบางส่วนสำหรับภาษาไทย",
  },
  {
    keywords: ["สำรอง", "backup"],
    answerTh: "Cub Backup Agent สำรองข้อมูลให้อัตโนมัติ กดดูสถานะและสั่งสำรองด้วยตนเองได้ที่หน้า Agent ของมัน",
  },
];

export async function answerAppQuestion(llm: LlmClient, question: string): Promise<string> {
  const reply = await llm.complete(SYSTEM_PROMPT, question);
  if (reply) return reply.trim();

  const lower = question.toLowerCase();
  const match = FAQ.find((entry) => entry.keywords.some((k) => lower.includes(k.toLowerCase())));
  return match?.answerTh ?? "(โหมดออฟไลน์) ยังไม่ได้ตั้งค่า AI ลองถามด้วยคำสำคัญ เช่น ค้นหา, จัดหมวดหมู่, สำรอง หรือ Desktop อัตโนมัติ";
}
