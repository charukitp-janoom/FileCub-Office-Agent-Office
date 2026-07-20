export interface DashboardSummary {
  filesToday: number;
  filesOrganized: number;
  storageSavedBytes: number;
  filesBackedUp: number;
  aiTasksCompleted: number;
}

export interface DashboardRepository {
  getTodaySummary(userId: string): Promise<DashboardSummary>;
  getTrend(userId: string, days: number): Promise<Array<{ date: string } & DashboardSummary>>;
}

/**
 * Thin service on top of the repository. Deliberately has no knowledge
 * of any specific agent — it only reads aggregated rows derived from
 * agent_activity_logs (see docs/agent-office/02-database.md §2.11).
 */
export class DashboardService {
  constructor(private readonly repo: DashboardRepository) {}

  getSummary(userId: string): Promise<DashboardSummary> {
    return this.repo.getTodaySummary(userId);
  }

  getTrend(userId: string, days = 7) {
    return this.repo.getTrend(userId, days);
  }
}
