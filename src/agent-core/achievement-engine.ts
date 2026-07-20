import { randomUUID } from "node:crypto";
import type { AgentDb } from "../shared/db/client";
import type { SqliteActivityLogWriter } from "../shared/db/activity-log.repository";
import type { AgentEvent, AgentEventBus, AgentEventName } from "./types";

interface AchievementRow {
  id: string;
  code: string;
  name_th: string;
  criteria_event: AgentEventName;
  criteria_count: number;
}

/** EXP awarded to a user's level track each time they unlock an achievement. */
const EXP_PER_ACHIEVEMENT = 200;

/**
 * Beginner -> Office User -> File Master -> AI Commander, per
 * docs/agent-office/02-database.md §2.11 and 05-development-plan.md Phase 5.
 */
const LEVEL_THRESHOLDS: Array<{ name: string; minExp: number; nextExp: number }> = [
  { name: "Beginner", minExp: 0, nextExp: 500 },
  { name: "Office User", minExp: 500, nextExp: 1500 },
  { name: "File Master", minExp: 1500, nextExp: 3000 },
  { name: "AI Commander", minExp: 3000, nextExp: Number.POSITIVE_INFINITY },
];

/**
 * Generic consumer of the event bus: for every event, checks whether any
 * achievement whose criteria_event matches has now been reached by the
 * user, unlocks it, and grants EXP. Agents never need achievement-specific
 * logic — this is the single place that interprets agent_activity_logs
 * as progress toward achievements/levels.
 */
export class AchievementEngine {
  constructor(
    private readonly db: AgentDb,
    private readonly activityLog: SqliteActivityLogWriter,
  ) {}

  attach(bus: AgentEventBus): void {
    const eventNames: AgentEventName[] = [
      "file.imported",
      "file.organized",
      "file.searched",
      "security.anomaly",
      "security.permission_denied",
      "ai.summary_ready",
      "backup.completed",
      "backup.failed",
    ];
    for (const name of eventNames) {
      bus.subscribe(name, (event) => this.handle(event, bus));
    }
  }

  private handle(event: AgentEvent, bus: AgentEventBus): void {
    const candidates = this.db
      .prepare("SELECT id, code, name_th, criteria_event, criteria_count FROM achievements WHERE criteria_event = ?")
      .all(event.name) as unknown as AchievementRow[];

    for (const achievement of candidates) {
      if (this.isUnlocked(event.userId, achievement.id)) continue;

      const progress = this.activityLog.countForUser(event.userId, event.name);
      if (progress < achievement.criteria_count) continue;

      this.unlock(event.userId, achievement);
      void bus.publish({
        name: "achievement.unlocked",
        sourceAgent: event.sourceAgent,
        userId: event.userId,
        payload: { achievementCode: achievement.code, achievementNameTh: achievement.name_th },
        createdAt: new Date().toISOString(),
      });
    }
  }

  private isUnlocked(userId: string, achievementId: string): boolean {
    const row = this.db
      .prepare("SELECT 1 FROM user_achievements WHERE user_id = ? AND achievement_id = ?")
      .get(userId, achievementId);
    return Boolean(row);
  }

  private unlock(userId: string, achievement: AchievementRow): void {
    this.db
      .prepare("INSERT INTO user_achievements (id, user_id, achievement_id) VALUES (?, ?, ?)")
      .run(randomUUID(), userId, achievement.id);

    this.grantExp(userId, EXP_PER_ACHIEVEMENT);
  }

  private grantExp(userId: string, exp: number): void {
    this.db
      .prepare("INSERT OR IGNORE INTO user_levels (user_id, current_exp, next_level_exp) VALUES (?, 0, 500)")
      .run(userId);

    const current = this.db
      .prepare("SELECT current_exp FROM user_levels WHERE user_id = ?")
      .get(userId) as { current_exp: number };

    const newExp = current.current_exp + exp;
    const level = LEVEL_THRESHOLDS.slice().reverse().find((tier) => newExp >= tier.minExp) ?? LEVEL_THRESHOLDS[0];

    this.db
      .prepare("UPDATE user_levels SET current_exp = ?, level_name = ?, next_level_exp = ? WHERE user_id = ?")
      .run(newExp, level.name, Number.isFinite(level.nextExp) ? level.nextExp : newExp, userId);
  }
}
