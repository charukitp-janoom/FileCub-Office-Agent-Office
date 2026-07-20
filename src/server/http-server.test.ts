import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";

import { bootstrapAgentOffice } from "../agent-core/bootstrap";
import { createHttpServer } from "./http-server";

async function startServer() {
  const office = await bootstrapAgentOffice({ userId: "user-1", dbPath: ":memory:", backupDir: "/tmp/filecub-http-test-backups" });
  const server = createHttpServer(office);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

/** Sets up the first-run password and returns the Set-Cookie value to pass into subsequent requests. */
async function loginAndGetCookie(baseUrl: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "hunter2hunter2" }),
  });
  assert.equal(res.status, 200);
  const cookie = res.headers.get("set-cookie");
  assert.ok(cookie);
  return cookie!.split(";")[0]; // just "fc_session=<token>", drop the attributes
}

test("CORS: an allowed origin (the Vite dev server) gets reflected, not a wildcard", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const cookie = await loginAndGetCookie(baseUrl);
    const res = await fetch(`${baseUrl}/api/agents`, { headers: { Origin: "http://localhost:5173", Cookie: cookie } });
    assert.equal(res.headers.get("access-control-allow-origin"), "http://localhost:5173");
    assert.notEqual(res.headers.get("access-control-allow-origin"), "*");
    assert.equal(res.status, 200);
  } finally {
    server.close();
  }
});

test("CORS: an arbitrary/attacker origin gets no Access-Control-Allow-Origin header at all", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const cookie = await loginAndGetCookie(baseUrl);
    const res = await fetch(`${baseUrl}/api/agents`, { headers: { Origin: "https://evil.example", Cookie: cookie } });
    assert.equal(res.headers.get("access-control-allow-origin"), null);
    // The request itself still succeeds server-side (Node has no same-origin
    // concept) — it's the browser's SOP that would block a page at evil.example
    // from reading this response, precisely because the header is absent.
    assert.equal(res.status, 200);
  } finally {
    server.close();
  }
});

test("CORS: a request with no Origin header (e.g. curl, server-to-server) gets no CORS header and still works", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const cookie = await loginAndGetCookie(baseUrl);
    const res = await fetch(`${baseUrl}/api/agents`, { headers: { Cookie: cookie } });
    assert.equal(res.headers.get("access-control-allow-origin"), null);
    assert.equal(res.status, 200);
  } finally {
    server.close();
  }
});

test("auth: protected routes are rejected with 401 when no session cookie is sent", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/api/agents`);
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

test("auth: /api/auth/status reflects configured/authenticated state before and after setup", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const before = await fetch(`${baseUrl}/api/auth/status`);
    assert.equal(before.status, 200);
    assert.deepEqual(await before.json(), { configured: false, authenticated: false });

    const cookie = await loginAndGetCookie(baseUrl);

    const after = await fetch(`${baseUrl}/api/auth/status`, { headers: { Cookie: cookie } });
    assert.deepEqual(await after.json(), { configured: true, authenticated: true });
  } finally {
    server.close();
  }
});

test("auth: /api/auth/setup refuses a password shorter than 8 characters", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/api/auth/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "short" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("auth: /api/auth/setup can only be called once (409 once a password is already configured)", async () => {
  const { server, baseUrl } = await startServer();
  try {
    await loginAndGetCookie(baseUrl);
    const res = await fetch(`${baseUrl}/api/auth/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "anotherpassword" }),
    });
    assert.equal(res.status, 409);
  } finally {
    server.close();
  }
});

test("auth: /api/auth/login rejects a wrong password and accepts the right one", async () => {
  const { server, baseUrl } = await startServer();
  try {
    await loginAndGetCookie(baseUrl);

    const wrong = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "wrong-password" }),
    });
    assert.equal(wrong.status, 401);

    const right = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "hunter2hunter2" }),
    });
    assert.equal(right.status, 200);
    assert.ok(right.headers.get("set-cookie"));
  } finally {
    server.close();
  }
});

test("auth: /api/auth/login rate-limits after repeated failures from the same client", async () => {
  const { server, baseUrl } = await startServer();
  try {
    await loginAndGetCookie(baseUrl);

    let last: Response | undefined;
    for (let i = 0; i < 5; i++) {
      last = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "wrong-password" }),
      });
    }
    assert.equal(last!.status, 401); // the 5th failure itself still returns 401...

    const sixth = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "hunter2hunter2" }), // even the *right* password is now blocked
    });
    assert.equal(sixth.status, 429);
  } finally {
    server.close();
  }
});

test("auth: /api/auth/logout clears the session so protected routes 401 again", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const cookie = await loginAndGetCookie(baseUrl);

    const stillIn = await fetch(`${baseUrl}/api/agents`, { headers: { Cookie: cookie } });
    assert.equal(stillIn.status, 200);

    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, { method: "POST", headers: { Cookie: cookie } });
    assert.equal(logoutRes.status, 200);

    const afterLogout = await fetch(`${baseUrl}/api/agents`, { headers: { Cookie: cookie } });
    assert.equal(afterLogout.status, 401);
  } finally {
    server.close();
  }
});
