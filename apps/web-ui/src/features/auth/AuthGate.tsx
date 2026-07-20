import { useState, type FormEvent } from "react";
import { agentOfficeApi } from "../agent-office/api";
import type { AuthPhase } from "./useAuth";
import "./AuthGate.css";

interface AuthGateProps {
  phase: Extract<AuthPhase, "needs-setup" | "needs-login">;
  onAuthenticated: () => void;
}

/** First-run password setup, or the login form for every run after — see SECURITY.md. */
export function AuthGate({ phase, onAuthenticated }: AuthGateProps) {
  const isSetup = phase === "needs-setup";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (isSetup && password.length < 8) {
      setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }
    if (isSetup && password !== confirm) {
      setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }

    setBusy(true);
    try {
      const res = await (isSetup ? agentOfficeApi.setup(password) : agentOfficeApi.login(password));
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
        return;
      }
      onAuthenticated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-gate">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>🐾 FileCub Office</h1>
        <p className="auth-subtitle">
          {isSetup ? "ตั้งรหัสผ่านสำหรับเข้าใช้งานเครื่องนี้ครั้งแรก" : "ใส่รหัสผ่านเพื่อเข้าสู่ Agent Office"}
        </p>

        <input
          type="password"
          placeholder="รหัสผ่าน"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {isSetup && (
          <input
            type="password"
            placeholder="ยืนยันรหัสผ่าน"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        )}

        {error && <p className="auth-error">{error}</p>}
        {isSetup && !error && <p className="auth-hint">อย่างน้อย 8 ตัวอักษร — ใช้ป้องกันเครื่องนี้เท่านั้น (ไม่ใช่ระบบ multi-user)</p>}

        <button type="submit" className="primary-action" disabled={busy || !password}>
          {busy ? "กำลังดำเนินการ..." : isSetup ? "ตั้งรหัสผ่านและเข้าใช้งาน" : "เข้าสู่ระบบ"}
        </button>
      </form>
    </div>
  );
}
