import type { LlmClient } from "./llm-client";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT =
  "คุณคือ Cub AI Agent ผู้ช่วยตอบคำถามเกี่ยวกับเอกสารใน FileCub Office ตอบเป็นภาษาไทย อ้างอิงเฉพาะเนื้อหาที่ให้มา ถ้าไม่พบคำตอบในเนื้อหาให้บอกตามตรง";

/**
 * Answers one question about a document's content. `history` is included
 * for future multi-turn context but the current turn is what's sent —
 * ai-agent.ts is responsible for persisting both to ai_messages.
 */
export async function chatWithDocument(
  llm: LlmClient,
  documentName: string,
  documentContent: string,
  history: ChatMessage[],
  question: string,
): Promise<string> {
  const transcript = history.map((m) => `${m.role === "user" ? "ผู้ใช้" : "ผู้ช่วย"}: ${m.content}`).join("\n");
  const prompt = `เอกสาร: "${documentName}"\nเนื้อหา:\n${documentContent}\n\n${transcript ? transcript + "\n" : ""}ผู้ใช้: ${question}`;

  const reply = await llm.complete(SYSTEM_PROMPT, prompt);
  if (reply) return reply.trim();

  return `(โหมดออฟไลน์) ยังไม่ได้ตั้งค่า AI ผู้ช่วยจึงตอบคำถามเกี่ยวกับ "${documentName}" อัตโนมัติไม่ได้ในตอนนี้ กรุณาตั้งค่า ANTHROPIC_API_KEY`;
}
