import type { AgentDb } from "../../shared/db/client";
import { hashPassword, verifyPassword } from "./password";
import { createSession, deleteSession, resolveSession } from "./session.repository";

export interface LoginOutcome {
  success: boolean;
  reasonTh: string;
  token?: string;
}

/** Has this FileCub Office instance's owner account ever set a password? */
export function isPasswordConfigured(db: AgentDb, userId: string): boolean {
  const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(userId) as
    | { password_hash: string | null }
    | undefined;
  return Boolean(row?.password_hash);
}

/** First-run only — see http-server.ts, which refuses this once a password already exists. */
export function setInitialPassword(db: AgentDb, userId: string, password: string): void {
  const { hash, salt } = hashPassword(password);
  db.prepare("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?").run(hash, salt, userId);
}

export function login(db: AgentDb, userId: string, password: string): LoginOutcome {
  const row = db.prepare("SELECT password_hash, password_salt FROM users WHERE id = ?").get(userId) as
    | { password_hash: string | null; password_salt: string | null }
    | undefined;

  if (!row?.password_hash || !row.password_salt) {
    return { success: false, reasonTh: "ยังไม่ได้ตั้งรหัสผ่านสำหรับเครื่องนี้" };
  }
  if (!verifyPassword(password, row.password_hash, row.password_salt)) {
    return { success: false, reasonTh: "รหัสผ่านไม่ถูกต้อง" };
  }

  const session = createSession(db, userId);
  return { success: true, reasonTh: "เข้าสู่ระบบสำเร็จ", token: session.token };
}

export function logout(db: AgentDb, token: string): void {
  deleteSession(db, token);
}

/** Returns the authenticated user id for this session token, or null. */
export function authenticate(db: AgentDb, token: string | undefined): string | null {
  if (!token) return null;
  return resolveSession(db, token);
}
