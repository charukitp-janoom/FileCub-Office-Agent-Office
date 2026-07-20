import { useCallback, useEffect, useState } from "react";
import { agentOfficeApi } from "./api";
import type { AgentSummary } from "./types";

const POLL_INTERVAL_MS = 4000;

/** Fetches the agent list from the API and keeps status badges reasonably fresh. */
export function useAgentRegistry() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await agentOfficeApi.listAgents();
      setAgents(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูล Agent ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return { agents, loading, error, refresh };
}
