import { useCallback, useEffect, useState } from "react";
import { agentOfficeApi } from "./api";

const POLL_INTERVAL_MS = 5000;

/** Powers the unread-count badge on Cub Notify Agent's sprite (docs/agent-office/03-ui-flow.md §3.2). */
export function useUnreadNotifications() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const unread = await agentOfficeApi.getNotifications(true);
      setCount(unread.length);
    } catch {
      // best-effort — badge just stays at its last known value
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return { count, refresh };
}
