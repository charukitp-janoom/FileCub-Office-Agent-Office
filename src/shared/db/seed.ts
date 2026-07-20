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

const DEFAULT_CATEGORIES = [
  { id: "cat-report", nameTh: "เอกสารรายงาน", iconKey: "📄" },
  { id: "cat-scan", nameTh: "เอกสารสแกน", iconKey: "🖨️" },
  { id: "cat-image", nameTh: "รูปภาพ", iconKey: "🖼️" },
  { id: "cat-misc", nameTh: "เอกสารทั่วไป", iconKey: "📁" },
] as const;

// Higher priority wins. filename_pattern rules are checked before the
// coarser extension fallback, matching the before/after example on the
// FileCub Office poster (report-final.docx -> เอกสารรายงาน, scan001.pdf ->
// เอกสารสแกน, IMG001.jpg -> รูปภาพ).
const DEFAULT_FOLDER_RULES = [
  { id: "rule-report-name", categoryId: "cat-report", matchType: "filename_pattern", pattern: "report", priority: 10 },
  { id: "rule-scan-name", categoryId: "cat-scan", matchType: "filename_pattern", pattern: "scan", priority: 10 },
  { id: "rule-img-name", categoryId: "cat-image", matchType: "filename_pattern", pattern: "img", priority: 10 },
  { id: "rule-docx", categoryId: "cat-report", matchType: "extension", pattern: ".docx", priority: 5 },
  { id: "rule-doc", categoryId: "cat-report", matchType: "extension", pattern: ".doc", priority: 5 },
  { id: "rule-pdf", categoryId: "cat-scan", matchType: "extension", pattern: ".pdf", priority: 5 },
  { id: "rule-jpg", categoryId: "cat-image", matchType: "extension", pattern: ".jpg", priority: 5 },
  { id: "rule-jpeg", categoryId: "cat-image", matchType: "extension", pattern: ".jpeg", priority: 5 },
  { id: "rule-png", categoryId: "cat-image", matchType: "extension", pattern: ".png", priority: 5 },
] as const;

export function seedFileCategories(db: AgentDb): void {
  const upsertCategory = db.prepare(`
    INSERT INTO file_categories (id, name_th, icon_key) VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name_th = excluded.name_th, icon_key = excluded.icon_key
  `);
  for (const category of DEFAULT_CATEGORIES) {
    upsertCategory.run(category.id, category.nameTh, category.iconKey);
  }

  const upsertRule = db.prepare(`
    INSERT INTO folder_rules (id, category_id, match_type, pattern, priority) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      category_id = excluded.category_id,
      match_type = excluded.match_type,
      pattern = excluded.pattern,
      priority = excluded.priority
  `);
  for (const rule of DEFAULT_FOLDER_RULES) {
    upsertRule.run(rule.id, rule.categoryId, rule.matchType, rule.pattern, rule.priority);
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
