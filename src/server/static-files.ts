import { readFile } from "node:fs/promises";
import { join, extname, normalize, sep } from "node:path";
import type { ServerResponse } from "node:http";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

/**
 * Serves the built web-ui SPA (apps/web-ui/dist) from the same origin as the
 * API, so production doesn't need a second port, a dev-only CORS allowlist,
 * or a reverse proxy just to get the app in front of a browser. Falls back
 * to index.html for any GET that isn't a real file under staticDir/assets —
 * this is a single-page app with no client-side routes, so that's just "/"
 * and any bare path someone bookmarks or refreshes.
 */
export async function serveStatic(staticDir: string, pathname: string, res: ServerResponse): Promise<boolean> {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const resolved = normalize(join(staticDir, relative));

  // Reject path traversal (`..`) escaping staticDir before touching the filesystem.
  if (!resolved.startsWith(normalize(staticDir) + sep) && resolved !== normalize(staticDir)) {
    return false;
  }

  const isAsset = relative.startsWith("assets" + sep) || relative.startsWith("assets/");
  const filePath = isAsset ? resolved : join(staticDir, "index.html");

  try {
    const body = await readFile(filePath);
    const contentType = MIME_TYPES[extname(filePath)] ?? "application/octet-stream";
    const cacheControl = isAsset ? "public, max-age=31536000, immutable" : "no-cache";
    res.writeHead(200, { "Content-Type": contentType, "Cache-Control": cacheControl });
    res.end(body);
    return true;
  } catch {
    return false;
  }
}
