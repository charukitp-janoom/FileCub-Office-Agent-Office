import type { AgentEvent, AgentEventBus, AgentEventName } from "./types";

export interface ActivityLogRecord {
  id: string;
  agentId: string;
  userId: string;
  eventName: AgentEventName;
  summaryTh: string;
  expGained: number;
  createdAt: string;
}

export interface ActivityLogWriter {
  insert(record: ActivityLogRecord): Promise<void>;
}

const ALL_EVENTS: AgentEventName[] = [
  "file.imported",
  "file.organized",
  "file.searched",
  "security.anomaly",
  "security.permission_denied",
  "ai.summary_ready",
  "backup.completed",
  "backup.failed",
  "achievement.unlocked",
];

/**
 * Subscribes to every known event once and writes it to agent_activity_logs.
 * This is what lets Dashboard and Achievement stay generic consumers of the
 * log instead of each agent implementing its own stat-counting logic.
 */
export function attachActivityLogger(bus: AgentEventBus, writer: ActivityLogWriter): void {
  for (const eventName of ALL_EVENTS) {
    bus.subscribe(eventName, (event: AgentEvent) => {
      void writer.insert({
        id: crypto.randomUUID(),
        agentId: event.sourceAgent,
        userId: event.userId,
        eventName: event.name,
        summaryTh: summarize(event),
        expGained: 0,
        createdAt: event.createdAt,
      });
    });
  }
}

function summarize(event: AgentEvent): string {
  return `${event.sourceAgent}: ${event.name}`;
}
