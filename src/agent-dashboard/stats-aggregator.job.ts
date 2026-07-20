import type { AgentDb } from "../shared/db/client";
import { snapshotDailyStats } from "../shared/db/dashboard.repository";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Periodically snapshots today's numbers into dashboard_stats_daily so
 * getTrend() never has to re-scan the full activity log for past dates —
 * once a day rolls over, that last snapshot becomes the frozen historical
 * row for yesterday. `unref()`d like DesktopWatcher/BackupScheduler so it
 * never single-handedly keeps the process (or a test) alive.
 */
export class StatsAggregatorJob {
  private timer?: NodeJS.Timeout;

  start(db: AgentDb, userId: string, intervalMs: number): void {
    this.stop();
    const tick = () => snapshotDailyStats(db, userId, today());
    tick(); // don't wait a full interval before the first row exists
    this.timer = setInterval(tick, intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}
