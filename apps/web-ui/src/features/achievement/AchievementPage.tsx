import { useEffect, useState } from "react";
import { agentOfficeApi } from "../agent-office/api";
import type { Achievement, UserLevel } from "../agent-office/types";
import { LevelProgressBar } from "./LevelProgressBar";
import { AchievementBadge } from "./AchievementBadge";
import "./achievement.css";

interface AchievementPageProps {
  onBack: () => void;
}

const DEFAULT_LEVEL: UserLevel = { levelName: "Beginner", currentExp: 0, nextLevelExp: 500 };

/** docs/agent-office/03-ui-flow.md §3.7. */
export function AchievementPage({ onBack }: AchievementPageProps) {
  const [level, setLevel] = useState<UserLevel>(DEFAULT_LEVEL);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    agentOfficeApi.getUserLevel().then(setLevel).catch(() => {});
    agentOfficeApi.getAchievements().then(setAchievements).catch(() => setAchievements([]));
  }, []);

  return (
    <div className="office-page">
      <div className="office-topbar">
        <h1>
          🏆 Achievement <span style={{ color: "var(--fc-text-muted)", fontWeight: 400, fontSize: 13 }}>— FileCub Office</span>
        </h1>
        <button type="button" className="drawer__close" onClick={onBack} aria-label="กลับ" style={{ fontSize: 15 }}>
          ← กลับหน้า Agent Office
        </button>
      </div>

      <div className="office-room">
        <LevelProgressBar level={level} />

        <p className="office-room-title" style={{ marginTop: 24 }}>
          ความสำเร็จทั้งหมด ({achievements.filter((a) => a.unlocked).length}/{achievements.length})
        </p>
        {achievements.map((a) => (
          <AchievementBadge key={a.code} achievement={a} />
        ))}
      </div>
    </div>
  );
}
