import { useState } from "react";
import { useAgentRegistry } from "./useAgentRegistry";
import { AgentSprite } from "./AgentSprite";
import { AgentDetailDrawer } from "./AgentDetailDrawer";
import type { AgentSummary } from "./types";
import "./agent-office.css";

/** Top-level screen for the "🤖 Agent Office" menu (docs/agent-office/03-ui-flow.md §3.2). */
export function AgentOfficeRoom() {
  const { agents, loading, error, refresh } = useAgentRegistry();
  const [selected, setSelected] = useState<AgentSummary | null>(null);

  return (
    <div className="office-page">
      <div className="office-topbar">
        <h1>
          🤖 Agent Office <span style={{ color: "var(--fc-text-muted)", fontWeight: 400, fontSize: 13 }}>— FileCub Office</span>
        </h1>
        <span className="coin">🪙 2,560</span>
      </div>

      <div className="office-room">
        <p className="office-room-title">ทีมผู้ช่วย AI ประจำสำนักงานของคุณ ({agents.length}/7)</p>

        {loading && <p>กำลังโหลด Agent...</p>}
        {error && <p style={{ color: "var(--fc-error)" }}>{error}</p>}

        <div className="agent-grid">
          {agents.map((agent) => (
            <AgentSprite key={agent.code} agent={agent} onClick={setSelected} />
          ))}
        </div>
      </div>

      {selected && (
        <AgentDetailDrawer agent={selected} onClose={() => setSelected(null)} onRan={refresh} />
      )}
    </div>
  );
}
