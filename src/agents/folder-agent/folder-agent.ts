import { BaseAgent } from "../../agent-core/base-agent";
import type { AgentCapability, AgentCode, AgentEvent, AgentRunResult } from "../../agent-core/types";
import type { AgentDb } from "../../shared/db/client";
import { matchCategory } from "./rules-engine";
import { getCategory, getFile, organizeFile } from "./folder-agent.repository";

export interface OrganizePayload {
  fileId: string;
}

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
      const payload = event.payload as { fileId?: string };
      if (payload.fileId) {
        await this.runCapability("auto-organize", { fileId: payload.fileId } satisfies OrganizePayload);
      }
    }
  }

  async runCapability(key: string, payload?: unknown): Promise<AgentRunResult> {
    if (key !== "auto-organize") {
      return { success: true, summaryTh: `รัน ${key} เรียบร้อย` };
    }

    const { fileId } = (payload as OrganizePayload) ?? {};
    if (!fileId || !this.ctx) {
      return { success: false, summaryTh: "ต้องระบุไฟล์ที่จะจัดหมวดหมู่ (fileId)" };
    }

    this.setStatus({ state: "working", message: "กำลังจัดหมวดหมู่ไฟล์" });
    const db = this.ctx.db.raw as AgentDb;

    const file = getFile(db, fileId);
    if (!file) {
      this.setStatus({ state: "idle" });
      return { success: false, summaryTh: "ไม่พบไฟล์ที่ระบุ" };
    }

    const categoryId = matchCategory(db, file.name);
    organizeFile(db, fileId, categoryId);
    const category = getCategory(db, categoryId);
    const categoryNameTh = category?.name_th ?? "เอกสารทั่วไป";

    await this.ctx.eventBus.publish({
      name: "file.organized",
      sourceAgent: this.code,
      userId: this.ctx.userId,
      payload: { fileId, fileName: file.name, categoryId, categoryNameTh },
      createdAt: new Date().toISOString(),
    });

    this.setStatus({ state: "idle", lastRunAt: new Date().toISOString() });
    return { success: true, summaryTh: `ย้ายไฟล์ "${file.name}" เข้า "${categoryNameTh}" แล้ว` };
  }
}
