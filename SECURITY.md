# Security Review — Phase 6

This documents the security pass done before the Phase 6 "release candidate"
milestone in `docs/agent-office/05-development-plan.md`, what was found, what
was fixed, and what's explicitly still a known limitation.

## Fixed in this pass

### 1. Wildcard CORS on the local/LAN API server
`src/server/http-server.ts` sent `Access-Control-Allow-Origin: *` on every
response. Combined with the server listening on all interfaces (intentional —
see the poster's "รองรับ LAN" feature) and zero authentication, this meant
**any website open in the user's browser** could script a cross-origin fetch
to `http://<host>:4000/api/...` and read the response — the classic
"malicious page attacks your local service" hole.

Fixed: `corsHeaders()` now reflects the `Origin` header only if it's in an
allowlist (`ALLOWED_ORIGINS` env var, default the Vite dev server origin).
Any other origin — or none — gets no CORS header at all, so a browser's
same-origin policy blocks the read. Requests without an `Origin` header
(curl, server-to-server) are unaffected. Covered by
`src/server/http-server.test.ts`.

### 2. `permissions.access_level` was stored but never enforced
`SqlitePermissionChecker.isAllowed()` checked whether *any* permission row
existed for `(user_id, resource_type, resource_id)` but never compared its
`access_level` against what the action actually needed. A user granted only
`read` access to `file` resources could pass a `file:import` (write) check —
the access level column was decorative.

Fixed: `PermissionChecker.check()` now takes an explicit `requiredLevel`
(`"read" | "write" | "admin"`, defaulting to `"write"` — every current call
site needs write), and a grant only satisfies a check if its `access_level`
ranks at or above that. Covered by a new test in
`src/agents/security-agent/security-agent.test.ts` (`"a read-only grant does
not satisfy a write-level check"`).

## Verified, not a bug

- **SQL injection**: every query is parameterized (`db.prepare(...).run/get/all(...)`
  with `?` placeholders); the one place a template literal builds part of a
  query (`notification.repository.ts`'s `WHERE ... ${unreadOnly ? "AND is_read = 0" : ""}`)
  interpolates a boolean-derived static string, not user input.
- **FTS5 query injection** (Cub Search Agent): `thai-query.util.ts` wraps
  every query as an escaped FTS5 phrase literal before it reaches `MATCH`,
  so `OR`, quotes, and column-filter syntax in a search box can't be
  interpreted as FTS5 query syntax. Covered by
  `src/agents/search-agent/search-agent.test.ts`.
- **XSS**: no `dangerouslySetInnerHTML`, `eval`, or equivalent anywhere in
  `apps/web-ui`. Search result snippets render as plain text.
- **Command injection**: no `child_process`/`exec` usage anywhere in `src/`.
- **RBAC bypass via nonexistent user**: a `userId` with no `users` row falls
  through to the grant check, which also requires a matching row for that
  same nonexistent id — correctly denied, not an accidental bypass.

## Known limitation (by design, not a bug to silently ignore)

**The HTTP API has no authentication.** `bootstrapAgentOffice()` is always
called with a single hardcoded `userId` (`"demo-admin"`, role `admin`), and
every request acts as that user — RBAC checks exist and are now correctly
enforced (see fix #2), but they're checking a role that's always `admin` in
this single-tenant demo deployment. This is fine for local/trusted-LAN use
by one person, which is this phase's target, but it means:

- Anyone who can reach the API (same machine, or same LAN if the port is
  reachable) has full access — there's no login, session, or per-request
  identity.
- RBAC becomes meaningful only once real multi-user authentication (e.g. a
  login flow issuing per-user sessions/tokens, with `bootstrapAgentOffice`'s
  `userId` coming from that session instead of a constant) is added.

**Recommendation before deploying beyond a single trusted user/LAN:** add an
authentication layer (session cookie or token) that resolves a real
`userId` per request, and stop hardcoding `"demo-admin"` in
`src/server/index.ts`. Until then, don't expose this port beyond a network
you trust every device on.
