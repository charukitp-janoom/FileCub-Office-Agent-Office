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
  // search and ai both need a real payload (query / question) the generic
  // no-argument button can't supply — they get bespoke input boxes instead
  // (SearchBox.tsx, AiAskBox.tsx), same pattern as upload's watch toggle.
  search: { emoji: "🔍" },
  upload: { emoji: "☁️" },
  security: { emoji: "🛡️", primaryCapability: "activity-log", primaryActionLabelTh: "ตรวจสอบ Activity Log" },
  ai: { emoji: "🤖" },
  // notify gets a real Notification Center (NotificationCenter.tsx) instead
  // of the generic button — its 5 declared capabilities are event-driven
  // triggers, not something a no-argument button meaningfully "runs".
  notify: { emoji: "📧" },
  backup: { emoji: "💾", primaryCapability: "auto-backup", primaryActionLabelTh: "สำรองข้อมูลตอนนี้" },
};
