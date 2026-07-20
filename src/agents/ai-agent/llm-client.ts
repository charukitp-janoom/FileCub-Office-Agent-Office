/**
 * Thin wrapper around the Claude API (Anthropic Messages API). No SDK
 * dependency — a single fetch call is enough for the one-shot prompts this
 * agent needs. When ANTHROPIC_API_KEY isn't set (offline dev, CI, or a
 * customer site with no internet), `complete()` returns `null` instead of
 * throwing, so every usecase has an explicit, deterministic fallback path —
 * matching the "AI Agent degrades gracefully offline" decision in
 * docs/agent-office/05-development-plan.md Phase 6.
 */
export interface LlmClient {
  /** Returns the assistant's reply text, or null if the API isn't configured/reachable. */
  complete(systemPrompt: string, userMessage: string): Promise<string | null>;
}

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

export class AnthropicLlmClient implements LlmClient {
  constructor(
    private readonly apiKey = process.env.ANTHROPIC_API_KEY,
    private readonly model = process.env.AI_AGENT_MODEL ?? DEFAULT_MODEL,
  ) {}

  async complete(systemPrompt: string, userMessage: string): Promise<string | null> {
    if (!this.apiKey) return null;

    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 500,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        }),
      });

      if (!response.ok) return null;
      const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
      const text = data.content?.find((block) => block.type === "text")?.text;
      return text ?? null;
    } catch {
      return null;
    }
  }
}
