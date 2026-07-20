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
}
