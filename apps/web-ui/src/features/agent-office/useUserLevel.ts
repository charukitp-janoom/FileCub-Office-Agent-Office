import { useCallback, useEffect, useState } from "react";
import { agentOfficeApi } from "./api";
import type { UserLevel } from "./types";

const POLL_INTERVAL_MS = 5000;
const DEFAULT_LEVEL: UserLevel = { levelName: "Beginner", currentExp: 0, nextLevelExp: 500 };

export function useUserLevel() {
  const [level, setLevel] = useState<UserLevel>(DEFAULT_LEVEL);

  const refresh = useCallback(() => {
    agentOfficeApi.getUserLevel().then(setLevel).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return { level, refresh };
}
