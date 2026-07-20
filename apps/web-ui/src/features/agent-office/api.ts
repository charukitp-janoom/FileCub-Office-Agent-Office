import type { ActivityLogEntry, AgentRunResult, AgentSummary, DashboardSummary, WatchStatus } from "./types";

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
  getWatchStatus: () => fetch("/api/agents/upload/watch").then((r) => json<WatchStatus>(r)),
  setWatch: (enabled: boolean) =>
    fetch("/api/agents/upload/watch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    }).then((r) => json<WatchStatus>(r)),
  getDashboardSummary: () => fetch("/api/dashboard/summary").then((r) => json<DashboardSummary>(r)),
};
