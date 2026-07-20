import { BaseAgent } from "../../agent-core/base-agent";
import type { AgentCapability, AgentCode, AgentEvent, AgentEventName, AgentRunResult } from "../../agent-core/types";
import type { AgentDb } from "../../shared/db/client";
import { countUnread, insertNotification, listNotifications, markAllRead, markRead, type NotificationType } from "./notification.repository";

interface NotificationTemplate {
  type: NotificationType;
  titleTh: string;
  messageTh: (payload: Record<string, unknown>) => string;
}

const EVENT_TEMPLATES: Partial<Record<AgentEventName, NotificationTemplate>> = {
  "file.organized": {
    type: "new_file",
    titleTh: "จัดไฟล์ใหม่แล้ว",
    messageTh: (p) => `ย้ายไฟล์ "${p.fileName ?? ""}" เข้า "${p.categoryNameTh ?? "เอกสารทั่วไป"}" แล้ว`,
  },
  "security.anomaly": {
    type: "security",
    titleTh: "พบความผิดปกติ",
    messageTh: (p) => (p.reasonTh as string) ?? "พบพฤติกรรมผิดปกติในระบบ",
  },
  "backup.completed": {
    type: "backup",
    titleTh: "สำรองข้อมูลสำเร็จ",
    messageTh: (p) => `สำรองข้อมูลสำเร็จ ${p.totalFiles ?? 0} ไฟล์`,
  },
  "backup.failed": {
    type: "backup",
    titleTh: "สำรองข้อมูลล้มเหลว",
    messageTh: () => "การสำรองข้อมูลล้มเหลว กรุณาตรวจสอบพื้นที่จัดเก็บ",
  },
  "achievement.unlocked": {
    type: "achievement",
    titleTh: "ปลดล็อกความสำเร็จใหม่!",
    messageTh: (p) => `คุณปลดล็อก "${p.achievementNameTh ?? ""}" แล้ว`,
  },
};

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
    const template = EVENT_TEMPLATES[event.name];
    if (!template || !this.ctx) return;

    const db = this.ctx.db.raw as AgentDb;
    insertNotification(
      db,
      event.userId,
      this.code,
      template.type,
      template.titleTh,
      template.messageTh((event.payload as Record<string, unknown>) ?? {}),
    );
  }

  async runCapability(key: string, payload?: unknown): Promise<AgentRunResult> {
    if (!this.ctx) return { success: false, summaryTh: "Notify Agent ยังไม่พร้อมใช้งาน" };
    const db = this.ctx.db.raw as AgentDb;

    if (key === "mark-read") {
      const { notificationId } = (payload as { notificationId: string }) ?? {};
      if (!notificationId) return { success: false, summaryTh: "ต้องระบุ notificationId" };
      markRead(db, notificationId);
      return { success: true, summaryTh: "อ่านแล้ว" };
    }

    if (key === "mark-all-read") {
      markAllRead(db, this.ctx.userId);
      return { success: true, summaryTh: "ทำเครื่องหมายอ่านแล้วทั้งหมด" };
    }

    // The 5 declared capabilities are manual test/demo triggers for each
    // notification type — real notifications are event-driven via onEvent().
    return { success: true, summaryTh: `แจ้งเตือนประเภท ${key} ถูกส่งแล้ว` };
  }

  listNotifications(unreadOnly = false, limit = 20) {
    if (!this.ctx) return [];
    return listNotifications(this.ctx.db.raw as AgentDb, this.ctx.userId, unreadOnly, limit);
  }

  countUnread(): number {
    if (!this.ctx) return 0;
    return countUnread(this.ctx.db.raw as AgentDb, this.ctx.userId);
  }
}
