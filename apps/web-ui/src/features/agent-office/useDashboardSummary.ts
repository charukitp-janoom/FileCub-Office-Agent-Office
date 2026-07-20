import { useCallback, useEffect, useState } from "react";
import { agentOfficeApi } from "./api";
import type { DashboardSummary } from "./types";

const POLL_INTERVAL_MS = 4000;

/** Phase 1's "Dashboard tile พื้นฐาน" — live counts straight from agent_activity_logs. */
export function useDashboardSummary() {
  const [summary, setSummary] = useState<DashboardSummary>({ filesToday: 0, filesOrganized: 0 });

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
