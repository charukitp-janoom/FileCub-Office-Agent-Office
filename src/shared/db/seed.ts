import type { AgentDb } from "./client";
import type { IAgent } from "../../agent-core/types";

/**
 * Upserts one row per registered agent (id/name/nickname/role/icon) and
 * seeds the default achievements. Safe to call on every startup.
 */
/** Ensures a users row exists for the given id — agent_activity_logs and
 * friends have a foreign key on user_id, so bootstrap must create the
 * acting user before any agent publishes an event. */
export function ensureUser(db: AgentDb, userId: string, displayName = userId, role: "admin" | "staff" | "viewer" = "admin"): void {
  db.prepare(`
    INSERT INTO users (id, username, display_name, role)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `).run(userId, userId, displayName, role);
}

export function seedAgents(db: AgentDb, agents: IAgent[]): void {
  const upsert = db.prepare(`
    INSERT INTO agents (id, name_th, nickname_th, role_title_th, icon_key, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name_th = excluded.name_th,
      nickname_th = excluded.nickname_th,
      role_title_th = excluded.role_title_th,
      icon_key = excluded.icon_key,
      sort_order = excluded.sort_order
  `);

  agents.forEach((agent, index) => {
    upsert.run(agent.code, agent.nameTh, agent.nicknameTh, agent.roleTitleTh, agent.icon, index);
  });

  const upsertCapability = db.prepare(`
    INSERT INTO agent_capabilities (id, agent_id, feature_key, label_th, description_th, is_enabled)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(agent_id, feature_key) DO UPDATE SET
      label_th = excluded.label_th,
      description_th = excluded.description_th
  `);

  for (const agent of agents) {
    for (const capability of agent.capabilities) {
      upsertCapability.run(
        `${agent.code}:${capability.key}`,
        agent.code,
        capability.key,
        capability.labelTh,
        capability.descriptionTh,
        capability.enabled ? 1 : 0,
      );
    }
  }
}

const DEFAULT_ACHIEVEMENTS = [
  { id: "ach-1", code: "DESKTOP_CLEANER", nameTh: "Desktop Cleaner", descriptionTh: "จัด Desktop สำเร็จ 100 ไฟล์", iconKey: "🏆", criteriaEvent: "file.organized", criteriaCount: 100 },
  { id: "ach-2", code: "FILE_GUARDIAN", nameTh: "File Guardian", descriptionTh: "Backup สำเร็จ 1000 ไฟล์", iconKey: "🏆", criteriaEvent: "backup.completed", criteriaCount: 1000 },
  { id: "ach-3", code: "SEARCH_MASTER", nameTh: "Search Master", descriptionTh: "ค้นหาไฟล์สำเร็จ 500 ครั้ง", iconKey: "🔍", criteriaEvent: "file.searched", criteriaCount: 500 },
  { id: "ach-4", code: "AI_PARTNER", nameTh: "AI Partner", descriptionTh: "สนทนากับ Cub AI Agent 100 ครั้ง", iconKey: "🤖", criteriaEvent: "ai.summary_ready", criteriaCount: 100 },
] as const;

export function seedAchievements(db: AgentDb): void {
  const upsert = db.prepare(`
    INSERT INTO achievements (id, code, name_th, description_th, icon_key, criteria_event, criteria_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET
      name_th = excluded.name_th,
      description_th = excluded.description_th,
      icon_key = excluded.icon_key,
      criteria_event = excluded.criteria_event,
      criteria_count = excluded.criteria_count
  `);

  for (const achievement of DEFAULT_ACHIEVEMENTS) {
    upsert.run(
      achievement.id,
      achievement.code,
      achievement.nameTh,
      achievement.descriptionTh,
      achievement.iconKey,
      achievement.criteriaEvent,
      achievement.criteriaCount,
    );
  }
}
