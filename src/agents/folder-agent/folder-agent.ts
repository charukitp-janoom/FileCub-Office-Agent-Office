import { BaseAgent } from "../../agent-core/base-agent";
import type { AgentCapability, AgentCode, AgentEvent, AgentRunResult } from "../../agent-core/types";

export class FolderAgent extends BaseAgent {
  code: AgentCode = "folder";
  nameTh = "Cub Folder Agent";
  nicknameTh = "น้องโฟลเดอร์";
  roleTitleTh = "File Organization Specialist";
  icon = "folder-agent";

  capabilities: AgentCapability[] = [
    { key: "auto-organize", labelTh: "จัดหมวดหมู่ไฟล์อัตโนมัติ", descriptionTh: "วิเคราะห์และย้ายไฟล์ใหม่เข้าหมวดหมู่ที่เหมาะสม", enabled: true },
    { key: "build-folder-structure", labelTh: "สร้าง Folder Structure", descriptionTh: "สร้างโครงสร้างโฟลเดอร์ตามหมวดหมู่ที่พบ", enabled: true },
    { key: "desktop-audit", labelTh: "ตรวจสอบ Desktop ที่รก", descriptionTh: "สแกนไฟล์ค้างบน Desktop และเสนอแผนจัดระเบียบ", enabled: true },
  ];

  async onEvent(event: AgentEvent): Promise<void> {
    if (event.name === "file.imported") {
      await this.runCapability("auto-organize", event.payload);
    }
  }

  async runCapability(key: string, _payload?: unknown): Promise<AgentRunResult> {
    // Rule matching against folder_rules lives in rules-engine.ts (see docs/agent-office/04-component-structure.md).
    this.setStatus({ state: "working", message: "กำลังจัดหมวดหมู่ไฟล์" });

    if (this.ctx) {
      await this.ctx.eventBus.publish({
        name: "file.organized",
        sourceAgent: this.code,
        userId: this.ctx.userId,
        payload: { capability: key },
        createdAt: new Date().toISOString(),
      });
    }

    this.setStatus({ state: "idle", lastRunAt: new Date().toISOString() });
    return { success: true, summaryTh: "จัดหมวดหมู่ไฟล์เรียบร้อย" };
  }
}
