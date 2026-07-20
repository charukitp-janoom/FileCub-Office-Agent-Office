import { randomUUID } from "node:crypto";
import { BaseAgent } from "../../agent-core/base-agent";
import type { AgentCapability, AgentCode, AgentEvent, AgentRunResult } from "../../agent-core/types";
import type { AgentDb } from "../../shared/db/client";
import { AnomalyDetector } from "./anomaly-detector";
import { grantPermission, setUserRole, type Role } from "./rbac.service";

export interface RolePermissionPayload {
  action: "set-role" | "grant";
  targetUserId: string;
  role?: Role;
  resourceType?: string;
  accessLevel?: "read" | "write" | "admin";
  resourceId?: string;
}

export interface ProtectFilePayload {
  fileId: string;
  reasonTh?: string;
}

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

  private anomalyDetector = new AnomalyDetector();

  /** Watches for repeated permission denials and escalates to a security.anomaly event. */
  async onEvent(event: AgentEvent): Promise<void> {
    if (event.name !== "security.permission_denied" || !this.ctx) return;

    const payload = event.payload as { userId?: string; action?: string };
    const userId = payload.userId ?? event.userId;
    if (!this.anomalyDetector.record(userId)) return;

    const db = this.ctx.db.raw as AgentDb;
    db.prepare(`
      INSERT INTO security_events (id, user_id, event_type, severity, description_th, metadata_json)
      VALUES (?, ?, 'anomaly', 'critical', ?, ?)
    `).run(randomUUID(), userId, "พบการปฏิเสธสิทธิ์ซ้ำหลายครั้งในเวลาสั้น", JSON.stringify({ lastAction: payload.action }));

    await this.ctx.eventBus.publish({
      name: "security.anomaly",
      sourceAgent: this.code,
      userId,
      payload: { reasonTh: "พบการปฏิเสธสิทธิ์ซ้ำหลายครั้งในเวลาสั้น" },
      createdAt: new Date().toISOString(),
    });
  }

  async runCapability(key: string, payload?: unknown): Promise<AgentRunResult> {
    if (!this.ctx) return { success: false, summaryTh: "Security Agent ยังไม่พร้อมใช้งาน" };
    const db = this.ctx.db.raw as AgentDb;

    switch (key) {
      case "role-permission":
        return this.handleRolePermission(db, payload as RolePermissionPayload);
      case "activity-log":
        return this.handleActivityLog(db);
      case "anomaly-detection":
        return this.handleAnomalyStatus(db);
      case "protect-file":
        return this.handleProtectFile(db, payload as ProtectFilePayload);
      default:
        return { success: false, summaryTh: `ไม่รู้จักความสามารถ "${key}"` };
    }
  }

  private handleRolePermission(db: AgentDb, payload: RolePermissionPayload): AgentRunResult {
    if (!payload?.targetUserId) return { success: false, summaryTh: "ต้องระบุผู้ใช้เป้าหมาย (targetUserId)" };

    if (payload.action === "set-role") {
      if (!payload.role) return { success: false, summaryTh: "ต้องระบุ role" };
      setUserRole(db, payload.targetUserId, payload.role);
      return { success: true, summaryTh: `เปลี่ยนสิทธิ์ผู้ใช้ ${payload.targetUserId} เป็น ${payload.role} แล้ว` };
    }

    if (payload.action === "grant") {
      if (!payload.resourceType || !payload.accessLevel) {
        return { success: false, summaryTh: "ต้องระบุ resourceType และ accessLevel" };
      }
      grantPermission(db, this.ctx!.userId, payload.targetUserId, payload.resourceType, payload.accessLevel, payload.resourceId);
      return { success: true, summaryTh: `ให้สิทธิ์ ${payload.accessLevel} บน ${payload.resourceType} แก่ ${payload.targetUserId} แล้ว` };
    }

    return { success: false, summaryTh: `ไม่รู้จัก action "${payload.action}"` };
  }

  private handleActivityLog(db: AgentDb): AgentRunResult {
    const rows = db
      .prepare("SELECT event_type, severity, description_th FROM security_events ORDER BY created_at DESC LIMIT 10")
      .all() as Array<{ event_type: string; severity: string; description_th: string }>;
    return { success: true, summaryTh: `พบ ${rows.length} เหตุการณ์ล่าสุด`, data: { events: rows } };
  }

  private handleAnomalyStatus(db: AgentDb): AgentRunResult {
    const row = db
      .prepare("SELECT COUNT(*) as count FROM security_events WHERE severity = 'critical'")
      .get() as { count: number };
    return { success: true, summaryTh: `พบความผิดปกติสะสม ${row.count} ครั้ง`, data: { anomalyCount: row.count } };
  }

  private handleProtectFile(db: AgentDb, payload: ProtectFilePayload): AgentRunResult {
    if (!payload?.fileId) return { success: false, summaryTh: "ต้องระบุไฟล์ที่จะป้องกัน (fileId)" };
    db.prepare(`
      INSERT INTO protected_files (file_id, protected_by, reason_th)
      VALUES (?, ?, ?)
      ON CONFLICT(file_id) DO UPDATE SET protected_by = excluded.protected_by, reason_th = excluded.reason_th
    `).run(payload.fileId, this.ctx!.userId, payload.reasonTh ?? null);
    return { success: true, summaryTh: "ป้องกันไฟล์เรียบร้อย" };
  }
}
