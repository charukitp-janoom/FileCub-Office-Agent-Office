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

test("CORS: an allowed origin (the Vite dev server) gets reflected, not a wildcard", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/api/agents`, { headers: { Origin: "http://localhost:5173" } });
    assert.equal(res.headers.get("access-control-allow-origin"), "http://localhost:5173");
    assert.notEqual(res.headers.get("access-control-allow-origin"), "*");
  } finally {
    server.close();
  }
});

test("CORS: an arbitrary/attacker origin gets no Access-Control-Allow-Origin header at all", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/api/agents`, { headers: { Origin: "https://evil.example" } });
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
    const res = await fetch(`${baseUrl}/api/agents`);
    assert.equal(res.headers.get("access-control-allow-origin"), null);
    assert.equal(res.status, 200);
  } finally {
    server.close();
  }
});
