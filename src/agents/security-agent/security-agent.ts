import { BaseAgent } from "../../agent-core/base-agent";
import type { AgentCapability, AgentCode, AgentRunResult } from "../../agent-core/types";

export type Role = "admin" | "staff" | "viewer";

export class SecurityAgent extends BaseAgent {
  code: AgentCode = "security";
  nameTh = "Cub Security Agent";
  nicknameTh = "น้องชิลด์";
  roleTitleTh = "Data Protection Officer";
  icon = "security-agent";

  capabilities: AgentCapability[] = [
    { key: "role-permission", labelTh: "Role Permission", descriptionTh: "จัดการสิทธิ์ Admin / Staff / Viewer", enabled: true },
    { key: "activity-log", labelTh: "Activity Log", descriptionTh: "บันทึกการเข้าถึงและการเปลี่ยนแปลงข้อมูล", enabled: true },
    { key: "anomaly-detection", labelTh: "ตรวจสอบความผิดปกติ", descriptionTh: "แจ้งเตือนเมื่อพบพฤติกรรมผิดปกติ", enabled: true },
    { key: "protect-file", labelTh: "ป้องกันไฟล์สำคัญ", descriptionTh: "ล็อกไฟล์สำคัญไม่ให้ถูกลบ/แก้ไขโดยไม่ได้รับอนุญาต", enabled: true },
  ];

  /**
   * Called by other agents (via AgentContext.permissions) before any
   * impactful action. Every check — allow or deny — is expected to be
   * persisted to security_events by the concrete implementation.
   */
  async check(userId: string, action: string, resourceId?: string): Promise<void> {
    void userId;
    void action;
    void resourceId;
    // rbac.service.ts implements the actual role/resource lookup.
  }

  async runCapability(key: string): Promise<AgentRunResult> {
    return { success: true, summaryTh: `รัน ${key} เรียบร้อย` };
  }
}
