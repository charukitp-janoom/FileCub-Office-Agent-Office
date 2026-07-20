import { test } from "node:test";
import assert from "node:assert/strict";

import { InProcessEventBus } from "../../agent-core/event-bus";
import { attachActivityLogger } from "../../agent-core/activity-logger";
import { AchievementEngine } from "../../agent-core/achievement-engine";
import { openDb } from "./client";
import { runMigrations } from "./migrate";
import { seedAchievements, seedAgents, ensureUser } from "./seed";
import { SqliteActivityLogWriter } from "./activity-log.repository";
import { listAchievementsWithProgress, getUserLevel } from "./achievement.repository";
import { FolderAgent } from "../../agents/folder-agent/folder-agent";
import { SearchAgent } from "../../agents/search-agent/search-agent";

async function setup() {
  const db = openDb(":memory:");
  runMigrations(db);
  seedAgents(db, [new FolderAgent(), new SearchAgent()]);
  seedAchievements(db);
  ensureUser(db, "user-1");

  const bus = new InProcessEventBus();
  const writer = new SqliteActivityLogWriter(db);
  attachActivityLogger(bus, writer);
  new AchievementEngine(db, writer).attach(bus);

  return { db, bus };
}

test("listAchievementsWithProgress shows all seeded achievements as locked with zero progress initially", async () => {
  const { db } = await setup();
  const list = listAchievementsWithProgress(db, "user-1");
  assert.equal(list.length, 4); // DESKTOP_CLEANER, FILE_GUARDIAN, SEARCH_MASTER, AI_PARTNER
  assert.ok(list.every((a) => !a.unlocked && a.progress === 0));
  const searchMaster = list.find((a) => a.code === "SEARCH_MASTER")!;
  assert.equal(searchMaster.criteriaCount, 500);
});

test("progress tracks real activity and flips to unlocked once the threshold is reached", async () => {
  const { db, bus } = await setup();

  for (let i = 0; i < 99; i++) {
    await bus.publish({
      name: "file.organized",
      sourceAgent: "folder",
      userId: "user-1",
      payload: {},
      createdAt: new Date().toISOString(),
    });
  }
  let cleaner = listAchievementsWithProgress(db, "user-1").find((a) => a.code === "DESKTOP_CLEANER")!;
  assert.equal(cleaner.progress, 99);
  assert.equal(cleaner.unlocked, false);

  await bus.publish({
    name: "file.organized",
    sourceAgent: "folder",
    userId: "user-1",
    payload: {},
    createdAt: new Date().toISOString(),
  });
  cleaner = listAchievementsWithProgress(db, "user-1").find((a) => a.code === "DESKTOP_CLEANER")!;
  assert.equal(cleaner.progress, 100);
  assert.equal(cleaner.unlocked, true);
  assert.ok(cleaner.unlockedAt);
});

test("getUserLevel defaults to Beginner/0 exp before any achievement, and reflects granted EXP after one unlocks", async () => {
  const { db, bus } = await setup();

  const before = getUserLevel(db, "user-1");
  assert.deepEqual(before, { levelName: "Beginner", currentExp: 0, nextLevelExp: 500 });

  for (let i = 0; i < 500; i++) {
    await bus.publish({
      name: "file.searched",
      sourceAgent: "search",
      userId: "user-1",
      payload: {},
      createdAt: new Date().toISOString(),
    });
  }

  const after = getUserLevel(db, "user-1");
  assert.equal(after.currentExp, 200); // EXP_PER_ACHIEVEMENT from achievement-engine.ts
  assert.equal(after.levelName, "Beginner"); // 200 < 500, hasn't leveled up yet
});
