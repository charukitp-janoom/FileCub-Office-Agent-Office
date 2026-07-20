import { agentUIConfig } from "./agentUIConfig";
import type { AgentSummary } from "./types";

interface AgentSpriteProps {
  agent: AgentSummary;
  onClick: (agent: AgentSummary) => void;
}

const STATUS_LABEL_TH: Record<string, string> = {
  idle: "ว่าง",
  working: "กำลังทำงาน",
  error: "ผิดพลาด",
  disabled: "ปิดใช้งาน",
};

export function AgentSprite({ agent, onClick }: AgentSpriteProps) {
  const config = agentUIConfig[agent.code];

  return (
    <button type="button" className="agent-sprite" onClick={() => onClick(agent)}>
      <span className="agent-sprite__icon" aria-hidden="true">
        {config.emoji}
      </span>
      <span className="agent-sprite__nickname">{agent.nicknameTh}</span>
      <span className="agent-sprite__role">{agent.roleTitleTh}</span>
      <span className="agent-sprite__status">
        <span className={`status-dot status-dot--${agent.status.state}`} aria-hidden="true" />
        {STATUS_LABEL_TH[agent.status.state] ?? agent.status.state}
      </span>
    </button>
  );
}
