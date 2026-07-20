import type { ActivityLogEntry, AgentRunResult, AgentSummary } from "./types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export const agentOfficeApi = {
  listAgents: () => fetch("/api/agents").then((r) => json<AgentSummary[]>(r)),
  getActivity: (code: string, limit = 10) =>
    fetch(`/api/agents/${code}/activity?limit=${limit}`).then((r) => json<ActivityLogEntry[]>(r)),
  runCapability: (code: string, capability: string) =>
    fetch(`/api/agents/${code}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ capability }),
    }).then((r) => json<AgentRunResult>(r)),
};
