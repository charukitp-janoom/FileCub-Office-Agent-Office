import type { UserLevel } from "../agent-office/types";

const LEVEL_ORDER = ["Beginner", "Office User", "File Master", "AI Commander"];

interface LevelProgressBarProps {
  level: UserLevel;
  compact?: boolean;
}

/** Beginner -> Office User -> File Master -> AI Commander, per docs/agent-office/03-ui-flow.md §3.7. */
export function LevelProgressBar({ level, compact = false }: LevelProgressBarProps) {
  const pct = level.nextLevelExp > 0 ? Math.min(100, Math.round((level.currentExp / level.nextLevelExp) * 100)) : 100;

  return (
    <div className={compact ? "level-bar level-bar--compact" : "level-bar"}>
      {!compact && (
        <div className="level-bar__track-label">
          {LEVEL_ORDER.map((name) => (
            <span key={name} className={name === level.levelName ? "level-bar__step level-bar__step--current" : "level-bar__step"}>
              {name}
            </span>
          ))}
        </div>
      )}
      <div className="level-bar__label">
        {compact ? level.levelName : `Level ปัจจุบัน: ${level.levelName}`} — {level.currentExp}/{level.nextLevelExp} EXP
      </div>
      <div className="level-bar__track">
        <div className="level-bar__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
