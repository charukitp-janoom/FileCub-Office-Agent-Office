import { test } from "node:test";
import assert from "node:assert/strict";

import { InProcessEventBus } from "../../agent-core/event-bus";
import { openDb } from "../../shared/db/client";
import { runMigrations } from "../../shared/db/migrate";
import { seedAgents, seedFileCategories, seedAchievements, ensureUser } from "../../shared/db/seed";

import { AiAgent } from "./ai-agent";
import type { LlmClient } from "./llm-client";

const OFFLINE_LLM: LlmClient = { complete: async () => null };

async function setup(llm: LlmClient = OFFLINE_LLM) {
  const db = openDb(":memory:");
  runMigrations(db);
  const ai = new AiAgent(llm);
  seedAgents(db, [ai]);
  seedFileCategories(db);
  seedAchievements(db);
  ensureUser(db, "user-1");

  const bus = new InProcessEventBus();
  const events: string[] = [];
  bus.subscribe("ai.summary_ready", () => events.push("ai.summary_ready"));

  await ai.init({
    userId: "user-1",
    eventBus: bus,
    db: { agentId: "ai" as const, raw: db },
    permissions: { check: async () => {} },
    logger: { info: () => {}, error: () => {} },
  });

  return { db, ai, events };
}

test("summarize falls back to a deterministic offline summary and publishes ai.summary_ready", async () => {
  const { ai, events } = await setup();
  const result = await ai.runCapability("summarize", {
    fileName: "report.docx",
    content: "เนื้อหารายงานประจำเดือนมกราคม รายได้เพิ่มขึ้น 10% เมื่อเทียบกับเดือนก่อน",
  });
  assert.equal(result.success, true);
  assert.match(result.summaryTh, /โหมดออฟไลน์|รายได้เพิ่มขึ้น/);
  assert.deepEqual(events, ["ai.summary_ready"]);
});

test("summarize persists to ai_file_insights when a fileId is given", async () => {
  const { db, ai } = await setup();
  db.prepare("INSERT INTO files (id, owner_id, name, path, size_bytes, source) VALUES ('f1','user-1','x.docx','/x.docx',10,'manual')").run();

  await ai.runCapability("summarize", { fileId: "f1", fileName: "x.docx", content: "หนึ่งสองสาม" });
  const row = db.prepare("SELECT summary_th FROM ai_file_insights WHERE file_id = 'f1'").get() as { summary_th: string };
  assert.ok(row.summary_th.length > 0);
});

test("suggest-filename falls back to <category>-<date>.<ext> offline", async () => {
  const { ai } = await setup();
  const result = await ai.runCapability("suggest-filename", {
    originalName: "scan001.pdf",
    content: "ใบเสร็จร้านค้า",
    categoryNameTh: "เอกสารสแกน",
  });
  assert.equal(result.success, true);
  const data = result.data as { suggestedName: string };
  assert.match(data.suggestedName, /^เอกสารสแกน-\d{8}\.pdf$/);
});

test("chat-with-document persists both turns and reuses the same conversation", async () => {
  const { db, ai } = await setup();
  const first = await ai.runCapability("chat-with-document", {
    fileName: "report.docx",
    content: "ยอดขายเดือนนี้ 100,000 บาท",
    question: "ยอดขายเท่าไหร่",
  });
  const conversationId = (first.data as { conversationId: string }).conversationId;

  await ai.runCapability("chat-with-document", {
    conversationId,
    fileName: "report.docx",
    content: "ยอดขายเดือนนี้ 100,000 บาท",
    question: "แล้วเดือนหน้าล่ะ",
  });

  const messages = db
    .prepare("SELECT role FROM ai_messages WHERE conversation_id = ? ORDER BY created_at")
    .all(conversationId) as Array<{ role: string }>;
  assert.deepEqual(
    messages.map((m) => m.role),
    ["user", "assistant", "user", "assistant"],
  );
});

test("suggest-storage reports the file's already-assigned category", async () => {
  const { db, ai } = await setup();
  db.prepare(`
    INSERT INTO files (id, owner_id, name, path, size_bytes, source, category_id)
    VALUES ('f1','user-1','report-final.docx','/report-final.docx',10,'manual','cat-report')
  `).run();

  const result = await ai.runCapability("suggest-storage", { fileId: "f1" });
  assert.equal(result.success, true);
  assert.match(result.summaryTh, /เอกสารรายงาน/);
});

test("qa-about-app answers from the offline FAQ by keyword", async () => {
  const { ai } = await setup();
  const result = await ai.runCapability("qa-about-app", { question: "จะเปิด Desktop อัตโนมัติยังไง" });
  assert.match(result.summaryTh, /Desktop Auto Import/);
});

test("AiAgent uses the LLM reply when the client is configured", async () => {
  const { ai } = await setup({ complete: async () => "คำตอบจาก LLM จริง" });
  const result = await ai.runCapability("qa-about-app", { question: "สวัสดี" });
  assert.equal(result.summaryTh, "คำตอบจาก LLM จริง");
});
