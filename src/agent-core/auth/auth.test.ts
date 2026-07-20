import { test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

import { openDb } from "../../shared/db/client";
import { runMigrations } from "../../shared/db/migrate";
import { ensureUser } from "../../shared/db/seed";
import { hashPassword, verifyPassword } from "./password";
import { createSession, resolveSession, deleteSession } from "./session.repository";
import { isPasswordConfigured, setInitialPassword, login, logout, authenticate } from "./auth.service";

function setup() {
  const db = openDb(":memory:");
  runMigrations(db);
  ensureUser(db, "user-1");
  return db;
}

test("hashPassword/verifyPassword: correct password verifies, wrong password doesn't, salts differ per call", () => {
  const a = hashPassword("correct horse battery staple");
  const b = hashPassword("correct horse battery staple");
  assert.notEqual(a.salt, b.salt); // random salt each time
  assert.notEqual(a.hash, b.hash); // so the hash differs too even for the same password

  assert.equal(verifyPassword("correct horse battery staple", a.hash, a.salt), true);
  assert.equal(verifyPassword("wrong password", a.hash, a.salt), false);
});

test("session lifecycle: create -> resolve -> delete -> no longer resolves", () => {
  const db = setup();
  const { token } = createSession(db, "user-1");
  assert.equal(resolveSession(db, token), "user-1");

  deleteSession(db, token);
  assert.equal(resolveSession(db, token), null);
});

test("resolveSession returns null for an unknown token", () => {
  const db = setup();
  assert.equal(resolveSession(db, "not-a-real-token"), null);
});

test("resolveSession treats an expired session as invalid and cleans it up", async () => {
  const db = setup();
  const { token } = createSession(db, "user-1");

  // Force it into the past directly — waiting out the real 30-day TTL isn't practical in a test.
  db.prepare("UPDATE sessions SET expires_at = datetime('now', '-1 second')").run();
  assert.equal(resolveSession(db, token), null);

  const remaining = db.prepare("SELECT COUNT(*) as count FROM sessions").get() as { count: number };
  assert.equal(remaining.count, 0); // expired row was deleted, not just ignored
  await delay(0);
});

test("auth.service: isPasswordConfigured is false until setInitialPassword is called", () => {
  const db = setup();
  assert.equal(isPasswordConfigured(db, "user-1"), false);
  setInitialPassword(db, "user-1", "hunter2");
  assert.equal(isPasswordConfigured(db, "user-1"), true);
});

test("auth.service: login fails with no password configured, fails with wrong password, succeeds with the right one", () => {
  const db = setup();

  const beforeSetup = login(db, "user-1", "anything");
  assert.equal(beforeSetup.success, false);
  assert.match(beforeSetup.reasonTh, /ยังไม่ได้ตั้งรหัสผ่าน/);

  setInitialPassword(db, "user-1", "hunter2");

  const wrong = login(db, "user-1", "wrong-password");
  assert.equal(wrong.success, false);

  const right = login(db, "user-1", "hunter2");
  assert.equal(right.success, true);
  assert.ok(right.token);
  assert.equal(authenticate(db, right.token), "user-1");
});

test("auth.service: logout invalidates the session", () => {
  const db = setup();
  setInitialPassword(db, "user-1", "hunter2");
  const { token } = login(db, "user-1", "hunter2");

  assert.equal(authenticate(db, token), "user-1");
  logout(db, token!);
  assert.equal(authenticate(db, token), null);
});

test("auth.service: authenticate returns null for an undefined token (no cookie sent)", () => {
  const db = setup();
  assert.equal(authenticate(db, undefined), null);
});
