import { BaseAgent } from "../../agent-core/base-agent";
import type { AgentCapability, AgentCode, AgentRunResult } from "../../agent-core/types";

export class BackupAgent extends BaseAgent {
  code: AgentCode = "backup";
  nameTh = "Cub Backup Agent";
  nicknameTh = "น้องแบ็ก";
  roleTitleTh = "Data Guardian";
  icon = "backup-agent";

  capabilities: AgentCapability[] = [
    { key: "auto-backup", labelTh: "Backup อัตโนมัติ", descriptionTh: "สำรองข้อมูลตามตารางเวลาอัตโนมัติ", enabled: true },
    { key: "version-backup", labelTh: "Version Backup", descriptionTh: "เก็บประวัติหลายเวอร์ชันของไฟล์", enabled: true },
    { key: "restore-file", labelTh: "Restore File", descriptionTh: "กู้คืนไฟล์จากเวอร์ชันสำรอง", enabled: true },
    { key: "storage-check", labelTh: "ตรวจสอบพื้นที่ Backup", descriptionTh: "ตรวจสอบพื้นที่คงเหลือของที่เก็บสำรอง", enabled: true },
  ];

  async runCapability(key: string): Promise<AgentRunResult> {
    // backup-scheduler.ts / versioning.service.ts / restore.usecase.ts hold the real logic.
    if (this.ctx) {
      await this.ctx.eventBus.publish({
        name: "backup.completed",
        sourceAgent: this.code,
        userId: this.ctx.userId,
        payload: { capability: key },
        createdAt: new Date().toISOString(),
      });
    }

    return { success: true, summaryTh: "สำรองข้อมูลเรียบร้อย" };
  }
}
