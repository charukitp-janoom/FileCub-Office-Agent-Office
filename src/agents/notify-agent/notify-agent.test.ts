import { test } from "node:test";
import assert from "node:assert/strict";

import { InProcessEventBus } from "../../agent-core/event-bus";
import { openDb } from "../../shared/db/client";
import { runMigrations } from "../../shared/db/migrate";
import { seedAgents, seedFileCategories, seedAchievements, ensureUser } from "../../shared/db/seed";

import { NotifyAgent } from "./notify-agent";

async function setup() {
  const db = openDb(":memory:");
  runMigrations(db);
  const notify = new NotifyAgent();
  seedAgents(db, [notify]);
  seedFileCategories(db);
  seedAchievements(db);
  ensureUser(db, "user-1");

  const bus = new InProcessEventBus();
  await notify.init({
    userId: "user-1",
    eventBus: bus,
    db: { agentId: "notify" as const, raw: db },
    permissions: { check: async () => {} },
    logger: { info: () => {}, error: () => {} },
  });

  return { db, notify, bus };
}

test("file.organized creates a new_file notification with the real filename/category", async () => {
  const { notify } = await setup();
  await notify.onEvent!({
    name: "file.organized",
    sourceAgent: "folder",
    userId: "user-1",
    payload: { fileName: "report-final.docx", categoryNameTh: "เอกสารรายงาน" },
    createdAt: new Date().toISOString(),
  });

  const list = notify.listNotifications();
  assert.equal(list.length, 1);
  assert.equal(list[0].type, "new_file");
  assert.match(list[0].messageTh, /report-final\.docx.*เอกสารรายงาน/);
  assert.equal(list[0].isRead, false);
});

test("backup.completed and security.anomaly map to their own notification types", async () => {
  const { notify } = await setup();
  await notify.onEvent!({
    name: "backup.completed",
    sourceAgent: "backup",
    userId: "user-1",
    payload: { totalFiles: 3 },
    createdAt: new Date().toISOString(),
  });
  await notify.onEvent!({
    name: "security.anomaly",
    sourceAgent: "security",
    userId: "user-1",
    payload: { reasonTh: "พบการปฏิเสธสิทธิ์ซ้ำหลายครั้ง" },
    createdAt: new Date().toISOString(),
  });

  const types = notify.listNotifications().map((n) => n.type).sort();
  assert.deepEqual(types, ["backup", "security"]);
});

test("achievement.unlocked creates an achievement-type notification", async () => {
  const { notify } = await setup();
  await notify.onEvent!({
    name: "achievement.unlocked",
    sourceAgent: "folder",
    userId: "user-1",
    payload: { achievementCode: "DESKTOP_CLEANER", achievementNameTh: "Desktop Cleaner" },
    createdAt: new Date().toISOString(),
  });

  const [item] = notify.listNotifications();
  assert.equal(item.type, "achievement");
  assert.match(item.messageTh, /Desktop Cleaner/);
});

test("unrelated events (e.g. file.searched) do not create notifications", async () => {
  const { notify } = await setup();
  await notify.onEvent!({
    name: "file.searched",
    sourceAgent: "search",
    userId: "user-1",
    payload: { query: "x" },
    createdAt: new Date().toISOString(),
  });
  assert.equal(notify.listNotifications().length, 0);
});

test("mark-read and mark-all-read update is_read and countUnread", async () => {
  const { notify } = await setup();
  await notify.onEvent!({
    name: "backup.completed",
    sourceAgent: "backup",
    userId: "user-1",
    payload: { totalFiles: 1 },
    createdAt: new Date().toISOString(),
  });
  await notify.onEvent!({
    name: "backup.failed",
    sourceAgent: "backup",
    userId: "user-1",
    payload: {},
    createdAt: new Date().toISOString(),
  });

  assert.equal(notify.countUnread(), 2);

  const [first] = notify.listNotifications();
  await notify.runCapability("mark-read", { notificationId: first.id });
  assert.equal(notify.countUnread(), 1);

  await notify.runCapability("mark-all-read");
  assert.equal(notify.countUnread(), 0);
});
