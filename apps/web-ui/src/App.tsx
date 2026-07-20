import { useState } from "react";
import { AgentOfficeRoom } from "./features/agent-office/AgentOfficeRoom";
import { AchievementPage } from "./features/achievement/AchievementPage";
import { AchievementToast } from "./features/achievement/AchievementToast";
import { AuthGate } from "./features/auth/AuthGate";
import { useAuth } from "./features/auth/useAuth";

type View = "room" | "achievements";

export function App() {
  const [view, setView] = useState<View>("room");
  const { phase, refresh, logout } = useAuth();

  if (phase === "loading") return null;

  if (phase === "needs-setup" || phase === "needs-login") {
    return <AuthGate phase={phase} onAuthenticated={refresh} />;
  }

  return (
    <>
      <AchievementToast />
      {view === "room" ? (
        <AgentOfficeRoom onOpenAchievements={() => setView("achievements")} onLogout={logout} />
      ) : (
        <AchievementPage onBack={() => setView("room")} />
      )}
    </>
  );
}
