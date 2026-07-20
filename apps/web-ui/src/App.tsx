import { useState } from "react";
import { AgentOfficeRoom } from "./features/agent-office/AgentOfficeRoom";
import { AchievementPage } from "./features/achievement/AchievementPage";
import { AchievementToast } from "./features/achievement/AchievementToast";

type View = "room" | "achievements";

export function App() {
  const [view, setView] = useState<View>("room");

  return (
    <>
      <AchievementToast />
      {view === "room" ? (
        <AgentOfficeRoom onOpenAchievements={() => setView("achievements")} />
      ) : (
        <AchievementPage onBack={() => setView("room")} />
      )}
    </>
  );
}
