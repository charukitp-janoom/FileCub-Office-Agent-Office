import { BaseAgent } from "../../agent-core/base-agent";
import type { AgentCapability, AgentCode, AgentEvent, AgentRunResult } from "../../agent-core/types";
import type { AgentDb } from "../../shared/db/client";
import { indexFile, search } from "./fts-index.service";

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

  /** Indexes a file the moment Folder Agent organizes it, without either agent knowing about the other directly. */
  async onEvent(event: AgentEvent): Promise<void> {
    if (event.name !== "file.organized" || !this.ctx) return;
    const payload = event.payload as { fileId?: string; fileName?: string; categoryNameTh?: string };
    if (!payload.fileId || !payload.fileName) return;

    const db = this.ctx.db.raw as AgentDb;
    indexFile(db, payload.fileId, payload.fileName, "", payload.categoryNameTh ?? "");
  }

  async runCapability(_key: string, payload?: unknown): Promise<AgentRunResult> {
    const { query } = (payload as SearchPayload) ?? { query: "" };

    if (!this.ctx) {
      return { success: false, summaryTh: "Search Agent ยังไม่พร้อมใช้งาน" };
    }

    const db = this.ctx.db.raw as AgentDb;
    const hits = search(db, this.ctx.userId, query);

    db.prepare(
      "INSERT INTO search_queries_log (id, user_id, query_text, result_count) VALUES (?, ?, ?, ?)",
    ).run(crypto.randomUUID(), this.ctx.userId, query, hits.length);

    await this.ctx.eventBus.publish({
      name: "file.searched",
      sourceAgent: this.code,
      userId: this.ctx.userId,
      payload: { query, resultCount: hits.length },
      createdAt: new Date().toISOString(),
    });

    return { success: true, summaryTh: `พบ ${hits.length} รายการ`, data: { hits } };
  }
}
