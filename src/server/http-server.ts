import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AgentOffice } from "../agent-core/bootstrap";
import type { AgentCode } from "../agent-core/types";

interface AgentSummary {
  code: AgentCode;
  nameTh: string;
  nicknameTh: string;
  roleTitleTh: string;
  icon: string;
  capabilities: Array<{ key: string; labelTh: string; descriptionTh: string; enabled: boolean }>;
  status: { state: string; lastRunAt?: string; message?: string; progress?: number };
}

function toSummary(office: AgentOffice, code: AgentCode): AgentSummary | undefined {
  const agent = office.registry.get(code);
  if (!agent) return undefined;
  return {
    code: agent.code,
    nameTh: agent.nameTh,
    nicknameTh: agent.nicknameTh,
    roleTitleTh: agent.roleTitleTh,
    icon: agent.icon,
    capabilities: agent.capabilities,
    status: agent.getStatus(),
  };
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(json);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

/**
 * Minimal REST surface over agent-core, matching the API listed in
 * docs/agent-office/04-component-structure.md §4.4 (the subset Agent
 * Office Room + Detail Drawer need for Phase 0).
 */
export function createHttpServer(office: AgentOffice) {
  return createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      send(res, 204, null);
      return;
    }

    const url = new URL(req.url ?? "/", "http://localhost");
    const parts = url.pathname.split("/").filter(Boolean); // ["api", "agents", ...]

    try {
      if (req.method === "GET" && parts.length === 2 && parts[0] === "api" && parts[1] === "agents") {
        const agents = office.registry.list().map((agent) => toSummary(office, agent.code));
        send(res, 200, agents);
        return;
      }

      if (parts.length >= 3 && parts[0] === "api" && parts[1] === "agents") {
        const code = parts[2] as AgentCode;

        if (req.method === "GET" && parts.length === 3) {
          const summary = toSummary(office, code);
          if (!summary) return send(res, 404, { error: "agent not found" });
          return send(res, 200, summary);
        }

        if (req.method === "GET" && parts.length === 4 && parts[3] === "activity") {
          const limit = Number(url.searchParams.get("limit") ?? "10");
          return send(res, 200, office.activityLog.recentForAgent(code, limit));
        }

        if (req.method === "POST" && parts.length === 4 && parts[3] === "run") {
          const agent = office.registry.get(code);
          if (!agent) return send(res, 404, { error: "agent not found" });
          const body = (await readJsonBody(req)) as { capability: string; payload?: unknown };
          const result = await agent.runCapability(body.capability, body.payload);
          return send(res, 200, result);
        }
      }

      send(res, 404, { error: "not found" });
    } catch (error) {
      send(res, 500, { error: error instanceof Error ? error.message : "internal error" });
    }
  });
}
