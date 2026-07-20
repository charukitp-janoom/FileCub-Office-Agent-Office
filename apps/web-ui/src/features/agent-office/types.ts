export type AgentCode = "folder" | "search" | "upload" | "security" | "ai" | "notify" | "backup";

export interface AgentCapability {
  key: string;
  labelTh: string;
  descriptionTh: string;
  enabled: boolean;
}

export interface AgentStatus {
  state: "idle" | "working" | "error" | "disabled";
  lastRunAt?: string;
  message?: string;
  progress?: number;
}

export interface AgentSummary {
  code: AgentCode;
  nameTh: string;
  nicknameTh: string;
  roleTitleTh: string;
  icon: string;
  capabilities: AgentCapability[];
  status: AgentStatus;
}

export interface ActivityLogEntry {
  id: string;
  agentId: string;
  eventName: string;
  summaryTh: string;
  createdAt: string;
}

export interface AgentRunResult {
  success: boolean;
  summaryTh: string;
  data?: unknown;
}

export interface WatchStatus {
  watching: boolean;
  path?: string;
}

export interface DashboardSummary {
  filesToday: number;
  filesOrganized: number;
  storageSavedBytes: number;
  filesBackedUp: number;
  aiTasksCompleted: number;
}

export interface DashboardTrendPoint extends DashboardSummary {
  date: string;
}

export interface SearchHit {
  fileId: string;
  name: string;
  categoryNameTh: string | null;
  snippet: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  titleTh: string;
  messageTh: string;
  isRead: boolean;
  createdAt: string;
}

export interface Achievement {
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
