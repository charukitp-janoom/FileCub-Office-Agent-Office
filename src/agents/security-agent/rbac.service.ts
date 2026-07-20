import { randomUUID } from "node:crypto";
import type { AgentDb } from "../../shared/db/client";

export type Role = "admin" | "staff" | "viewer";

export interface PermissionGrant {
  id: string;
  userId: string;
  resourceType: string;
  resourceId: string | null;
  accessLevel: string;
}

/** Sets a user's role (Admin / Staff / Viewer). Admins bypass all explicit grants — see permission-checker.ts. */
export function setUserRole(db: AgentDb, userId: string, role: Role): void {
  db.prepare("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?").run(role, userId);
}

export function getUserRole(db: AgentDb, userId: string): Role | undefined {
  const row = db.prepare("SELECT role FROM users WHERE id = ?").get(userId) as { role: Role } | undefined;
  return row?.role;
}

/** Grants `userId` access to a resource type (optionally scoped to one resource id). */
export function grantPermission(
  db: AgentDb,
  grantedBy: string,
  userId: string,
  resourceType: string,
  accessLevel: "read" | "write" | "admin",
  resourceId?: string,
): void {
  db.prepare(`
    INSERT INTO permissions (id, user_id, resource_type, resource_id, access_level, granted_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), userId, resourceType, resourceId ?? null, accessLevel, grantedBy);
}

export function listPermissions(db: AgentDb, userId: string): PermissionGrant[] {
  const rows = db
    .prepare(`
      SELECT id, user_id as userId, resource_type as resourceType, resource_id as resourceId, access_level as accessLevel
      FROM permissions WHERE user_id = ?
    `)
    .all(userId);
  return rows as unknown as PermissionGrant[];
}
