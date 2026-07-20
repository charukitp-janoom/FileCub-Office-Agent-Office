import { randomUUID } from "node:crypto";
import type { AgentDb } from "./client";
import type { ActivityLogRecord, ActivityLogWriter } from "../../agent-core/activity-logger";

export class SqliteActivityLogWriter implements ActivityLogWriter {
  constructor(private readonly db: AgentDb) {}

  async insert(record: ActivityLogRecord): Promise<void> {
    this.db
      .prepare(`
        INSERT INTO agent_activity_logs
          (id, agent_id, user_id, event_name, summary_th, exp_gained, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(record.id, record.agentId, record.userId, record.eventName, record.summaryTh, record.expGained, record.createdAt);
  }

  /** Count of `eventName` occurrences logged for a given user — used by the achievement engine. */
  countForUser(userId: string, eventName: string): number {
    const row = this.db
      .prepare("SELECT COUNT(*) as count FROM agent_activity_logs WHERE user_id = ? AND event_name = ?")
      .get(userId, eventName) as { count: number };
    return row.count;
  }

  /** Most recent activity for one agent — powers the Agent Detail Drawer's activity list. */
  recentForAgent(agentId: string, limit = 10): ActivityLogRecord[] {
    const rows = this.db
      .prepare(`
        SELECT id, agent_id as agentId, user_id as userId, event_name as eventName,
               summary_th as summaryTh, exp_gained as expGained, created_at as createdAt
        FROM agent_activity_logs
        WHERE agent_id = ?
        ORDER BY created_at DESC, rowid DESC
        LIMIT ?
      `)
      .all(agentId, limit);
    return rows as unknown as ActivityLogRecord[];
  }

  /** Count of `eventName` logged for a user since local midnight — powers the Dashboard tiles. */
  countTodayForUser(userId: string, eventName: string): number {
    const row = this.db
      .prepare(`
        SELECT COUNT(*) as count FROM agent_activity_logs
        WHERE user_id = ? AND event_name = ? AND date(created_at) = date('now')
      `)
      .get(userId, eventName) as { count: number };
    return row.count;
  }
}

export function newLogId(): string {
  return randomUUID();
}
