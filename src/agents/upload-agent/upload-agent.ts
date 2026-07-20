import { BaseAgent } from "../../agent-core/base-agent";
import type { AgentCapability, AgentCode, AgentRunResult } from "../../agent-core/types";

export class UploadAgent extends BaseAgent {
  code: AgentCode = "upload";
  nameTh = "Cub Upload Agent";
  nicknameTh = "น้องอัป";
  roleTitleTh = "Document Import Specialist";
  icon = "upload-agent";

  capabilities: AgentCapability[] = [
    { key: "manual-upload", labelTh: "Upload File", descriptionTh: "อัปโหลดไฟล์ด้วยตนเอง", enabled: true },
    { key: "scan-import", labelTh: "Scan Document Import", descriptionTh: "นำเข้าไฟล์จากเครื่องสแกน", enabled: true },
    { key: "desktop-auto-import", labelTh: "Desktop Auto Import", descriptionTh: "เฝ้าดู Desktop และนำเข้าไฟล์ใหม่อัตโนมัติ", enabled: true },
  ];

  async runCapability(key: string, payload?: unknown): Promise<AgentRunResult> {
    // desktop-watcher.service.ts / scan-import.service.ts / file-validator.ts
    // implement the concrete logic per capability key.
    if (this.ctx) {
      await this.ctx.eventBus.publish({
        name: "file.imported",
        sourceAgent: this.code,
        userId: this.ctx.userId,
        payload: { capability: key, ...(payload as object) },
        createdAt: new Date().toISOString(),
      });
    }

    return { success: true, summaryTh: "นำเข้าไฟล์เรียบร้อย" };
  }
}
