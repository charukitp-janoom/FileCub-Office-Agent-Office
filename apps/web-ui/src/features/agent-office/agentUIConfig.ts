import type { AgentCode } from "./types";

export interface AgentUIConfig {
  emoji: string;
  /** Omit for agents whose primary action needs a real payload the generic
   * button can't supply (folder/upload) — they get a bespoke drawer section
   * instead (see AgentDetailDrawer.tsx). */
  primaryCapability?: string;
  primaryActionLabelTh?: string;
}

/**
 * Per-agent overrides for the otherwise-generic Agent Detail Drawer, per
 * docs/agent-office/04-component-structure.md §4.3. Adding agent #8 means
 * adding one entry here — the drawer component itself never changes.
 */
export const agentUIConfig: Record<AgentCode, AgentUIConfig> = {
  folder: { emoji: "🗂️" },
  search: { emoji: "🔍", primaryCapability: "search-by-name", primaryActionLabelTh: "ลองค้นหา" },
  upload: { emoji: "☁️" },
  security: { emoji: "🛡️", primaryCapability: "activity-log", primaryActionLabelTh: "ตรวจสอบ Activity Log" },
  ai: { emoji: "🤖", primaryCapability: "qa-about-app", primaryActionLabelTh: "ถาม Cub AI" },
  notify: { emoji: "📧", primaryCapability: "new-file-alert", primaryActionLabelTh: "ทดสอบแจ้งเตือน" },
  backup: { emoji: "💾", primaryCapability: "auto-backup", primaryActionLabelTh: "สำรองข้อมูลตอนนี้" },
};
