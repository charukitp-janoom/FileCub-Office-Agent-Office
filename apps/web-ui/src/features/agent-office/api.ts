import type {
  Achievement,
  ActivityLogEntry,
  AgentRunResult,
  AgentSummary,
  DashboardSummary,
  DashboardTrendPoint,
  NotificationItem,
  UserLevel,
  WatchStatus,
} from "./types";

export interface AuthStatus {
  configured: boolean;
  authenticated: boolean;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

// credentials: "include" is required on every call, even through the
// same-origin Vite proxy, so the fc_session cookie set by /api/auth/*
// actually round-trips — see SECURITY.md.
const withCreds: RequestInit = { credentials: "include" };

function postJson(path: string, body?: unknown): Promise<Response> {
  return fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

export const agentOfficeApi = {
  getAuthStatus: () => fetch("/api/auth/status", withCreds).then((r) => json<AuthStatus>(r)),
  setup: (password: string) => postJson("/api/auth/setup", { password }),
  login: (password: string) => postJson("/api/auth/login", { password }),
  logout: () => postJson("/api/auth/logout"),

  listAgents: () => fetch("/api/agents", withCreds).then((r) => json<AgentSummary[]>(r)),
  getActivity: (code: string, limit = 10) =>
    fetch(`/api/agents/${code}/activity?limit=${limit}`, withCreds).then((r) => json<ActivityLogEntry[]>(r)),
  runCapability: (code: string, capability: string, payload?: unknown) =>
    postJson(`/api/agents/${code}/run`, { capability, payload }).then((r) => json<AgentRunResult>(r)),
  getWatchStatus: () => fetch("/api/agents/upload/watch", withCreds).then((r) => json<WatchStatus>(r)),
  setWatch: (enabled: boolean) => postJson("/api/agents/upload/watch", { enabled }).then((r) => json<WatchStatus>(r)),
  getDashboardSummary: () => fetch("/api/dashboard/summary", withCreds).then((r) => json<DashboardSummary>(r)),
  getDashboardTrend: (days = 7) =>
    fetch(`/api/dashboard/trend?days=${days}`, withCreds).then((r) => json<DashboardTrendPoint[]>(r)),
  getNotifications: (unreadOnly = false) =>
    fetch(`/api/notifications${unreadOnly ? "?unread=true" : ""}`, withCreds).then((r) => json<NotificationItem[]>(r)),
  markNotificationRead: (id: string) => postJson(`/api/notifications/${id}/read`).then((r) => json(r)),
  markAllNotificationsRead: () => postJson("/api/notifications/read-all").then((r) => json(r)),
  getAchievements: () => fetch("/api/achievements", withCreds).then((r) => json<Achievement[]>(r)),
  getUserLevel: () => fetch("/api/levels/me", withCreds).then((r) => json<UserLevel>(r)),
};
