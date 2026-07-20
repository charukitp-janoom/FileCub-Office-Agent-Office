import type { AgentEvent, AgentEventBus, AgentEventName } from "./types";

type Handler = (event: AgentEvent) => void;

/**
 * In-process event bus. Every publish() is persisted by the caller
 * (see activity-logger.ts) so agent-core stays the single place that
 * writes to agent_activity_logs, not each individual agent.
 */
export class InProcessEventBus implements AgentEventBus {
  private handlers = new Map<AgentEventName, Set<Handler>>();

  async publish(event: AgentEvent): Promise<void> {
    const subscribers = this.handlers.get(event.name);
    if (!subscribers) return;
    for (const handler of subscribers) {
      handler(event);
    }
  }

  subscribe(name: AgentEventName, handler: Handler): () => void {
    if (!this.handlers.has(name)) {
      this.handlers.set(name, new Set());
    }
    this.handlers.get(name)!.add(handler);
    return () => this.handlers.get(name)?.delete(handler);
  }
}
