import { useState, type FormEvent } from "react";
import { agentOfficeApi } from "./api";

/**
 * Cub AI Agent's bespoke drawer section. Scoped to "qa-about-app" for
 * this UI — chat-with-document/summarize need real extracted document
 * text, which isn't wired up yet (no PDF/DOCX parser in this phase).
 */
interface AiAskBoxProps {
  onDone: () => void;
}

export function AiAskBox({ onDone }: AiAskBoxProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setAsking(true);
    try {
      const result = await agentOfficeApi.runCapability("ai", "qa-about-app", { question });
      setAnswer(result.summaryTh);
      onDone();
    } finally {
      setAsking(false);
    }
  }

  return (
    <>
      <h3 className="drawer__section-title">ถาม Cub AI เกี่ยวกับโปรแกรม</h3>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="เช่น จะเปิด Desktop อัตโนมัติยังไง"
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid var(--fc-border)",
            background: "var(--fc-bg-card)",
            color: "var(--fc-text)",
          }}
        />
        <button type="submit" className="primary-action" style={{ width: "auto", margin: 0 }} disabled={asking || !question.trim()}>
          {asking ? "กำลังคิด..." : "ถาม"}
        </button>
      </form>
      {answer && <p className="run-feedback">{answer}</p>}
    </>
  );
}
