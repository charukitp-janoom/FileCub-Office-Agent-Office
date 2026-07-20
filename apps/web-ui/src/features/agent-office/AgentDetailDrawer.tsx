import { useCallback, useEffect, useState } from "react";
import { agentOfficeApi } from "./api";
import { agentUIConfig } from "./agentUIConfig";
import { DesktopWatchToggle } from "./DesktopWatchToggle";
import { SearchBox } from "./SearchBox";
import { AiAskBox } from "./AiAskBox";
import type { ActivityLogEntry, AgentSummary } from "./types";

interface AgentDetailDrawerProps {
  agent: AgentSummary;
  onClose: () => void;
  onRan: () => void;
}

/**
 * Generic drawer used for all 7 agents (docs/agent-office/03-ui-flow.md §3.3):
 * renders capabilities + recent activity straight from the API, with the
 * only per-agent difference being the primary action defined in
 * agentUIConfig.ts.
 */
export function AgentDetailDrawer({ agent, onClose, onRan }: AgentDetailDrawerProps) {
  const [activity, setActivity] = useState<ActivityLogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const config = agentUIConfig[agent.code];

  const refreshActivity = useCallback(() => {
    agentOfficeApi
      .getActivity(agent.code, 5)
      .then(setActivity)
      .catch(() => setActivity([]));
  }, [agent.code]);

  useEffect(() => {
    refreshActivity();
  }, [refreshActivity]);

  function handleSideEffectDone() {
    refreshActivity();
    onRan();
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handlePrimaryAction() {
    if (!config.primaryCapability) return;
    setRunning(true);
    setFeedback(null);
    try {
      const result = await agentOfficeApi.runCapability(agent.code, config.primaryCapability);
      setFeedback(result.summaryTh);
      handleSideEffectDone();
    } catch {
      setFeedback("เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="drawer__header">
          <div>
            <h2 className="drawer__title">
              <span aria-hidden="true">{config.emoji}</span>
              {agent.nameTh} ({agent.nicknameTh})
            </h2>
            <p className="drawer__role">{agent.roleTitleTh}</p>
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="ปิด">
            ×
          </button>
        </div>

        <h3 className="drawer__section-title">ความสามารถ</h3>
        {agent.capabilities.map((capability) => (
          <div className="capability-row" key={capability.key}>
            <div>
              <div className="capability-row__label">{capability.labelTh}</div>
              <div className="capability-row__desc">{capability.descriptionTh}</div>
            </div>
            <span className={`badge ${capability.enabled ? "badge--on" : "badge--off"}`}>
              {capability.enabled ? "เปิด" : "ปิด"}
            </span>
          </div>
        ))}

        <h3 className="drawer__section-title">กิจกรรมล่าสุด</h3>
        {activity.length === 0 && <p className="activity-item">ยังไม่มีกิจกรรม</p>}
        {activity.map((entry) => (
          <div className="activity-item" key={entry.id}>
            {entry.summaryTh} — {new Date(entry.createdAt).toLocaleString("th-TH")}
          </div>
        ))}

        {agent.code === "upload" && <DesktopWatchToggle onChange={handleSideEffectDone} />}
        {agent.code === "search" && <SearchBox onDone={handleSideEffectDone} />}
        {agent.code === "ai" && <AiAskBox onDone={handleSideEffectDone} />}

        {config.primaryCapability && (
          <button type="button" className="primary-action" onClick={handlePrimaryAction} disabled={running}>
            {running ? "กำลังทำงาน..." : config.primaryActionLabelTh}
          </button>
        )}
        {feedback && <p className="run-feedback">{feedback}</p>}
      </div>
    </div>
  );
}
