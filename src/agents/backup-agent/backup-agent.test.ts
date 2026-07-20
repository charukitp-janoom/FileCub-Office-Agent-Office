import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { InProcessEventBus } from "../../agent-core/event-bus";
import { openDb } from "../../shared/db/client";
import { runMigrations } from "../../shared/db/migrate";
import { seedAgents, seedFileCategories, seedAchievements, ensureUser } from "../../shared/db/seed";

import { UploadAgent } from "../upload-agent/upload-agent";
import { BackupAgent } from "./backup-agent";

async function setup() {
  const db = openDb(":memory:");
  runMigrations(db);

  const upload = new UploadAgent();
  const backupDir = mkdtempSync(join(tmpdir(), "filecub-backups-"));
  const backup = new BackupAgent(backupDir);
  seedAgents(db, [upload, backup]);
  seedFileCategories(db);
  seedAchievements(db);
  ensureUser(db, "user-1");

  const bus = new InProcessEventBus();
  const ctx = {
    userId: "user-1",
    eventBus: bus,
    db: { agentId: "upload" as const, raw: db },
    permissions: { check: async () => {} },
    logger: { info: () => {}, error: () => {} },
  };
  await upload.init(ctx);
  await backup.init({ ...ctx, db: { agentId: "backup" as const, raw: db } });

  const desktop = mkdtempSync(join(tmpdir(), "filecub-backup-src-"));
  const filePath = join(desktop, "report-final.docx");
  writeFileSync(filePath, "version 1");
  const imported = await upload.runCapability("manual-upload", { sourcePath: filePath });
  const fileId = (imported.data as { fileId: string }).fileId;

  return { db, backup, backupDir, fileId, filePath, bus };
}

test("auto-backup copies every active file and records a version + completed job", async () => {
  const { db, backup, fileId } = await setup();
  const result = await backup.runCapability("auto-backup");
  assert.equal(result.success, true);
  assert.match(result.summaryTh, /1 ไฟล์/);

  const versions = db.prepare("SELECT version_no FROM backup_versions WHERE file_id = ?").all(fileId) as Array<{
    version_no: number;
  }>;
  assert.deepEqual(versions.map((v) => v.version_no), [1]);

  const job = db.prepare("SELECT status, total_files FROM backup_jobs ORDER BY started_at DESC LIMIT 1").get() as {
    status: string;
    total_files: number;
  };
  assert.equal(job.status, "completed");
  assert.equal(job.total_files, 1);
});

test("version-backup on the same file increments version_no each call", async () => {
  const { db, backup, fileId } = await setup();
  await backup.runCapability("version-backup", { fileId });
  await backup.runCapability("version-backup", { fileId });

  const versions = db.prepare("SELECT version_no FROM backup_versions WHERE file_id = ? ORDER BY version_no").all(fileId) as Array<{
    version_no: number;
  }>;
  assert.deepEqual(versions.map((v) => v.version_no), [1, 2]);
});

test("restore-file reverts a file's content to its latest backed-up version", async () => {
  const { backup, fileId, filePath } = await setup();
  await backup.runCapability("auto-backup"); // backs up "version 1"

  writeFileSync(filePath, "version 2 - accidentally overwritten");
  const restoreResult = await backup.runCapability("restore-file", { fileId });
  assert.equal(restoreResult.success, true);
  assert.equal(readFileSync(filePath, "utf8"), "version 1");
});

test("storage-check reports used bytes after a backup", async () => {
  const { backup } = await setup();
  const before = await backup.runCapability("storage-check");
  assert.equal((before.data as { usedBytes: number }).usedBytes, 0);

  await backup.runCapability("auto-backup");
  const after = await backup.runCapability("storage-check");
  assert.ok((after.data as { usedBytes: number }).usedBytes > 0);
});

test("backup.completed is published after a backup run", async () => {
  const { backup, bus } = await setup();
  const events: string[] = [];
  bus.subscribe("backup.completed", (e) => events.push(e.name));
  await backup.runCapability("auto-backup");
  assert.deepEqual(events, ["backup.completed"]);
});

test("BackupScheduler runs the backup periodically until stopped", async () => {
  const { db, backup, fileId } = await setup();
  backup.enableAutoBackup(80);
  await delay(300);
  backup.disableAutoBackup();

  const versionsAfterStop = (
    db.prepare("SELECT COUNT(*) as count FROM backup_versions WHERE file_id = ?").get(fileId) as { count: number }
  ).count;
  assert.ok(versionsAfterStop >= 2, `expected the scheduler to have run more than once, got ${versionsAfterStop}`);

  await delay(300); // if the scheduler weren't actually stopped, more versions would show up
  const versionsLater = (
    db.prepare("SELECT COUNT(*) as count FROM backup_versions WHERE file_id = ?").get(fileId) as { count: number }
  ).count;
  assert.equal(versionsLater, versionsAfterStop);
});
