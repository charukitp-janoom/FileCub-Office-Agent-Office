import { useEffect, useState } from "react";
import { agentOfficeApi } from "./api";
import type { WatchStatus } from "./types";

interface DesktopWatchToggleProps {
  onChange: () => void;
}

/**
 * Bespoke section for Cub Upload Agent's headline feature — the poster's
 * "นำเข้าไฟล์จาก Desktop อัตโนมัติ" flow. Toggles chokidar watching the
 * demo desktop folder the API server manages (docs/agent-office/03-ui-flow.md §3.5).
 */
export function DesktopWatchToggle({ onChange }: DesktopWatchToggleProps) {
  const [status, setStatus] = useState<WatchStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    agentOfficeApi.getWatchStatus().then(setStatus).catch(() => setStatus({ watching: false }));
  }, []);

  async function toggle() {
    setBusy(true);
    try {
      const next = await agentOfficeApi.setWatch(!status?.watching);
      setStatus(next);
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h3 className="drawer__section-title">Desktop Auto Import</h3>
      <p className="capability-row__desc">
        {status?.watching
          ? `กำลังเฝ้าดูโฟลเดอร์: ${status.path}`
          : "เปิดโหมด Auto เพื่อให้ระบบนำเข้าไฟล์ใหม่จากโฟลเดอร์สาธิตอัตโนมัติ"}
      </p>
      <button type="button" className="primary-action" onClick={toggle} disabled={busy || !status}>
        {busy ? "กำลังดำเนินการ..." : status?.watching ? "ปิดโหมด Auto" : "เปิดโหมด Auto"}
      </button>
    </>
  );
}
