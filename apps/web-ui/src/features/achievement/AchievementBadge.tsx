import type { Achievement } from "../agent-office/types";

interface AchievementBadgeProps {
  achievement: Achievement;
}

export function AchievementBadge({ achievement }: AchievementBadgeProps) {
  const pct = Math.min(100, Math.round((achievement.progress / achievement.criteriaCount) * 100));

  return (
    <div className="achievement-row">
      <span className="achievement-row__icon" aria-hidden="true">
        {achievement.unlocked ? achievement.iconKey : "🔒"}
      </span>
      <div className="achievement-row__body">
        <div className="achievement-row__title">{achievement.nameTh}</div>
        <div className="achievement-row__desc">{achievement.descriptionTh}</div>
        {achievement.unlocked ? (
          <div className="achievement-row__status achievement-row__status--done">
            ✅ ปลดล็อกแล้ว ({achievement.progress}/{achievement.criteriaCount})
          </div>
        ) : (
          <>
            <div className="level-bar__track achievement-row__track">
              <div className="level-bar__fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="achievement-row__status">
              {achievement.progress}/{achievement.criteriaCount}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
