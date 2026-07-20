import { test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

import { InProcessEventBus } from "../agent-core/event-bus";
import { attachActivityLogger } from "../agent-core/activity-logger";
import { openDb } from "../shared/db/client";
import { runMigrations } from "../shared/db/migrate";
import { ensureUser, seedAgents } from "../shared/db/seed";
import { SqliteActivityLogWriter } from "../shared/db/activity-log.repository";
import { computeMetrics, getTrend, snapshotDailyStats } from "../shared/db/dashboard.repository";
import { StatsAggregatorJob } from "./stats-aggregator.job";
import { UploadAgent } from "../agents/upload-agent/upload-agent";
import { AiAgent } from "../agents/ai-agent/ai-agent";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function setup() {
  const db = openDb(":memory:");
  runMigrations(db);
  seedAgents(db, [new UploadAgent(), new AiAgent()]);
  ensureUser(db, "user-1");
  const bus = new InProcessEventBus();
  attachActivityLogger(bus, new SqliteActivityLogWriter(db));
  return { db, bus };
}

test("computeMetrics counts today's activity log events and organized-file bytes", async () => {
  const { db, bus } = await setup();

  await bus.publish({ name: "file.imported", sourceAgent: "upload", userId: "user-1", payload: {}, createdAt: new Date().toISOString() });
  await bus.publish({ name: "file.imported", sourceAgent: "upload", userId: "user-1", payload: {}, createdAt: new Date().toISOString() });
  await bus.publish({ name: "ai.summary_ready", sourceAgent: "ai", userId: "user-1", payload: {}, createdAt: new Date().toISOString() });

  db.prepare(`
    INSERT INTO files (id, owner_id, name, path, size_bytes, source, organized_by_agent, updated_at)
    VALUES ('f1', 'user-1', 'x.docx', '/x.docx', 1000, 'manual', 1, datetime('now'))
  `).run();
  db.prepare(`
    INSERT INTO backup_jobs (id, type, status, total_files, started_at, finished_at)
    VALUES ('j1', 'manual', 'completed', 4, datetime('now'), datetime('now'))
  `).run();

  const metrics = computeMetrics(db, "user-1", today());
  assert.equal(metrics.filesToday, 2);
  assert.equal(metrics.aiTasksCompleted, 1);
  assert.equal(metrics.storageSavedBytes, 1000);
  assert.equal(metrics.filesBackedUp, 4);
});

test("getTrend returns `days` entries, using a stored snapshot for past dates and live numbers for today", async () => {
  const { db } = await setup();

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  db.prepare(`
    INSERT INTO dashboard_stats_daily (id, user_id, stat_date, files_added, files_organized, storage_saved_bytes, files_backed_up, ai_tasks_completed)
    VALUES ('s1', 'user-1', ?, 7, 5, 2000, 1, 3)
  `).run(yesterdayStr);

  const trend = getTrend(db, "user-1", 3);
  assert.equal(trend.length, 3);
  assert.equal(trend[trend.length - 1].date, today());

  const yesterdayEntry = trend.find((t) => t.date === yesterdayStr);
  assert.equal(yesterdayEntry?.filesToday, 7); // came from the pre-seeded snapshot, not a live (zero) recompute
});

test("getTrend lazily snapshots a past date that was never aggregated before", async () => {
  const { db } = await setup();
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const dateStr = twoDaysAgo.toISOString().slice(0, 10);

  const before = db.prepare("SELECT 1 FROM dashboard_stats_daily WHERE stat_date = ?").get(dateStr);
  assert.equal(before, undefined);

  getTrend(db, "user-1", 3);

  const after = db.prepare("SELECT 1 FROM dashboard_stats_daily WHERE stat_date = ?").get(dateStr);
  assert.ok(after);
});

test("StatsAggregatorJob snapshots today immediately and keeps refreshing until stopped", async () => {
  const { db, bus } = await setup();
  const job = new StatsAggregatorJob();
  job.start(db, "user-1", 60_000); // long interval — we only care about the immediate tick here

  const row = db.prepare("SELECT files_added FROM dashboard_stats_daily WHERE user_id = 'user-1' AND stat_date = ?").get(today()) as
    | { files_added: number }
    | undefined;
  assert.ok(row, "expected an immediate snapshot on start()");
  assert.equal(row!.files_added, 0);

  await bus.publish({ name: "file.imported", sourceAgent: "upload", userId: "user-1", payload: {}, createdAt: new Date().toISOString() });
  snapshotDailyStats(db, "user-1", today());
  const updated = db.prepare("SELECT files_added FROM dashboard_stats_daily WHERE user_id = 'user-1' AND stat_date = ?").get(today()) as {
    files_added: number;
  };
  assert.equal(updated.files_added, 1);

  job.stop();
  await delay(10);
});
