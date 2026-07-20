import { randomUUID } from "node:crypto";
import type { AgentDb } from "./client";
import type { DashboardSummary } from "../../agent-dashboard/dashboard.service";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Computes the 5 dashboard metrics for one user on one calendar date, straight from the raw tables. */
export function computeMetrics(db: AgentDb, userId: string, dateStr: string): DashboardSummary {
  const filesToday = countEventOnDate(db, userId, "file.imported", dateStr);
  const filesOrganized = countEventOnDate(db, userId, "file.organized", dateStr);
  const aiTasksCompleted = countEventOnDate(db, userId, "ai.summary_ready", dateStr);

  const storageSavedBytes = (
    db
      .prepare(`
        SELECT COALESCE(SUM(size_bytes), 0) as total FROM files
        WHERE owner_id = ? AND organized_by_agent = 1 AND date(updated_at) = ?
      `)
      .get(userId, dateStr) as { total: number }
  ).total;

  const filesBackedUp = (
    db
      .prepare(`SELECT COALESCE(SUM(total_files), 0) as total FROM backup_jobs WHERE status = 'completed' AND date(started_at) = ?`)
      .get(dateStr) as { total: number }
  ).total;

  return { filesToday, filesOrganized, storageSavedBytes, filesBackedUp, aiTasksCompleted };
}

function countEventOnDate(db: AgentDb, userId: string, eventName: string, dateStr: string): number {
  const row = db
    .prepare(`
      SELECT COUNT(*) as count FROM agent_activity_logs
      WHERE user_id = ? AND event_name = ? AND date(created_at) = ?
    `)
    .get(userId, eventName, dateStr) as { count: number };
  return row.count;
}

export function getTodaySummary(db: AgentDb, userId: string): DashboardSummary {
  return computeMetrics(db, userId, today());
}

/** Writes (or refreshes) one day's row in dashboard_stats_daily — the materialized cache stats-aggregator.job.ts keeps warm. */
export function snapshotDailyStats(db: AgentDb, userId: string, dateStr: string): DashboardSummary {
  const metrics = computeMetrics(db, userId, dateStr);
  db.prepare(`
    INSERT INTO dashboard_stats_daily (id, user_id, stat_date, files_added, files_organized, storage_saved_bytes, files_backed_up, ai_tasks_completed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, stat_date) DO UPDATE SET
      files_added = excluded.files_added,
      files_organized = excluded.files_organized,
      storage_saved_bytes = excluded.storage_saved_bytes,
      files_backed_up = excluded.files_backed_up,
      ai_tasks_completed = excluded.ai_tasks_completed
  `).run(
    randomUUID(),
    userId,
    dateStr,
    metrics.filesToday,
    metrics.filesOrganized,
    metrics.storageSavedBytes,
    metrics.filesBackedUp,
    metrics.aiTasksCompleted,
  );
  return metrics;
}

/**
 * Trend for the last `days` calendar dates (oldest first, today last).
 * Today is always computed live (it isn't "finalized" yet); earlier dates
 * are read from dashboard_stats_daily, lazily snapshotting it first if a
 * date was never aggregated (e.g. the very first run).
 */
export function getTrend(db: AgentDb, userId: string, days: number): Array<{ date: string } & DashboardSummary> {
  const todayStr = today();
  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return d.toISOString().slice(0, 10);
  });

  return dates.map((dateStr) => {
    if (dateStr === todayStr) {
      return { date: dateStr, ...computeMetrics(db, userId, dateStr) };
    }

    const cached = db
      .prepare(`
        SELECT files_added as filesToday, files_organized as filesOrganized, storage_saved_bytes as storageSavedBytes,
               files_backed_up as filesBackedUp, ai_tasks_completed as aiTasksCompleted
        FROM dashboard_stats_daily WHERE user_id = ? AND stat_date = ?
      `)
      .get(userId, dateStr) as DashboardSummary | undefined;

    if (cached) return { date: dateStr, ...cached };
    return { date: dateStr, ...snapshotDailyStats(db, userId, dateStr) };
  });
}

/** Adapts the sync SQLite functions above to the async DashboardRepository interface. */
export class SqliteDashboardRepository {
  constructor(private readonly db: AgentDb) {}

  async getTodaySummary(userId: string): Promise<DashboardSummary> {
    return getTodaySummary(this.db, userId);
  }

  async getTrend(userId: string, days: number) {
    return getTrend(this.db, userId, days);
  }
}
