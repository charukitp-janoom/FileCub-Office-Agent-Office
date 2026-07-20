import { useState, type FormEvent } from "react";
import { agentOfficeApi } from "./api";
import type { AgentRunResult, SearchHit } from "./types";

interface SearchBoxProps {
  onDone: () => void;
}

/** Cub Search Agent's bespoke drawer section — a real search box instead of the generic run button. */
export function SearchBox({ onDone }: SearchBoxProps) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSearching(true);
    try {
      const result: AgentRunResult = await agentOfficeApi.runCapability("search", "search-by-name", { query });
      setSummary(result.summaryTh);
      setHits(((result.data as { hits: SearchHit[] } | undefined)?.hits) ?? []);
      onDone();
    } finally {
      setSearching(false);
    }
  }

  return (
    <>
      <h3 className="drawer__section-title">ค้นหาไฟล์</h3>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="พิมพ์คำค้น เช่น รายงาน, มกราคม..."
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid var(--fc-border)",
            background: "var(--fc-bg-card)",
            color: "var(--fc-text)",
          }}
        />
        <button type="submit" className="primary-action" style={{ width: "auto", margin: 0 }} disabled={searching || !query.trim()}>
          {searching ? "กำลังค้นหา..." : "ค้นหา"}
        </button>
      </form>
      {summary && <p className="run-feedback">{summary}</p>}
      {hits?.map((hit) => (
        <div className="activity-item" key={hit.fileId}>
          <strong>{hit.name}</strong> — {hit.categoryNameTh ?? "ไม่มีหมวดหมู่"}
          <br />
          <span style={{ color: "var(--fc-text-muted)" }}>{hit.snippet}</span>
        </div>
      ))}
    </>
  );
}
