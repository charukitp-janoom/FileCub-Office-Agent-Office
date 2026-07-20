import { BaseAgent } from "../../agent-core/base-agent";
import type { AgentCapability, AgentCode, AgentRunResult } from "../../agent-core/types";

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

  async runCapability(key: string, payload?: unknown): Promise<AgentRunResult> {
    // llm-client.ts wraps the Claude API call; usecases live alongside it
    // (summarize.usecase.ts, chat-with-document.usecase.ts, suggest-filename.usecase.ts).
    if (this.ctx) {
      await this.ctx.eventBus.publish({
        name: "ai.summary_ready",
        sourceAgent: this.code,
        userId: this.ctx.userId,
        payload: { capability: key, ...(payload as object) },
        createdAt: new Date().toISOString(),
      });
    }

    return { success: true, summaryTh: "ประมวลผลด้วย AI เรียบร้อย" };
  }
}
