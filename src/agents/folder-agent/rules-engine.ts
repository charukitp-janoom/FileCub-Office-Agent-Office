import type { AgentDb } from "../../shared/db/client";

interface FolderRuleRow {
  category_id: string;
  match_type: "extension" | "filename_pattern";
  pattern: string;
}

const FALLBACK_CATEGORY_ID = "cat-misc";

/**
 * Matches a filename against `folder_rules` (highest priority first) and
 * returns the category it belongs to. Falls back to "เอกสารทั่วไป" when no
 * rule matches, per docs/agent-office/02-database.md §2.4.
 */
export function matchCategory(db: AgentDb, filename: string): string {
  const rules = db
    .prepare("SELECT category_id, match_type, pattern FROM folder_rules ORDER BY priority DESC")
    .all() as unknown as FolderRuleRow[];

  const lowerName = filename.toLowerCase();

  for (const rule of rules) {
    const pattern = rule.pattern.toLowerCase();
    const matches =
      rule.match_type === "extension" ? lowerName.endsWith(pattern) : lowerName.includes(pattern);
    if (matches) return rule.category_id;
  }

  return FALLBACK_CATEGORY_ID;
}
