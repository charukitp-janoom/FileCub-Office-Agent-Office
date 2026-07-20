import { AgentRegistry } from "./registry";
import { InProcessEventBus } from "./event-bus";
import { attachActivityLogger } from "./activity-logger";
import { AchievementEngine } from "./achievement-engine";
import { SqlitePermissionChecker } from "./permission-checker";
import type { AgentContext } from "./types";

import { openDb, type AgentDb } from "../shared/db/client";
import { runMigrations } from "../shared/db/migrate";
import { seedAgents, seedAchievements, seedFileCategories, ensureUser } from "../shared/db/seed";
import { SqliteActivityLogWriter } from "../shared/db/activity-log.repository";
import { SqliteDashboardRepository } from "../shared/db/dashboard.repository";
import { DashboardService } from "../agent-dashboard/dashboard.service";
import { StatsAggregatorJob } from "../agent-dashboard/stats-aggregator.job";

import { FolderAgent } from "../agents/folder-agent/folder-agent";
import { SearchAgent } from "../agents/search-agent/search-agent";
import { UploadAgent } from "../agents/upload-agent/upload-agent";
import { SecurityAgent } from "../agents/security-agent/security-agent";
import { AiAgent } from "../agents/ai-agent/ai-agent";
import { NotifyAgent } from "../agents/notify-agent/notify-agent";
import { BackupAgent } from "../agents/backup-agent/backup-agent";

export interface BootstrapDeps {
  userId: string;
  /** SQLite file path, or ":memory:" for tests. Defaults to a local file next to the app. */
  dbPath?: string;
  /** Directory backup file copies are written to. Defaults to ./backups. */
  backupDir?: string;
}

export interface AgentOffice {
  registry: AgentRegistry;
  db: AgentDb;
  activityLog: SqliteActivityLogWriter;
  dashboard: DashboardService;
  userId: string;
}

/** How often stats-aggregator.job.ts refreshes today's dashboard_stats_daily snapshot. */
const STATS_AGGREGATION_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Single place where the database is opened/migrated, every agent is
 * registered, and the cross-cutting consumers (activity logger,
 * achievement engine) are wired to the event bus. Adding agent #8 means
 * adding one line to the `agents` array below — nothing else here, in the
 * dashboard, or in the achievement engine needs to change.
 */
export async function bootstrapAgentOffice(deps: BootstrapDeps): Promise<AgentOffice> {
  const db = openDb(deps.dbPath ?? "agent-office.sqlite");
  runMigrations(db);

  ensureUser(db, deps.userId);

  const registry = new AgentRegistry();
  const eventBus = new InProcessEventBus();

  const activityLogWriter = new SqliteActivityLogWriter(db);
  attachActivityLogger(eventBus, activityLogWriter);

  const achievementEngine = new AchievementEngine(db, activityLogWriter);
  achievementEngine.attach(eventBus);

  const permissions = new SqlitePermissionChecker(db, eventBus);

  const agents = [
    new FolderAgent(),
    new SearchAgent(),
    new UploadAgent(),
    new SecurityAgent(),
    new AiAgent(),
    new NotifyAgent(),
    new BackupAgent(deps.backupDir ?? "./backups"),
  ];

  seedAgents(db, agents);
  seedAchievements(db);
  seedFileCategories(db);

  for (const agent of agents) {
    registry.register(agent);

    const ctx: AgentContext = {
      userId: deps.userId,
      eventBus,
      db: { agentId: agent.code, raw: db },
      permissions,
      logger: {
        info: (message, meta) => console.info(`[${agent.code}]`, message, meta ?? ""),
        error: (message, meta) => console.error(`[${agent.code}]`, message, meta ?? ""),
      },
    };
    await agent.init(ctx);

    if (agent.onEvent) {
      const boundAgent = agent;
      eventBus.subscribe("file.imported", (event) => void boundAgent.onEvent?.(event));
      eventBus.subscribe("file.organized", (event) => void boundAgent.onEvent?.(event));
      eventBus.subscribe("security.anomaly", (event) => void boundAgent.onEvent?.(event));
      eventBus.subscribe("security.permission_denied", (event) => void boundAgent.onEvent?.(event));
      eventBus.subscribe("backup.completed", (event) => void boundAgent.onEvent?.(event));
      eventBus.subscribe("backup.failed", (event) => void boundAgent.onEvent?.(event));
    }
  }

  const dashboardService = new DashboardService(new SqliteDashboardRepository(db));
  new StatsAggregatorJob().start(db, deps.userId, STATS_AGGREGATION_INTERVAL_MS);

  return { registry, db, activityLog: activityLogWriter, dashboard: dashboardService, userId: deps.userId };
}
