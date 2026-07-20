import { randomUUID } from "node:crypto";
import type { AgentDb } from "../shared/db/client";
import type { PermissionChecker } from "./types";

export class PermissionDeniedError extends Error {
  constructor(action: string) {
    super(`Permission denied: ${action}`);
    this.name = "PermissionDeniedError";
  }
}

/**
 * SQLite-backed RBAC check. Admins bypass all checks. Everyone else needs
 * an explicit grant in `permissions` (global, resource_id NULL, or scoped
 * to the specific resource). Every check — allow or deny — is logged to
 * security_events, matching docs/agent-office/01-architecture.md §1.5.
 */
export class SqlitePermissionChecker implements PermissionChecker {
  constructor(private readonly db: AgentDb) {}

  async check(userId: string, action: string, resourceId?: string): Promise<void> {
    const allowed = this.isAllowed(userId, action, resourceId);
    this.logSecurityEvent(userId, action, resourceId, allowed);
    if (!allowed) {
      throw new PermissionDeniedError(action);
    }
  }

  private isAllowed(userId: string, action: string, resourceId?: string): boolean {
    const user = this.db.prepare("SELECT role FROM users WHERE id = ?").get(userId) as
      | { role: string }
      | undefined;
    if (user?.role === "admin") return true;

    const [resourceType] = action.split(":");
    const grant = this.db
      .prepare(`
        SELECT 1 FROM permissions
        WHERE user_id = ?
          AND resource_type = ?
          AND (resource_id IS NULL OR resource_id = ?)
        LIMIT 1
      `)
      .get(userId, resourceType, resourceId ?? null);

    return Boolean(grant);
  }

  private logSecurityEvent(userId: string, action: string, resourceId: string | undefined, allowed: boolean): void {
    this.db
      .prepare(`
        INSERT INTO security_events (id, user_id, event_type, severity, description_th, metadata_json)
        VALUES (?, ?, 'permission_check', ?, ?, ?)
      `)
      .run(
        randomUUID(),
        userId,
        allowed ? "info" : "warning",
        allowed ? `อนุญาต: ${action}` : `ปฏิเสธ: ${action}`,
        JSON.stringify({ action, resourceId: resourceId ?? null }),
      );
  }
}
