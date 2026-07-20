import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Stand-in for the user's real OS Desktop in this demo/dev environment —
 * the server never touches a real Desktop folder on its own. The UI's
 * "Desktop Auto Import" toggle watches this folder so the before/after
 * flow from the FileCub Office poster can be demonstrated end to end.
 */
export function ensureDemoDesktopDir(): string {
  const path = resolve(process.env.DEMO_DESKTOP_PATH ?? "./demo-desktop");
  mkdirSync(path, { recursive: true });
  return path;
}
