import { test } from "node:test";
import assert from "node:assert/strict";

import { AgentRegistry } from "./registry";
import { InProcessEventBus } from "./event-bus";
import { attachActivityLogger } from "./activity-logger";
import { AchievementEngine } from "./achievement-engine";
import { SqlitePermissionChecker, PermissionDeniedError } from "./permission-checker";

import { openDb } from "../shared/db/client";
import { runMigrations } from "../shared/db/migrate";
import { seedAchievements, seedAgents, seedFileCategories, ensureUser } from "../shared/db/seed";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteActivityLogWriter } from "../shared/db/activity-log.repository";

import { FolderAgent } from "../agents/folder-agent/folder-agent";
import { SearchAgent } from "../agents/search-agent/search-agent";
import { UploadAgent } from "../agents/upload-agent/upload-agent";
import { SecurityAgent } from "../agents/security-agent/security-agent";
import { AiAgent } from "../agents/ai-agent/ai-agent";
import { NotifyAgent } from "../agents/notify-agent/notify-agent";
import { BackupAgent } from "../agents/backup-agent/backup-agent";

function setupDb() {
  const db = openDb(":memory:");
  runMigrations(db);
  // agent_activity_logs.agent_id has a foreign key on agents(id), so tests
  // seed the same 7 agents bootstrap.ts would register in production.
  seedAgents(db, [
    new FolderAgent(),
    new SearchAgent(),
    new UploadAgent(),
    new SecurityAgent(),
    new AiAgent(),
    new NotifyAgent(),
    new BackupAgent(),
  ]);
  seedAchievements(db);
  seedFileCategories(db);
  ensureUser(db, "user-1");
  return db;
}

test("AgentRegistry rejects duplicate registration", () => {
  const registry = new AgentRegistry();
  registry.register(new FolderAgent());
  assert.throws(() => registry.register(new FolderAgent()));
  assert.equal(registry.list().length, 1);
  assert.equal(registry.get("folder")?.nicknameTh, "น้องโฟลเดอร์");
});

test("InProcessEventBus delivers events only to matching subscribers", async () => {
  const bus = new InProcessEventBus();
  const received: string[] = [];
  bus.subscribe("file.organized", (e) => received.push(e.name));
  bus.subscribe("backup.completed", (e) => received.push(e.name));

  await bus.publish({
    name: "file.organized",
    sourceAgent: "folder",
    userId: "user-1",
    payload: {},
    createdAt: new Date().toISOString(),
  });

  assert.deepEqual(received, ["file.organized"]);
});

test("activity logger persists every published event to agent_activity_logs", async () => {
  const db = setupDb();
  const bus = new InProcessEventBus();
  const writer = new SqliteActivityLogWriter(db);
  attachActivityLogger(bus, writer);

  await bus.publish({
    name: "file.searched",
    sourceAgent: "search",
    userId: "user-1",
    payload: { query: "รายงาน" },
    createdAt: new Date().toISOString(),
  });

  assert.equal(writer.countForUser("user-1", "file.searched"), 1);
});

test("achievement engine unlocks an achievement once its threshold is reached", async () => {
  const db = setupDb();
  const bus = new InProcessEventBus();
  const writer = new SqliteActivityLogWriter(db);
  attachActivityLogger(bus, writer);

  const engine = new AchievementEngine(db, writer);
  engine.attach(bus);

  const unlocked: string[] = [];
  bus.subscribe("achievement.unlocked", (e) => {
    unlocked.push((e.payload as { achievementCode: string }).achievementCode);
  });

  // SEARCH_MASTER unlocks at 500 file.searched events — seed that many rows directly
  // to keep the test fast, then publish the event that should tip it over.
  const insert = db.prepare(
    "INSERT INTO agent_activity_logs (id, agent_id, user_id, event_name, summary_th) VALUES (?, 'search', 'user-1', 'file.searched', 'x')",
  );
  for (let i = 0; i < 499; i++) {
    insert.run(`seed-${i}`);
  }

  await bus.publish({
    name: "file.searched",
    sourceAgent: "search",
    userId: "user-1",
    payload: { query: "งบประมาณ" },
    createdAt: new Date().toISOString(),
  });

  assert.deepEqual(unlocked, ["SEARCH_MASTER"]);

  const level = db.prepare("SELECT current_exp, level_name FROM user_levels WHERE user_id = ?").get("user-1") as {
    current_exp: number;
    level_name: string;
  };
  assert.equal(level.current_exp, 200);
  assert.equal(level.level_name, "Beginner");
});

test("SqlitePermissionChecker denies unauthorized action and logs the attempt", async () => {
  const db = setupDb();
  db.prepare("INSERT INTO users (id, username, display_name, role) VALUES ('user-2', 'staff1', 'Staff One', 'staff')").run();

  const checker = new SqlitePermissionChecker(db);
  await assert.rejects(() => checker.check("user-2", "file:delete", "file-1"), PermissionDeniedError);

  const events = db.prepare("SELECT severity FROM security_events WHERE user_id = 'user-2'").all() as Array<{
    severity: string;
  }>;
  assert.equal(events.length, 1);
  assert.equal(events[0].severity, "warning");
});

test("SqlitePermissionChecker allows admins unconditionally", async () => {
  const db = setupDb(); // ensureUser() seeds user-1 as admin
  const checker = new SqlitePermissionChecker(db);
  await assert.doesNotReject(() => checker.check("user-1", "file:delete", "file-1"));
});

function noopContext(db: ReturnType<typeof setupDb>, bus: InProcessEventBus, userId = "user-1") {
  return {
    userId,
    eventBus: bus,
    db: { agentId: "folder" as const, raw: db },
    permissions: { check: async () => {} },
    logger: { info: () => {}, error: () => {} },
  };
}

test("UploadAgent imports a real file and FolderAgent auto-organizes it by the poster's before/after rules", async () => {
  const db = setupDb();
  const bus = new InProcessEventBus();
  const writer = new SqliteActivityLogWriter(db);
  attachActivityLogger(bus, writer);

  const upload = new UploadAgent();
  await upload.init(noopContext(db, bus));

  const folder = new FolderAgent();
  await folder.init(noopContext(db, bus));
  bus.subscribe("file.imported", (e) => void folder.onEvent?.(e));

  const organized: Array<{ fileName: string; categoryNameTh: string }> = [];
  bus.subscribe("file.organized", (e) => organized.push(e.payload as { fileName: string; categoryNameTh: string }));

  const dir = mkdtempSync(join(tmpdir(), "filecub-desktop-"));
  writeFileSync(join(dir, "report-final.docx"), "dummy content");
  writeFileSync(join(dir, "scan001.pdf"), "dummy content");
  writeFileSync(join(dir, "IMG001.jpg"), "dummy content");

  for (const name of ["report-final.docx", "scan001.pdf", "IMG001.jpg"]) {
    const result = await upload.runCapability("manual-upload", { sourcePath: join(dir, name) });
    assert.equal(result.success, true);
  }

  assert.deepEqual(
    organized.map((o) => [o.fileName, o.categoryNameTh]).sort(),
    [
      ["IMG001.jpg", "รูปภาพ"],
      ["report-final.docx", "เอกสารรายงาน"],
      ["scan001.pdf", "เอกสารสแกน"],
    ].sort(),
  );

  // Re-importing the same path is a no-op, not a duplicate.
  const duplicate = await upload.runCapability("manual-upload", { sourcePath: join(dir, "report-final.docx") });
  assert.equal(duplicate.success, false);
});

test("UploadAgent rejects files that fail validation", async () => {
  const db = setupDb();
  const bus = new InProcessEventBus();
  const upload = new UploadAgent();
  await upload.init(noopContext(db, bus));

  const result = await upload.runCapability("manual-upload", { sourcePath: "/nonexistent/path.pdf" });
  assert.equal(result.success, false);
  assert.match(result.summaryTh, /ไม่พบไฟล์/);
});

test("SearchAgent reports result counts", async () => {
  const db = setupDb();
  const bus = new InProcessEventBus();
  const search = new SearchAgent();
  await search.init(noopContext(db, bus));
  const result = await search.runCapability("search-by-name", { query: "test" });
  assert.equal(result.success, true);
  assert.match(result.summaryTh, /พบ \d+ รายการ/);
});
