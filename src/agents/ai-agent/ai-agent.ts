import { randomUUID } from "node:crypto";
import { BaseAgent } from "../../agent-core/base-agent";
import type { AgentCapability, AgentCode, AgentRunResult } from "../../agent-core/types";
import type { AgentDb } from "../../shared/db/client";
import { AnthropicLlmClient, type LlmClient } from "./llm-client";
import { summarize } from "./summarize.usecase";
import { suggestFilename } from "./suggest-filename.usecase";
import { chatWithDocument, type ChatMessage } from "./chat-with-document.usecase";
import { answerAppQuestion } from "./app-faq.usecase";

export interface SummarizePayload {
  fileId?: string;
  fileName: string;
  content: string;
}

export interface SuggestFilenamePayload {
  fileId?: string;
  originalName: string;
  content: string;
  categoryNameTh?: string;
}

export interface ChatPayload {
  conversationId?: string;
  fileId?: string;
  fileName: string;
  content: string;
  question: string;
}

export interface SuggestStoragePayload {
  fileId: string;
}

export interface QaPayload {
  question: string;
}

export class AiAgent extends BaseAgent {
  code: AgentCode = "ai";
  nameTh = "Cub AI Agent";
  nicknameTh = "น้องคิวบ์";
  roleTitleTh = "AI Office Assistant";
  icon = "ai-agent";

  capabilities: AgentCapability[] = [
    { key: "chat-with-document", labelTh: "Chat กับเอกสาร", descriptionTh: "สนทนาถามตอบเกี่ยวกับเนื้อหาในเอกสาร", enabled: true },
    { key: "summarize", labelTh: "สรุป PDF", descriptionTh: "สรุปเนื้อหาเอกสาร PDF", enabled: true },
    { key: "suggest-filename", labelTh: "ตั้งชื่อไฟล์อัตโนมัติ", descriptionTh: "แนะนำชื่อไฟล์ที่เหมาะสมจากเนื้อหา", enabled: true },
    { key: "suggest-storage", labelTh: "แนะนำการจัดเก็บไฟล์", descriptionTh: "แนะนำหมวดหมู่ที่ควรจัดเก็บ", enabled: true },
    { key: "qa-about-app", labelTh: "ตอบคำถามเกี่ยวกับโปรแกรม", descriptionTh: "ตอบคำถามการใช้งาน FileCub Office", enabled: true },
  ];

  constructor(private readonly llm: LlmClient = new AnthropicLlmClient()) {
    super();
  }

  async runCapability(key: string, payload?: unknown): Promise<AgentRunResult> {
    if (!this.ctx) return { success: false, summaryTh: "AI Agent ยังไม่พร้อมใช้งาน" };
    const db = this.ctx.db.raw as AgentDb;

    switch (key) {
      case "summarize":
        return this.handleSummarize(db, payload as SummarizePayload);
      case "suggest-filename":
        return this.handleSuggestFilename(db, payload as SuggestFilenamePayload);
      case "chat-with-document":
        return this.handleChat(db, payload as ChatPayload);
      case "suggest-storage":
        return this.handleSuggestStorage(db, payload as SuggestStoragePayload);
      case "qa-about-app":
        return this.handleQa(payload as QaPayload);
      default:
        return { success: false, summaryTh: `ไม่รู้จักความสามารถ "${key}"` };
    }
  }

  private async handleSummarize(db: AgentDb, payload: SummarizePayload): Promise<AgentRunResult> {
    const summaryTh = await summarize(this.llm, payload.fileName, payload.content);
    if (payload.fileId) upsertInsight(db, payload.fileId, { summary_th: summaryTh });
    await this.publishSummaryReady("summarize", payload.fileId);
    return { success: true, summaryTh, data: { summary: summaryTh } };
  }

  private async handleSuggestFilename(db: AgentDb, payload: SuggestFilenamePayload): Promise<AgentRunResult> {
    const suggestedName = await suggestFilename(this.llm, payload.originalName, payload.content, payload.categoryNameTh);
    if (payload.fileId) upsertInsight(db, payload.fileId, { suggested_name: suggestedName });
    await this.publishSummaryReady("suggest-filename", payload.fileId);
    return { success: true, summaryTh: `แนะนำชื่อไฟล์: "${suggestedName}"`, data: { suggestedName } };
  }

  private async handleChat(db: AgentDb, payload: ChatPayload): Promise<AgentRunResult> {
    const conversationId = payload.conversationId ?? this.startConversation(db, payload.fileId, payload.fileName);
    const history = getMessages(db, conversationId);

    const reply = await chatWithDocument(this.llm, payload.fileName, payload.content, history, payload.question);

    insertMessage(db, conversationId, "user", payload.question);
    insertMessage(db, conversationId, "assistant", reply);
    await this.publishSummaryReady("chat-with-document", payload.fileId);

    return { success: true, summaryTh: reply, data: { conversationId } };
  }

  private async handleSuggestStorage(db: AgentDb, payload: SuggestStoragePayload): Promise<AgentRunResult> {
    const file = db.prepare("SELECT name, category_id FROM files WHERE id = ?").get(payload.fileId) as
      | { name: string; category_id: string | null }
      | undefined;
    if (!file) return { success: false, summaryTh: "ไม่พบไฟล์ที่ระบุ" };

    const category = file.category_id
      ? (db.prepare("SELECT name_th FROM file_categories WHERE id = ?").get(file.category_id) as { name_th: string } | undefined)
      : undefined;
    const categoryNameTh = category?.name_th ?? "เอกสารทั่วไป";

    if (file.category_id) upsertInsight(db, payload.fileId, { suggested_category_id: file.category_id });
    await this.publishSummaryReady("suggest-storage", payload.fileId);

    return {
      success: true,
      summaryTh: `แนะนำให้เก็บไฟล์ "${file.name}" ไว้ที่หมวด "${categoryNameTh}"`,
      data: { categoryId: file.category_id, categoryNameTh },
    };
  }

  private async handleQa(payload: QaPayload): Promise<AgentRunResult> {
    const answer = await answerAppQuestion(this.llm, payload.question);
    await this.publishSummaryReady("qa-about-app");
    return { success: true, summaryTh: answer };
  }

  private startConversation(db: AgentDb, fileId: string | undefined, fileName: string): string {
    const id = randomUUID();
    db.prepare("INSERT INTO ai_conversations (id, user_id, file_id, title_th) VALUES (?, ?, ?, ?)").run(
      id,
      this.ctx!.userId,
      fileId ?? null,
      `สนทนาเกี่ยวกับ ${fileName}`,
    );
    return id;
  }

  private async publishSummaryReady(capability: string, fileId?: string): Promise<void> {
    await this.ctx!.eventBus.publish({
      name: "ai.summary_ready",
      sourceAgent: this.code,
      userId: this.ctx!.userId,
      payload: { capability, fileId },
      createdAt: new Date().toISOString(),
    });
  }
}

function getMessages(db: AgentDb, conversationId: string): ChatMessage[] {
  const rows = db
    .prepare("SELECT role, content FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC")
    .all(conversationId);
  return rows as unknown as ChatMessage[];
}

function insertMessage(db: AgentDb, conversationId: string, role: "user" | "assistant", content: string): void {
  db.prepare("INSERT INTO ai_messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)").run(
    randomUUID(),
    conversationId,
    role,
    content,
  );
}

function upsertInsight(
  db: AgentDb,
  fileId: string,
  fields: Partial<{ summary_th: string; suggested_name: string; suggested_category_id: string }>,
): void {
  db.prepare(`
    INSERT INTO ai_file_insights (file_id, summary_th, suggested_name, suggested_category_id)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(file_id) DO UPDATE SET
      summary_th = COALESCE(excluded.summary_th, ai_file_insights.summary_th),
      suggested_name = COALESCE(excluded.suggested_name, ai_file_insights.suggested_name),
      suggested_category_id = COALESCE(excluded.suggested_category_id, ai_file_insights.suggested_category_id),
      generated_at = datetime('now')
  `).run(fileId, fields.summary_th ?? null, fields.suggested_name ?? null, fields.suggested_category_id ?? null);
}
