import { createHash, randomBytes } from "node:crypto";
import type { AgentDb } from "../../shared/db/client";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createSession(db: AgentDb, userId: string): { token: string; expiresAt: string } {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)").run(
    randomBytes(16).toString("hex"),
    userId,
    hashToken(token),
    expiresAt,
  );
  return { token, expiresAt };
}

/** Returns the session's user id, or null if the token is missing/unknown/expired (expired rows are cleaned up here). */
export function resolveSession(db: AgentDb, token: string): string | null {
  const tokenHash = hashToken(token);
  const row = db.prepare("SELECT user_id, expires_at FROM sessions WHERE token_hash = ?").get(tokenHash) as
    | { user_id: string; expires_at: string }
    | undefined;
  if (!row) return null;

  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
    return null;
  }
  return row.user_id;
}

export function deleteSession(db: AgentDb, token: string): void {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}
