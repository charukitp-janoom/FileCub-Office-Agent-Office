import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { InProcessEventBus } from "../../agent-core/event-bus";
import { SqlitePermissionChecker } from "../../agent-core/permission-checker";
import { openDb } from "../../shared/db/client";
import { runMigrations } from "../../shared/db/migrate";
import { seedAgents, seedFileCategories, seedAchievements, ensureUser } from "../../shared/db/seed";

import { FolderAgent } from "../folder-agent/folder-agent";
import { UploadAgent } from "../upload-agent/upload-agent";
import { SecurityAgent } from "./security-agent";

async function setup() {
  const db = openDb(":memory:");
  runMigrations(db);

  const security = new SecurityAgent();
  const upload = new UploadAgent();
  const folder = new FolderAgent();
  seedAgents(db, [security, upload, folder]);
  seedFileCategories(db);
  seedAchievements(db);
  ensureUser(db, "admin-1", "admin-1", "admin");
  ensureUser(db, "staff-1", "staff-1", "staff");

  const bus = new InProcessEventBus();
  const permissions = new SqlitePermissionChecker(db, bus);

  const ctxFor = (userId: string) => ({
    userId,
    eventBus: bus,
    db: { agentId: "security" as const, raw: db },
    permissions,
    logger: { info: () => {}, error: () => {} },
  });

  await security.init(ctxFor("admin-1"));
  bus.subscribe("security.permission_denied", (e) => void security.onEvent?.(e));

  return { db, bus, security, upload, folder, permissions, ctxFor };
}

test("role-permission: set-role changes a user's role", async () => {
  const { db, security } = await setup();
  const result = await security.runCapability("role-permission", {
    action: "set-role",
    targetUserId: "staff-1",
    role: "admin",
  });
  assert.equal(result.success, true);
  const row = db.prepare("SELECT role FROM users WHERE id = 'staff-1'").get() as { role: string };
  assert.equal(row.role, "admin");
});

test("role-permission: grant lets a staff user pass a permission check afterwards", async () => {
  const { db, security, permissions } = await setup();
  await assert.rejects(() => permissions.check("staff-1", "file:import"));

  const result = await security.runCapability("role-permission", {
    action: "grant",
    targetUserId: "staff-1",
    resourceType: "file",
    accessLevel: "write",
  });
  assert.equal(result.success, true);
  await assert.doesNotReject(() => permissions.check("staff-1", "file:import"));
  void db;
});

test("a read-only grant does not satisfy a write-level check (access_level must actually be enforced)", async () => {
  const { security, permissions } = await setup();

  const grant = await security.runCapability("role-permission", {
    action: "grant",
    targetUserId: "staff-1",
    resourceType: "file",
    accessLevel: "read",
  });
  assert.equal(grant.success, true);

  // Default requiredLevel is "write" — a "read" grant must not pass it.
  await assert.rejects(() => permissions.check("staff-1", "file:import"));
  // But an explicit read-level check should pass.
  await assert.doesNotReject(() => permissions.check("staff-1", "file:view", undefined, "read"));
});

test("protect-file stops Folder Agent from re-organizing that file", async () => {
  const { db, security, upload, folder, ctxFor } = await setup();
  await upload.init(ctxFor("admin-1"));
  await folder.init(ctxFor("admin-1"));

  const dir = mkdtempSync(join(tmpdir(), "filecub-protect-"));
  writeFileSync(join(dir, "report-final.docx"), "dummy");
  const imported = await upload.runCapability("manual-upload", { sourcePath: join(dir, "report-final.docx") });
  const fileId = (imported.data as { fileId: string }).fileId;

  const protect = await security.runCapability("protect-file", { fileId, reasonTh: "เอกสารสำคัญ" });
  assert.equal(protect.success, true);

  const organizeResult = await folder.runCapability("auto-organize", { fileId });
  assert.equal(organizeResult.success, false);
  assert.match(organizeResult.summaryTh, /ถูกป้องกันไว้/);

  const file = db.prepare("SELECT category_id FROM files WHERE id = ?").get(fileId) as { category_id: string | null };
  assert.equal(file.category_id, null);
});

test("repeated permission denials trip the anomaly detector and log a critical security_event", async () => {
  const { db, upload, ctxFor } = await setup();
  await upload.init(ctxFor("staff-1")); // staff-1 has no grants -> every import is denied

  for (let i = 0; i < 3; i++) {
    const result = await upload.runCapability("manual-upload", { sourcePath: "/tmp/whatever.docx" });
    assert.equal(result.success, false);
  }

  const anomalies = db.prepare("SELECT COUNT(*) as count FROM security_events WHERE severity = 'critical'").get() as {
    count: number;
  };
  assert.equal(anomalies.count, 1);
});

test("activity-log and anomaly-detection capabilities report real data", async () => {
  const { db, security } = await setup();
  db.prepare("INSERT INTO security_events (id, user_id, event_type, severity, description_th) VALUES ('e1','admin-1','login','info','x')").run();

  const log = await security.runCapability("activity-log");
  assert.equal(log.success, true);
  assert.ok((log.data as { events: unknown[] }).events.length >= 1);

  const anomalyStatus = await security.runCapability("anomaly-detection");
  assert.equal(anomalyStatus.success, true);
  assert.equal((anomalyStatus.data as { anomalyCount: number }).anomalyCount, 0);
});
