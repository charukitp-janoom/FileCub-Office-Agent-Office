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

/**
 * Turns an event's payload into a human-readable Thai line for the
 * activity feed. Each case reads only the fields that specific event is
 * documented to carry (see AgentEventName in ./types); unrecognized event
 * names fall back to a generic "<agent>: <event>" line.
 */
function summarize(event: AgentEvent): string {
  const payload = event.payload as Record<string, unknown> | undefined;

  switch (event.name) {
    case "file.imported":
      return payload?.fileName ? `นำเข้าไฟล์ "${payload.fileName}"` : "นำเข้าไฟล์ใหม่";
    case "file.organized":
      return payload?.fileName && payload?.categoryNameTh
        ? `จัดไฟล์ "${payload.fileName}" เข้า "${payload.categoryNameTh}"`
        : "จัดหมวดหมู่ไฟล์";
    case "file.searched":
      return payload?.query ? `ค้นหา "${payload.query}"` : "ค้นหาไฟล์";
    case "achievement.unlocked":
      return payload?.achievementNameTh ? `ปลดล็อกความสำเร็จ "${payload.achievementNameTh}"` : "ปลดล็อกความสำเร็จ";
    default:
      return `${event.sourceAgent}: ${event.name}`;
  }
}
