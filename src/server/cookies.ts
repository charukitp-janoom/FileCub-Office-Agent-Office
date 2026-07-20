import type { IncomingMessage } from "node:http";

const SESSION_COOKIE_NAME = "fc_session";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days, matches session.repository.ts's TTL

export function readSessionToken(req: IncomingMessage): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;

  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE_NAME) return rest.join("=");
  }
  return undefined;
}

export function setSessionCookie(token: string): string {
  return `${SESSION_COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}
