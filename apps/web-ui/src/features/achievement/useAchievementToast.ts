import { useEffect, useRef, useState } from "react";
import { agentOfficeApi } from "../agent-office/api";
import type { NotificationItem } from "../agent-office/types";

const POLL_INTERVAL_MS = 4000;
const AUTO_DISMISS_MS = 5000;

/**
 * Polls for unread `achievement` notifications and surfaces each new one
 * as a center-screen toast exactly once (docs/agent-office/03-ui-flow.md
 * §3.5's "toast แสดงกลางจอ"). Doesn't touch read state — the achievement
 * still shows normally in the Notification Center afterwards.
 */
export function useAchievementToast() {
  const [toast, setToast] = useState<NotificationItem | null>(null);
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const unread = await agentOfficeApi.getNotifications(true);
        const fresh = unread.find((n) => n.type === "achievement" && !seenIds.current.has(n.id));
        if (fresh && !cancelled) {
          seenIds.current.add(fresh.id);
          setToast(fresh);
          setTimeout(() => setToast((current) => (current?.id === fresh.id ? null : current)), AUTO_DISMISS_MS);
        }
      } catch {
        // best-effort
      }
    }

    void poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return toast;
}
