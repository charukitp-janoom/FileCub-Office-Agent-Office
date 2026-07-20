export type AgentCode =
  | "folder"
  | "search"
  | "upload"
  | "security"
  | "ai"
  | "notify"
  | "backup";

export interface AgentCapability {
  key: string;
  labelTh: string;
  descriptionTh: string;
  enabled: boolean;
  requiresPermission?: string;
}

export type AgentState = "idle" | "working" | "error" | "disabled";

export interface AgentStatus {
  state: AgentState;
  lastRunAt?: string;
  message?: string;
  progress?: number;
}

export interface AgentRunResult {
  success: boolean;
  summaryTh: string;
  expGained?: number;
  data?: unknown;
}

export type AgentEventName =
  | "file.imported"
  | "file.organized"
  | "file.searched"
  | "security.anomaly"
  | "security.permission_denied"
  | "ai.summary_ready"
  | "backup.completed"
  | "backup.failed"
  | "achievement.unlocked";

export interface AgentEvent<T = unknown> {
  name: AgentEventName;
  sourceAgent: AgentCode;
  userId: string;
  payload: T;
  createdAt: string;
}

export interface AgentEventBus {
  publish(event: AgentEvent): Promise<void>;
  subscribe(name: AgentEventName, handler: (event: AgentEvent) => void): () => void;
}

export interface PermissionChecker {
  check(userId: string, action: string, resourceId?: string): Promise<void>;
}

export interface AgentLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface AgentDataAccess {
  agentId: AgentCode;
  /**
   * Raw SQLite handle (node:sqlite `DatabaseSync`), typed loosely here so
   * agent-core's own types stay storage-agnostic — concrete agents import
   * `AgentDb` from shared/db for a typed handle to the same object.
   */
  raw: unknown;
}

export interface AgentContext {
  userId: string;
  eventBus: AgentEventBus;
  db: AgentDataAccess;
  permissions: PermissionChecker;
  logger: AgentLogger;
}

export interface IAgent {
  code: AgentCode;
  nameTh: string;
  nicknameTh: string;
  roleTitleTh: string;
  icon: string;
  capabilities: AgentCapability[];

  init(ctx: AgentContext): Promise<void>;
  getStatus(): AgentStatus;
  runCapability(key: string, payload?: unknown): Promise<AgentRunResult>;
  onEvent?(event: AgentEvent): Promise<void>;
  dispose(): Promise<void>;
}
