import { BaseAgent } from "../../agent-core/base-agent";
import type { AgentCapability, AgentCode, AgentRunResult } from "../../agent-core/types";
import type { AgentDb } from "../../shared/db/client";
import { runBackup } from "./versioning.service";
import { restoreFile } from "./restore.usecase";
import { BackupScheduler } from "./backup-scheduler";

export interface VersionBackupPayload {
  fileId: string;
}

export interface RestorePayload {
  fileId: string;
  versionNo?: number;
}

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

  private scheduler = new BackupScheduler();

  constructor(private readonly backupDir: string) {
    super();
  }

  async runCapability(key: string, payload?: unknown): Promise<AgentRunResult> {
    if (!this.ctx) return { success: false, summaryTh: "Backup Agent ยังไม่พร้อมใช้งาน" };
    const db = this.ctx.db.raw as AgentDb;

    switch (key) {
      case "auto-backup":
        return this.handleBackup(db, "manual");
      case "version-backup":
        return this.handleVersionBackup(db, payload as VersionBackupPayload);
      case "restore-file":
        return this.handleRestore(db, payload as RestorePayload);
      case "storage-check":
        return this.handleStorageCheck(db);
      default:
        return { success: false, summaryTh: `ไม่รู้จักความสามารถ "${key}"` };
    }
  }

  private async handleBackup(db: AgentDb, type: "auto" | "manual"): Promise<AgentRunResult> {
    this.setStatus({ state: "working", message: "กำลังสำรองข้อมูล" });
    const result = runBackup(db, this.backupDir, this.ctx!.userId, type);

    await this.ctx!.eventBus.publish({
      name: "backup.completed",
      sourceAgent: this.code,
      userId: this.ctx!.userId,
      payload: { jobId: result.jobId, totalFiles: result.totalFiles, totalBytes: result.totalBytes },
      createdAt: new Date().toISOString(),
    });

    this.setStatus({ state: "idle", lastRunAt: new Date().toISOString() });
    return { success: true, summaryTh: `สำรองข้อมูลสำเร็จ ${result.totalFiles} ไฟล์` };
  }

  private async handleVersionBackup(db: AgentDb, payload: VersionBackupPayload): Promise<AgentRunResult> {
    if (!payload?.fileId) return { success: false, summaryTh: "ต้องระบุไฟล์ที่จะสำรอง (fileId)" };
    const result = runBackup(db, this.backupDir, this.ctx!.userId, "manual", payload.fileId);
    if (result.totalFiles === 0) return { success: false, summaryTh: "ไม่พบไฟล์ที่ระบุ" };

    await this.ctx!.eventBus.publish({
      name: "backup.completed",
      sourceAgent: this.code,
      userId: this.ctx!.userId,
      payload: { jobId: result.jobId, totalFiles: 1, totalBytes: result.totalBytes },
      createdAt: new Date().toISOString(),
    });
    return { success: true, summaryTh: "เก็บเวอร์ชันสำรองของไฟล์เรียบร้อย" };
  }

  private handleRestore(db: AgentDb, payload: RestorePayload): AgentRunResult {
    if (!payload?.fileId) return { success: false, summaryTh: "ต้องระบุไฟล์ที่จะกู้คืน (fileId)" };
    const outcome = restoreFile(db, payload.fileId, payload.versionNo);
    return { success: outcome.success, summaryTh: outcome.reasonTh };
  }

  private handleStorageCheck(db: AgentDb): AgentRunResult {
    const row = db.prepare("SELECT total_capacity_bytes, used_bytes FROM backup_storage_status WHERE id = 1").get() as
      | { total_capacity_bytes: number; used_bytes: number }
      | undefined;
    if (!row) return { success: true, summaryTh: "ยังไม่เคยสำรองข้อมูล", data: { usedBytes: 0 } };

    const usedMb = (row.used_bytes / 1024 / 1024).toFixed(1);
    const totalMb = (row.total_capacity_bytes / 1024 / 1024).toFixed(0);
    return {
      success: true,
      summaryTh: `ใช้พื้นที่สำรอง ${usedMb} MB จาก ${totalMb} MB`,
      data: { usedBytes: row.used_bytes, totalBytes: row.total_capacity_bytes },
    };
  }

  /** Turns on scheduled auto-backups. Not started by default — bootstrap/UI opts in explicitly. */
  enableAutoBackup(intervalMs: number): void {
    if (!this.ctx) throw new Error("BackupAgent not initialized");
    const db = this.ctx.db.raw as AgentDb;
    this.scheduler.start(intervalMs, () => {
      void this.handleBackup(db, "auto");
    });
  }

  disableAutoBackup(): void {
    this.scheduler.stop();
  }

  async dispose(): Promise<void> {
    this.scheduler.stop();
    await super.dispose();
  }
}
