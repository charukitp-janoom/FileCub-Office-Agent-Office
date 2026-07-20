import { useEffect, useState } from "react";
import { agentOfficeApi } from "../agent-office/api";
import type { NotificationItem } from "../agent-office/types";

interface NotificationCenterProps {
  onChange: () => void;
}

const TYPE_ICON: Record<string, string> = {
  new_file: "📄",
  security: "🛡️",
  backup: "💾",
  important_doc: "⚠️",
  license: "🔑",
  update: "⬆️",
  task: "📝",
};

/** Cub Notify Agent's bespoke drawer section — docs/agent-office/03-ui-flow.md §3.5. */
export function NotificationCenter({ onChange }: NotificationCenterProps) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [busy, setBusy] = useState(false);

  function refresh() {
    agentOfficeApi.getNotifications().then(setItems).catch(() => setItems([]));
  }

  useEffect(refresh, []);

  async function handleRead(id: string) {
    await agentOfficeApi.markNotificationRead(id);
    refresh();
    onChange();
  }

  async function handleReadAll() {
    setBusy(true);
    try {
      await agentOfficeApi.markAllNotificationsRead();
      refresh();
      onChange();
    } finally {
      setBusy(false);
    }
  }

  const unreadCount = items.filter((i) => !i.isRead).length;

  return (
    <>
      <h3 className="drawer__section-title">การแจ้งเตือน {unreadCount > 0 && `(${unreadCount} ใหม่)`}</h3>
      {items.length === 0 && <p className="activity-item">ยังไม่มีการแจ้งเตือน</p>}
      {items.map((item) => (
        <div
          className="activity-item"
          key={item.id}
          style={{ opacity: item.isRead ? 0.55 : 1, display: "flex", justifyContent: "space-between", gap: 8 }}
        >
          <span>
            {TYPE_ICON[item.type] ?? "🔔"} <strong>{item.titleTh}</strong> — {item.messageTh}
          </span>
          {!item.isRead && (
            <button
              type="button"
              onClick={() => handleRead(item.id)}
              style={{ background: "none", border: "none", color: "var(--fc-blue)", fontSize: 11, cursor: "pointer" }}
            >
              อ่านแล้ว
            </button>
          )}
        </div>
      ))}
      {unreadCount > 0 && (
        <button type="button" className="primary-action" onClick={handleReadAll} disabled={busy}>
          {busy ? "กำลังดำเนินการ..." : "ทำเครื่องหมายอ่านแล้วทั้งหมด"}
        </button>
      )}
    </>
  );
}
