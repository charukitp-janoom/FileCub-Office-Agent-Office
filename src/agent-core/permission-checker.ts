import { randomUUID } from "node:crypto";
import type { AgentDb } from "../shared/db/client";
import type { AccessLevel, AgentEventBus, PermissionChecker } from "./types";

export class PermissionDeniedError extends Error {
  constructor(action: string) {
    super(`Permission denied: ${action}`);
    this.name = "PermissionDeniedError";
  }
}

const LEVEL_RANK: Record<AccessLevel, number> = { read: 1, write: 2, admin: 3 };

/**
 * SQLite-backed RBAC check. Admins bypass all checks. Everyone else needs
 * an explicit grant in `permissions` whose access_level is at least
 * `requiredLevel` (global grant via resource_id NULL, or scoped to the
 * specific resource) — a "read" grant does not satisfy a "write" check.
 * Every check — allow or deny — is logged to security_events, matching
 * docs/agent-office/01-architecture.md §1.5. A denial also publishes
 * `security.permission_denied` so Cub Security Agent's anomaly detector
 * can watch for repeated denials.
 */
export class SqlitePermissionChecker implements PermissionChecker {
  constructor(
    private readonly db: AgentDb,
    private readonly eventBus?: AgentEventBus,
  ) {}

  async check(userId: string, action: string, resourceId?: string, requiredLevel: AccessLevel = "write"): Promise<void> {
    const allowed = this.isAllowed(userId, action, resourceId, requiredLevel);
    this.logSecurityEvent(userId, action, resourceId, requiredLevel, allowed);

    if (!allowed) {
      await this.eventBus?.publish({
        name: "security.permission_denied",
        sourceAgent: "security",
        userId,
        payload: { action, resourceId, requiredLevel },
        createdAt: new Date().toISOString(),
      });
      throw new PermissionDeniedError(action);
    }
  }

  private isAllowed(userId: string, action: string, resourceId: string | undefined, requiredLevel: AccessLevel): boolean {
    const user = this.db.prepare("SELECT role FROM users WHERE id = ?").get(userId) as
      | { role: string }
      | undefined;
    if (user?.role === "admin") return true;

    const [resourceType] = action.split(":");
    const grants = this.db
      .prepare(`
        SELECT access_level FROM permissions
        WHERE user_id = ?
          AND resource_type = ?
          AND (resource_id IS NULL OR resource_id = ?)
      `)
      .all(userId, resourceType, resourceId ?? null) as Array<{ access_level: AccessLevel }>;

    const requiredRank = LEVEL_RANK[requiredLevel];
    return grants.some((grant) => LEVEL_RANK[grant.access_level] >= requiredRank);
  }

  private logSecurityEvent(
    userId: string,
    action: string,
    resourceId: string | undefined,
    requiredLevel: AccessLevel,
    allowed: boolean,
  ): void {
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
        JSON.stringify({ action, resourceId: resourceId ?? null, requiredLevel }),
      );
  }
}
