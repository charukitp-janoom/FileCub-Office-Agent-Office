import { AgentRegistry } from "./registry";
import { InProcessEventBus } from "./event-bus";
import { attachActivityLogger, type ActivityLogWriter } from "./activity-logger";
import type { AgentContext, PermissionChecker } from "./types";

import { FolderAgent } from "../agents/folder-agent/folder-agent";
import { SearchAgent } from "../agents/search-agent/search-agent";
import { UploadAgent } from "../agents/upload-agent/upload-agent";
import { SecurityAgent } from "../agents/security-agent/security-agent";
import { AiAgent } from "../agents/ai-agent/ai-agent";
import { NotifyAgent } from "../agents/notify-agent/notify-agent";
import { BackupAgent } from "../agents/backup-agent/backup-agent";

export interface BootstrapDeps {
  userId: string;
  activityLogWriter: ActivityLogWriter;
  permissions: PermissionChecker;
}

/**
 * Single place where every agent is registered. Adding agent #8 means
 * adding one line here — nothing else in agent-core, the dashboard, or
 * the achievement engine needs to change.
 */
export async function bootstrapAgentOffice(deps: BootstrapDeps): Promise<AgentRegistry> {
  const registry = new AgentRegistry();
  const eventBus = new InProcessEventBus();
  attachActivityLogger(eventBus, deps.activityLogWriter);

  const agents = [
    new FolderAgent(),
    new SearchAgent(),
    new UploadAgent(),
    new SecurityAgent(),
    new AiAgent(),
    new NotifyAgent(),
    new BackupAgent(),
  ];

  for (const agent of agents) {
    registry.register(agent);

    const ctx: AgentContext = {
      userId: deps.userId,
      eventBus,
      db: { agentId: agent.code },
      permissions: deps.permissions,
      logger: {
        info: (message, meta) => console.info(`[${agent.code}]`, message, meta ?? ""),
        error: (message, meta) => console.error(`[${agent.code}]`, message, meta ?? ""),
      },
    };
    await agent.init(ctx);

    if (agent.onEvent) {
      const boundAgent = agent;
      eventBus.subscribe("file.imported", (event) => void boundAgent.onEvent?.(event));
      eventBus.subscribe("file.organized", (event) => void boundAgent.onEvent?.(event));
      eventBus.subscribe("security.anomaly", (event) => void boundAgent.onEvent?.(event));
      eventBus.subscribe("backup.completed", (event) => void boundAgent.onEvent?.(event));
      eventBus.subscribe("backup.failed", (event) => void boundAgent.onEvent?.(event));
    }
  }

  return registry;
}
