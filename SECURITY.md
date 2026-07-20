# Security Review — Phase 6

This documents the security pass done before the Phase 6 "release candidate"
milestone in `docs/agent-office/05-development-plan.md`, what was found, what
was fixed, and what's explicitly still a known limitation.

## Fixed after Phase 6: authentication

Phase 6 shipped with the API wide open (see "Known limitation" below, kept
for history). This has since been fixed:

- **Password**: set once, on first run, via `POST /api/auth/setup` (min 8
  characters). Hashed with `crypto.scryptSync` + a random 16-byte salt
  (`src/agent-core/auth/password.ts`); the plaintext password is never
  stored. Verification uses `crypto.timingSafeEqual`.
- **Sessions**: `POST /api/auth/login` issues an opaque 32-byte random
  token, stored client-side as an `HttpOnly; SameSite=Lax` cookie
  (`fc_session`, 30-day expiry). The server never stores the raw token —
  only its SHA-256 hash (`src/agent-core/auth/session.repository.ts`), so a
  read of the `sessions` table can't be replayed as a valid cookie.
- **Enforcement**: every `/api/*` route except `auth/status`, `auth/setup`,
  and `auth/login` now requires a valid session and returns `401` without
  one (`src/server/http-server.ts`). `bootstrapAgentOffice()` still binds
  one `userId` per running instance (see scope note below) — the session
  gates *whether* a request is let through, not *which* user it acts as.
- **Login rate-limiting**: `src/agent-core/auth/login-rate-limit.ts` locks
  out an IP after 5 failed `/api/auth/login` attempts within 15 minutes
  (`429`), reset on the next success, to blunt online password guessing.
- **CORS**: `Access-Control-Allow-Credentials: true` is now also reflected
  alongside the existing origin allowlist, so the session cookie round-trips
  from the allowed dev-server origin without reopening the wildcard hole
  fixed below.

**Scope**: this is single-tenant, local/LAN protection — one password gates
the one account this instance runs as. It is *not* multi-user auth; there is
still exactly one `userId` per running process. That matches the product
today (each person runs their own desktop instance) — see "Known
limitation" below for what would still be needed before exposing this to
multiple distinct users or an untrusted network.

Covered by `src/agent-core/auth/auth.test.ts`,
`src/agent-core/auth/login-rate-limit.test.ts`, and the `auth:`-prefixed
tests in `src/server/http-server.test.ts`.

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

**Still single-tenant.** `bootstrapAgentOffice()` is still always called
with one fixed `userId` (`"demo-admin"`) — a valid session now proves
*someone* who knows the password is asking, but every session acts as the
same account. RBAC checks exist and are correctly enforced (see fix #2),
but they're checking a role that's always `admin` for that one account.
This is fine for local/trusted-LAN use by one person, which remains this
product's target (each person runs their own desktop instance), but it
means:

- There's no concept of a second, less-privileged user on the same
  instance — the password is all-or-nothing access to everything this
  instance manages.
- Real multi-user support would need `bootstrapAgentOffice`'s `userId` to
  come from the session (looked up per-request, not bound once at startup)
  plus a way to create additional accounts with their own passwords and
  RBAC grants.

**Recommendation before exposing this beyond one trusted person on a
trusted LAN:** don't — a shared password on an open LAN port is still a
single shared secret. If multiple people need distinct access, build
per-user accounts as described above before widening exposure.
