import { BaseAgent } from "../../agent-core/base-agent";
import type { AgentCapability, AgentCode, AgentRunResult } from "../../agent-core/types";
import { PermissionDeniedError } from "../../agent-core/permission-checker";
import type { AgentDb } from "../../shared/db/client";
import { importFile, type FileSource } from "./scan-import.service";
import { DesktopWatcher } from "./desktop-watcher.service";

export interface UploadPayload {
  sourcePath: string;
}

const CAPABILITY_TO_SOURCE: Record<string, FileSource> = {
  "manual-upload": "manual",
  "scan-import": "scan",
  "desktop-auto-import": "desktop_auto",
};

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

  private watcher = new DesktopWatcher();
  private watchedPath?: string;

  async runCapability(key: string, payload?: unknown): Promise<AgentRunResult> {
    const source = CAPABILITY_TO_SOURCE[key];
    const { sourcePath } = (payload as UploadPayload) ?? {};

    if (!source || !sourcePath || !this.ctx) {
      return { success: false, summaryTh: "ต้องระบุไฟล์ต้นทาง (sourcePath)" };
    }

    try {
      await this.ctx.permissions.check(this.ctx.userId, "file:import");
    } catch (error) {
      if (error instanceof PermissionDeniedError) return { success: false, summaryTh: "ไม่มีสิทธิ์นำเข้าไฟล์" };
      throw error;
    }

    const db = this.ctx.db.raw as AgentDb;
    const outcome = importFile(db, this.ctx.userId, sourcePath, source);

    if (!outcome.success) {
      return { success: false, summaryTh: outcome.reasonTh };
    }

    await this.ctx.eventBus.publish({
      name: "file.imported",
      sourceAgent: this.code,
      userId: this.ctx.userId,
      payload: { fileId: outcome.fileId, fileName: outcome.fileName },
      createdAt: new Date().toISOString(),
    });

    return { success: true, summaryTh: `นำเข้าไฟล์ "${outcome.fileName}" เรียบร้อย`, data: { fileId: outcome.fileId } };
  }

  /**
   * Turns on "Desktop Auto Import": watches `watchedPath` and imports every
   * new file that shows up, exactly like the before/after flow on the
   * FileCub Office poster. Safe to call again with a new path — it swaps
   * the watcher rather than stacking listeners.
   */
  enableDesktopWatch(watchedPath: string): void {
    if (!this.ctx) throw new Error("UploadAgent not initialized");
    const db = this.ctx.db.raw as AgentDb;

    db.prepare(`
      INSERT INTO desktop_watch_config (user_id, watched_path, is_enabled)
      VALUES (?, ?, 1)
      ON CONFLICT(user_id) DO UPDATE SET watched_path = excluded.watched_path, is_enabled = 1
    `).run(this.ctx.userId, watchedPath);

    this.watcher.start(watchedPath, (filePath) => {
      void this.runCapability("desktop-auto-import", { sourcePath: filePath } satisfies UploadPayload);
    });
    this.watchedPath = watchedPath;
  }

  getWatchStatus(): { watching: boolean; path?: string } {
    return { watching: this.watcher.isRunning, path: this.watchedPath };
  }

  /** Resolves once the watcher's initial scan is done and new files will reliably be picked up. */
  async waitUntilDesktopWatchReady(): Promise<void> {
    await this.watcher.ready();
  }

  async disableDesktopWatch(): Promise<void> {
    if (this.ctx) {
      const db = this.ctx.db.raw as AgentDb;
      db.prepare("UPDATE desktop_watch_config SET is_enabled = 0 WHERE user_id = ?").run(this.ctx.userId);
    }
    await this.watcher.stop();
    this.watchedPath = undefined;
  }

  async dispose(): Promise<void> {
    await this.watcher.stop();
    await super.dispose();
  }
}
