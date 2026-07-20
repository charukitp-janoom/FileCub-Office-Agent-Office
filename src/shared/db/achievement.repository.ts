import type { AgentDb } from "./client";

export interface AchievementProgress {
  code: string;
  nameTh: string;
  descriptionTh: string;
  iconKey: string;
  progress: number;
  criteriaCount: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

export interface UserLevel {
  levelName: string;
  currentExp: number;
  nextLevelExp: number;
}

/** Every achievement with this user's current progress toward it — powers the Achievement/Level screen. */
export function listAchievementsWithProgress(db: AgentDb, userId: string): AchievementProgress[] {
  const rows = db
    .prepare(`
      SELECT
        a.code, a.name_th as nameTh, a.description_th as descriptionTh, a.icon_key as iconKey,
        a.criteria_event as criteriaEvent, a.criteria_count as criteriaCount,
        ua.unlocked_at as unlockedAt
      FROM achievements a
      LEFT JOIN user_achievements ua ON ua.achievement_id = a.id AND ua.user_id = ?
    `)
    .all(userId) as unknown as Array<{
    code: string;
    nameTh: string;
    descriptionTh: string;
    iconKey: string;
    criteriaEvent: string;
    criteriaCount: number;
    unlockedAt: string | null;
  }>;

  return rows.map((row) => {
    const progressRow = db
      .prepare("SELECT COUNT(*) as count FROM agent_activity_logs WHERE user_id = ? AND event_name = ?")
      .get(userId, row.criteriaEvent) as { count: number };

    return {
      code: row.code,
      nameTh: row.nameTh,
      descriptionTh: row.descriptionTh,
      iconKey: row.iconKey,
      progress: Math.min(progressRow.count, row.criteriaCount),
      criteriaCount: row.criteriaCount,
      unlocked: row.unlockedAt !== null,
      unlockedAt: row.unlockedAt,
    };
  });
}

export function getUserLevel(db: AgentDb, userId: string): UserLevel {
  const row = db
    .prepare("SELECT level_name as levelName, current_exp as currentExp, next_level_exp as nextLevelExp FROM user_levels WHERE user_id = ?")
    .get(userId) as UserLevel | undefined;

  return row ?? { levelName: "Beginner", currentExp: 0, nextLevelExp: 500 };
}
