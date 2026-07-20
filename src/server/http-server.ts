import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AgentOffice } from "../agent-core/bootstrap";
import type { AgentCode } from "../agent-core/types";
import type { UploadAgent } from "../agents/upload-agent/upload-agent";
import type { NotifyAgent } from "../agents/notify-agent/notify-agent";
import { listAchievementsWithProgress, getUserLevel } from "../shared/db/achievement.repository";
import { isPasswordConfigured, setInitialPassword, login, logout, authenticate } from "../agent-core/auth/auth.service";
import { isRateLimited, recordFailure, recordSuccess } from "../agent-core/auth/login-rate-limit";
import { readSessionToken, setSessionCookie, clearSessionCookie } from "./cookies";
import { serveStatic } from "./static-files";

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

// Default-deny CORS: a wildcard Access-Control-Allow-Origin here would let
// any website the user has open in a tab make authenticated-by-network-
// position requests against this API (it listens on all interfaces, per
// the poster's "รองรับ LAN" feature) and read the responses — a classic
// "malicious page attacks your local/LAN service" hole. Only the dev
// server origin (or ALLOWED_ORIGINS, comma-separated) gets the header;
// everyone else's browser is left to same-origin-policy block the read.
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173").split(",").map((o) => o.trim()),
);

function corsHeaders(req: IncomingMessage): Record<string, string> {
  const origin = req.headers.origin;
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    // The session cookie only round-trips on cross-origin fetches if the
    // browser is told this API accepts credentialed requests.
    "Access-Control-Allow-Credentials": "true",
  };
}

function sendResponse(
  res: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
  cookie?: string,
): void {
  const json = JSON.stringify(body);
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders,
  };
  res.writeHead(status, cookie ? { ...headers, "Set-Cookie": cookie } : headers);
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
 * Office Room + Detail Drawer need for Phase 0), plus /api/auth/* —
 * see SECURITY.md for why authentication was added in Phase 6.
 */
export interface HttpServerOptions {
  /** Used when a watch request omits `path` — the demo desktop folder. */
  defaultWatchPath?: string;
  /** apps/web-ui/dist — when set, serves the built SPA from this same origin/port. Production only; dev uses the Vite dev server + proxy instead. */
  staticDir?: string;
}

// Every other /api/* route requires a valid session — these are the only
// ones reachable before logging in (status to know which screen to show,
// setup to configure the very first password, login to get a session).
const PUBLIC_AUTH_PATHS = new Set(["auth/status", "auth/setup", "auth/login"]);

export function createHttpServer(office: AgentOffice, options: HttpServerOptions = {}) {
  return createServer(async (req, res) => {
    const cors = corsHeaders(req);
    const send = (status: number, body: unknown, cookie?: string) => sendResponse(res, status, body, cors, cookie);

    if (req.method === "OPTIONS") {
      send(204, null);
      return;
    }

    const url = new URL(req.url ?? "/", "http://localhost");
    const parts = url.pathname.split("/").filter(Boolean); // ["api", "agents", ...]

    try {
      // Static assets (the built SPA, including the login page itself) are
      // never behind the session check — a logged-out browser still needs
      // to load the JS that shows the login screen in the first place.
      if (parts[0] !== "api") {
        if (req.method === "GET" && options.staticDir && (await serveStatic(options.staticDir, url.pathname, res))) {
          return;
        }
        return send(404, { error: "not found" });
      }

      if (parts[0] === "api" && parts[1] === "auth") {
        return await handleAuth(office, req, parts.slice(2), send);
      }

      const routePath = parts.join("/");
      const sessionToken = readSessionToken(req);
      const authenticatedUserId = PUBLIC_AUTH_PATHS.has(routePath) ? null : authenticate(office.db, sessionToken);
      if (!PUBLIC_AUTH_PATHS.has(routePath) && !authenticatedUserId) {
        return send(401, { error: "unauthorized" });
      }

      if (req.method === "GET" && parts.length === 2 && parts[0] === "api" && parts[1] === "agents") {
        const agents = office.registry.list().map((agent) => toSummary(office, agent.code));
        send(200, agents);
        return;
      }

      if (parts.length >= 3 && parts[0] === "api" && parts[1] === "agents") {
        const code = parts[2] as AgentCode;

        if (req.method === "GET" && parts.length === 3) {
          const summary = toSummary(office, code);
          if (!summary) return send(404, { error: "agent not found" });
          return send(200, summary);
        }

        if (req.method === "GET" && parts.length === 4 && parts[3] === "activity") {
          const limit = Number(url.searchParams.get("limit") ?? "10");
          return send(200, office.activityLog.recentForAgent(code, limit));
        }

        if (req.method === "POST" && parts.length === 4 && parts[3] === "run") {
          const agent = office.registry.get(code);
          if (!agent) return send(404, { error: "agent not found" });
          const body = (await readJsonBody(req)) as { capability: string; payload?: unknown };
          const result = await agent.runCapability(body.capability, body.payload);
          return send(200, result);
        }

        if (code === "upload" && parts.length === 4 && parts[3] === "watch") {
          const agent = office.registry.get("upload") as UploadAgent | undefined;
          if (!agent) return send(404, { error: "agent not found" });

          if (req.method === "GET") {
            return send(200, agent.getWatchStatus());
          }

          if (req.method === "POST") {
            const body = (await readJsonBody(req)) as { path?: string; enabled?: boolean };
            if (body.enabled === false) {
              await agent.disableDesktopWatch();
              return send(200, agent.getWatchStatus());
            }
            const path = body.path ?? options.defaultWatchPath;
            if (!path) return send(400, { error: "path is required" });
            agent.enableDesktopWatch(path);
            return send(200, agent.getWatchStatus());
          }
        }
      }

      if (req.method === "GET" && parts[0] === "api" && parts[1] === "dashboard") {
        if (parts.length === 3 && parts[2] === "summary") {
          return send(200, await office.dashboard.getSummary(office.userId));
        }
        if (parts.length === 3 && parts[2] === "trend") {
          const days = Number(url.searchParams.get("days") ?? "7");
          return send(200, await office.dashboard.getTrend(office.userId, days));
        }
      }

      if (parts[0] === "api" && parts[1] === "notifications") {
        const notify = office.registry.get("notify") as NotifyAgent | undefined;
        if (!notify) return send(404, { error: "agent not found" });

        if (req.method === "GET" && parts.length === 2) {
          const unreadOnly = url.searchParams.get("unread") === "true";
          return send(200, notify.listNotifications(unreadOnly));
        }

        if (req.method === "POST" && parts.length === 4 && parts[3] === "read") {
          await notify.runCapability("mark-read", { notificationId: parts[2] });
          return send(200, { success: true });
        }

        if (req.method === "POST" && parts.length === 3 && parts[2] === "read-all") {
          await notify.runCapability("mark-all-read");
          return send(200, { success: true });
        }
      }

      if (req.method === "GET" && parts[0] === "api" && parts[1] === "achievements" && parts.length === 2) {
        return send(200, listAchievementsWithProgress(office.db, office.userId));
      }

      if (req.method === "GET" && parts[0] === "api" && parts[1] === "levels" && parts[2] === "me") {
        return send(200, getUserLevel(office.db, office.userId));
      }

      send(404, { error: "not found" });
    } catch (error) {
      send(500, { error: error instanceof Error ? error.message : "internal error" });
    }
  });
}

async function handleAuth(
  office: AgentOffice,
  req: IncomingMessage,
  subPath: string[],
  send: (status: number, body: unknown, cookie?: string) => void,
): Promise<void> {
  if (req.method === "GET" && subPath[0] === "status") {
    const token = readSessionToken(req);
    const userId = authenticate(office.db, token);
    return send(200, {
      configured: isPasswordConfigured(office.db, office.userId),
      authenticated: userId !== null,
    });
  }

  if (req.method === "POST" && subPath[0] === "setup") {
    if (isPasswordConfigured(office.db, office.userId)) {
      return send(409, { error: "already configured" });
    }
    const body = (await readJsonBody(req)) as { password?: string };
    if (!body.password || body.password.length < 8) {
      return send(400, { error: "password must be at least 8 characters" });
    }
    setInitialPassword(office.db, office.userId, body.password);
    const outcome = login(office.db, office.userId, body.password);
    return send(200, { success: true }, setSessionCookie(outcome.token!));
  }

  if (req.method === "POST" && subPath[0] === "login") {
    const rateLimitKey = req.socket.remoteAddress ?? "unknown";
    if (isRateLimited(rateLimitKey)) {
      return send(429, { error: "พยายามเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง" });
    }

    const body = (await readJsonBody(req)) as { password?: string };
    const outcome = login(office.db, office.userId, body.password ?? "");
    if (!outcome.success) {
      recordFailure(rateLimitKey);
      return send(401, { error: outcome.reasonTh });
    }
    recordSuccess(rateLimitKey);
    return send(200, { success: true }, setSessionCookie(outcome.token!));
  }

  if (req.method === "POST" && subPath[0] === "logout") {
    const token = readSessionToken(req);
    if (token) logout(office.db, token);
    return send(200, { success: true }, clearSessionCookie());
  }

  send(404, { error: "not found" });
}
