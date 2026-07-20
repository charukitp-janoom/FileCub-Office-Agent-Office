import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { InProcessEventBus } from "../../agent-core/event-bus";
import { attachActivityLogger } from "../../agent-core/activity-logger";
import { openDb } from "../../shared/db/client";
import { runMigrations } from "../../shared/db/migrate";
import { seedAgents, seedFileCategories, seedAchievements, ensureUser } from "../../shared/db/seed";
import { SqliteActivityLogWriter } from "../../shared/db/activity-log.repository";

import { FolderAgent } from "../folder-agent/folder-agent";
import { UploadAgent } from "../upload-agent/upload-agent";
import { SearchAgent } from "./search-agent";

async function setup() {
  const db = openDb(":memory:");
  runMigrations(db);

  const folder = new FolderAgent();
  const upload = new UploadAgent();
  const search = new SearchAgent();
  seedAgents(db, [folder, upload, search]);
  seedFileCategories(db);
  seedAchievements(db);
  ensureUser(db, "user-1");

  const bus = new InProcessEventBus();
  attachActivityLogger(bus, new SqliteActivityLogWriter(db));

  const baseCtx = {
    userId: "user-1",
    eventBus: bus,
    permissions: { check: async () => {} },
    logger: { info: () => {}, error: () => {} },
  };
  await upload.init({ ...baseCtx, db: { agentId: "upload" as const, raw: db } });
  await folder.init({ ...baseCtx, db: { agentId: "folder" as const, raw: db } });
  await search.init({ ...baseCtx, db: { agentId: "search" as const, raw: db } });

  bus.subscribe("file.imported", (e) => void folder.onEvent?.(e));
  bus.subscribe("file.organized", (e) => void search.onEvent?.(e));

  const dir = mkdtempSync(join(tmpdir(), "filecub-search-"));
  writeFileSync(join(dir, "เอกสารคำสั่งเดือนมกราคม.pdf"), "dummy");
  writeFileSync(join(dir, "report-final.docx"), "dummy");
  await upload.runCapability("manual-upload", { sourcePath: join(dir, "เอกสารคำสั่งเดือนมกราคม.pdf") });
  await upload.runCapability("manual-upload", { sourcePath: join(dir, "report-final.docx") });

  return { search };
}

test("SearchAgent finds a Thai file by a substring, not the whole filename (trigram index)", async () => {
  const { search } = await setup();
  const result = await search.runCapability("search-by-name", { query: "มกราคม" });
  assert.equal(result.success, true);
  assert.equal(result.summaryTh, "พบ 1 รายการ");
  const hits = (result.data as { hits: Array<{ name: string; categoryNameTh: string }> }).hits;
  assert.equal(hits[0].name, "เอกสารคำสั่งเดือนมกราคม.pdf");
  assert.equal(hits[0].categoryNameTh, "เอกสารสแกน");
});

test("SearchAgent returns no results (not an error) for queries shorter than a trigram", async () => {
  const { search } = await setup();
  const result = await search.runCapability("search-by-name", { query: "ม" });
  assert.equal(result.success, true);
  assert.equal(result.summaryTh, "พบ 0 รายการ");
});

test("SearchAgent search text is treated as a literal phrase, not FTS5 query syntax", async () => {
  const { search } = await setup();
  const result = await search.runCapability("search-by-name", { query: 'report OR "malformed' });
  assert.equal(result.success, true); // would throw an FTS5 syntax error if unescaped
});
