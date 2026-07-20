import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { serveStatic } from "./static-files";

function makeFixtureDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "static-files-test-"));
  writeFileSync(join(dir, "index.html"), "<html>root</html>");
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "assets", "app.js"), "console.log('hi')");
  return dir;
}

async function withServer(dir: string, fn: (baseUrl: string) => Promise<void>) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const served = await serveStatic(dir, url.pathname, res);
    if (!served) {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

test("serveStatic: GET / returns index.html", async () => {
  const dir = makeFixtureDir();
  await withServer(dir, async (baseUrl) => {
    const res = await fetch(baseUrl + "/");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/html/);
    assert.equal(await res.text(), "<html>root</html>");
  });
});

test("serveStatic: GET /assets/app.js returns the real asset with a long-lived cache header", async () => {
  const dir = makeFixtureDir();
  await withServer(dir, async (baseUrl) => {
    const res = await fetch(baseUrl + "/assets/app.js");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /javascript/);
    assert.match(res.headers.get("cache-control") ?? "", /immutable/);
    assert.equal(await res.text(), "console.log('hi')");
  });
});

test("serveStatic: an unknown non-asset path falls back to index.html (SPA has no client routes, but this is future-proofing)", async () => {
  const dir = makeFixtureDir();
  await withServer(dir, async (baseUrl) => {
    const res = await fetch(baseUrl + "/some/deep/path");
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "<html>root</html>");
  });
});

test("serveStatic: a missing asset file returns nothing served (caller should 404)", async () => {
  const dir = makeFixtureDir();
  await withServer(dir, async (baseUrl) => {
    const res = await fetch(baseUrl + "/assets/does-not-exist.js");
    assert.equal(res.status, 404);
  });
});

test("serveStatic: path traversal in the assets path can't escape staticDir", async () => {
  // Call serveStatic directly with a raw traversal pathname — new URL() would
  // normalize away the "../" segments before this ever reaches an HTTP
  // handler, so this exercises the function's own defense-in-depth guard
  // rather than relying on URL parsing to save it.
  const dir = makeFixtureDir();
  const res = { writeHead() {}, end() {} } as unknown as ServerResponse;
  const served = await serveStatic(dir, "/assets/../../../../../../etc/passwd", res);
  assert.equal(served, false);
});
