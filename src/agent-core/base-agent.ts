import type {
  AgentCapability,
  AgentCode,
  AgentContext,
  AgentEvent,
  AgentRunResult,
  AgentStatus,
  IAgent,
} from "./types";

/**
 * Shared plumbing (status tracking, context storage) so each concrete
 * agent only has to implement runCapability() and, optionally, onEvent().
 */
export abstract class BaseAgent implements IAgent {
  abstract code: AgentCode;
  abstract nameTh: string;
  abstract nicknameTh: string;
  abstract roleTitleTh: string;
  abstract icon: string;
  abstract capabilities: AgentCapability[];

  protected ctx?: AgentContext;
  private status: AgentStatus = { state: "idle" };

  async init(ctx: AgentContext): Promise<void> {
    this.ctx = ctx;
    this.status = { state: "idle" };
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  protected setStatus(status: AgentStatus): void {
    this.status = status;
  }

  abstract runCapability(key: string, payload?: unknown): Promise<AgentRunResult>;

  async onEvent?(_event: AgentEvent): Promise<void> {
    // Concrete agents override this to react to events published by others.
  }

  async dispose(): Promise<void> {
    this.status = { state: "disabled" };
  }
}
