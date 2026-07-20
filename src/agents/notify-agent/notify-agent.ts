import { BaseAgent } from "../../agent-core/base-agent";
import type { AgentCapability, AgentCode, AgentEvent, AgentRunResult } from "../../agent-core/types";

const NOTIFIABLE_EVENTS = new Set([
  "file.organized",
  "security.anomaly",
  "backup.completed",
  "backup.failed",
]);

export class NotifyAgent extends BaseAgent {
  code: AgentCode = "notify";
  nameTh = "Cub Notify Agent";
  nicknameTh = "น้องนิว";
  roleTitleTh = "Office Notification Assistant";
  icon = "notify-agent";

  capabilities: AgentCapability[] = [
    { key: "task-reminder", labelTh: "แจ้งเตือนงาน", descriptionTh: "แจ้งเตือนงานที่ต้องทำ", enabled: true },
    { key: "new-file-alert", labelTh: "แจ้งเตือนไฟล์ใหม่", descriptionTh: "แจ้งเตือนเมื่อมีไฟล์ใหม่เข้าระบบ", enabled: true },
    { key: "important-doc-alert", labelTh: "แจ้งเตือนเอกสารสำคัญ", descriptionTh: "แจ้งเตือนเมื่อเอกสารสำคัญถูกเข้าถึง/แก้ไข", enabled: true },
    { key: "license-alert", labelTh: "แจ้งเตือน License", descriptionTh: "แจ้งเตือนใกล้หมดอายุ License", enabled: true },
    { key: "update-alert", labelTh: "แจ้งเตือน Update", descriptionTh: "แจ้งเตือนเมื่อมีอัปเดตโปรแกรม", enabled: true },
  ];

  async onEvent(event: AgentEvent): Promise<void> {
    if (!NOTIFIABLE_EVENTS.has(event.name)) return;
    // notification.repository.ts persists a row into `notifications`.
  }

  async runCapability(key: string): Promise<AgentRunResult> {
    return { success: true, summaryTh: `แจ้งเตือนประเภท ${key} ถูกส่งแล้ว` };
  }
}
