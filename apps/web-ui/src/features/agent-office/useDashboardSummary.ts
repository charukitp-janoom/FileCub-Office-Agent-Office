import { useCallback, useEffect, useState } from "react";
import { agentOfficeApi } from "./api";
import type { DashboardSummary } from "./types";

const POLL_INTERVAL_MS = 4000;

const EMPTY_SUMMARY: DashboardSummary = {
  filesToday: 0,
  filesOrganized: 0,
  storageSavedBytes: 0,
  filesBackedUp: 0,
  aiTasksCompleted: 0,
};

/** Agent Office Dashboard tiles — live counts straight from agent_activity_logs/files/backup_jobs. */
export function useDashboardSummary() {
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);

  const refresh = useCallback(async () => {
    try {
      setSummary(await agentOfficeApi.getDashboardSummary());
    } catch {
      // Dashboard tiles are a nice-to-have on this screen; fail quietly.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return { summary, refresh };
}
