import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { InProcessEventBus } from "../../agent-core/event-bus";
import { attachActivityLogger } from "../../agent-core/activity-logger";
import { openDb } from "../../shared/db/client";
import { runMigrations } from "../../shared/db/migrate";
import { seedAgents, seedFileCategories, seedAchievements, ensureUser } from "../../shared/db/seed";
import { SqliteActivityLogWriter } from "../../shared/db/activity-log.repository";

import { FolderAgent } from "../folder-agent/folder-agent";
import { UploadAgent } from "./upload-agent";

test("Desktop Auto Import: dropping a file into the watched folder gets it organized automatically", async () => {
  const db = openDb(":memory:");
  runMigrations(db);

  const folder = new FolderAgent();
  const upload = new UploadAgent();
  seedAgents(db, [folder, upload]);
  seedFileCategories(db);
  seedAchievements(db);
  ensureUser(db, "user-1");

  const bus = new InProcessEventBus();
  attachActivityLogger(bus, new SqliteActivityLogWriter(db));

  const ctx = {
    userId: "user-1",
    eventBus: bus,
    db: { agentId: "upload" as const, raw: db },
    permissions: { check: async () => {} },
    logger: { info: () => {}, error: () => {} },
  };
  await upload.init(ctx);
  await folder.init({ ...ctx, db: { agentId: "folder" as const, raw: db } });
  bus.subscribe("file.imported", (e) => void folder.onEvent?.(e));

  const organized: Array<{ fileName: string; categoryNameTh: string }> = [];
  bus.subscribe("file.organized", (e) => organized.push(e.payload as { fileName: string; categoryNameTh: string }));

  const desktop = mkdtempSync(join(tmpdir(), "filecub-desktop-watch-"));
  upload.enableDesktopWatch(desktop);
  await upload.waitUntilDesktopWatchReady();

  try {
    // Simulates the poster's "before" state: a messy desktop with a fresh report file.
    writeFileSync(join(desktop, "report-final.docx"), "dummy content");

    // chokidar's awaitWriteFinish + fs event delivery is asynchronous; poll
    // briefly instead of a fixed sleep so the test isn't flaky on slower CI.
    for (let i = 0; i < 50 && organized.length === 0; i++) {
      await delay(100);
    }

    assert.deepEqual(
      organized.map((o) => ({ fileName: o.fileName, categoryNameTh: o.categoryNameTh })),
      [{ fileName: "report-final.docx", categoryNameTh: "เอกสารรายงาน" }],
    );
  } finally {
    await upload.disableDesktopWatch();
  }
});
