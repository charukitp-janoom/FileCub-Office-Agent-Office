import { useCallback, useEffect, useState } from "react";
import { agentOfficeApi } from "../agent-office/api";

export type AuthPhase = "loading" | "needs-setup" | "needs-login" | "authenticated";

export function useAuth() {
  const [phase, setPhase] = useState<AuthPhase>("loading");

  const refresh = useCallback(async () => {
    const status = await agentOfficeApi.getAuthStatus();
    if (!status.configured) setPhase("needs-setup");
    else if (!status.authenticated) setPhase("needs-login");
    else setPhase("authenticated");
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await agentOfficeApi.logout();
    setPhase("needs-login");
  }, []);

  return { phase, refresh, logout };
}
