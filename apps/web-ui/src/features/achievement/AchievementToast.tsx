import { useAchievementToast } from "./useAchievementToast";
import "./achievement.css";

export function AchievementToast() {
  const toast = useAchievementToast();
  if (!toast) return null;

  return (
    <div className="achievement-toast" role="status">
      🏆 {toast.messageTh}
    </div>
  );
}
