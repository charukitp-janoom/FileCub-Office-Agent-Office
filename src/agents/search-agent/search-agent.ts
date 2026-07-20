import { BaseAgent } from "../../agent-core/base-agent";
import type { AgentCapability, AgentCode, AgentRunResult } from "../../agent-core/types";

export interface SearchPayload {
  query: string;
}

export class SearchAgent extends BaseAgent {
  code: AgentCode = "search";
  nameTh = "Cub Search Agent";
  nicknameTh = "น้องเซิร์ช";
  roleTitleTh = "Document Detective";
  icon = "search-agent";

  capabilities: AgentCapability[] = [
    { key: "search-by-name", labelTh: "ค้นหาจากชื่อไฟล์", descriptionTh: "ค้นหาไฟล์ด้วยชื่อไฟล์", enabled: true },
    { key: "search-by-content", labelTh: "ค้นหาจากเนื้อหาเอกสาร", descriptionTh: "ค้นหาไฟล์ด้วยเนื้อหาภายใน", enabled: true },
  ];

  async runCapability(_key: string, payload?: unknown): Promise<AgentRunResult> {
    const { query } = (payload as SearchPayload) ?? { query: "" };
    // Actual full-text lookup happens in fts-index.service.ts against SQLite FTS5.
    const resultCount = 0;

    if (this.ctx) {
      await this.ctx.eventBus.publish({
        name: "file.searched",
        sourceAgent: this.code,
        userId: this.ctx.userId,
        payload: { query, resultCount },
        createdAt: new Date().toISOString(),
      });
    }

    return { success: true, summaryTh: `พบ ${resultCount} รายการ`, data: { resultCount } };
  }
}
