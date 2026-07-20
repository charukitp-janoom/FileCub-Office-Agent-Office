import { useState } from "react";
import { useAgentRegistry } from "./useAgentRegistry";
import { useDashboardSummary } from "./useDashboardSummary";
import { useUnreadNotifications } from "./useUnreadNotifications";
import { AgentSprite } from "./AgentSprite";
import { AgentDetailDrawer } from "./AgentDetailDrawer";
import type { AgentSummary } from "./types";
import "./agent-office.css";

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Top-level screen for the "🤖 Agent Office" menu (docs/agent-office/03-ui-flow.md §3.2). */
export function AgentOfficeRoom() {
  const { agents, loading, error, refresh } = useAgentRegistry();
  const { summary, refresh: refreshDashboard } = useDashboardSummary();
  const { count: unreadCount, refresh: refreshUnread } = useUnreadNotifications();
  const [selected, setSelected] = useState<AgentSummary | null>(null);

  function handleAgentRan() {
    refresh();
    refreshDashboard();
    refreshUnread();
  }

  return (
    <div className="office-page">
      <div className="office-topbar">
        <h1>
          🤖 Agent Office <span style={{ color: "var(--fc-text-muted)", fontWeight: 400, fontSize: 13 }}>— FileCub Office</span>
        </h1>
        <span className="coin">🪙 2,560</span>
      </div>

      <div className="dashboard-tiles">
        <div className="dashboard-tile">
          <div className="dashboard-tile__label">📄 ไฟล์วันนี้</div>
          <div className="dashboard-tile__value">{summary.filesToday}</div>
        </div>
        <div className="dashboard-tile">
          <div className="dashboard-tile__label">📁 จัดระเบียบแล้ว</div>
          <div className="dashboard-tile__value">{summary.filesOrganized}</div>
        </div>
        <div className="dashboard-tile">
          <div className="dashboard-tile__label">💾 ประหยัดพื้นที่</div>
          <div className="dashboard-tile__value">{formatBytes(summary.storageSavedBytes)}</div>
        </div>
        <div className="dashboard-tile">
          <div className="dashboard-tile__label">☁️ Backup แล้ว</div>
          <div className="dashboard-tile__value">{summary.filesBackedUp}</div>
        </div>
        <div className="dashboard-tile">
          <div className="dashboard-tile__label">🤖 งานที่ AI ช่วย</div>
          <div className="dashboard-tile__value">{summary.aiTasksCompleted}</div>
        </div>
      </div>

      <div className="office-room">
        <p className="office-room-title">ทีมผู้ช่วย AI ประจำสำนักงานของคุณ ({agents.length}/7)</p>

        {loading && <p>กำลังโหลด Agent...</p>}
        {error && <p style={{ color: "var(--fc-error)" }}>{error}</p>}

        <div className="agent-grid">
          {agents.map((agent) => (
            <AgentSprite
              key={agent.code}
              agent={agent}
              onClick={setSelected}
              unreadCount={agent.code === "notify" ? unreadCount : 0}
            />
          ))}
        </div>
      </div>

      {selected && (
        <AgentDetailDrawer agent={selected} onClose={() => setSelected(null)} onRan={handleAgentRan} />
      )}
    </div>
  );
}
