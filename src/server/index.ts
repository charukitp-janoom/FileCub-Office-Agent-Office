import { existsSync } from "node:fs";
import { join } from "node:path";
import { bootstrapAgentOffice } from "../agent-core/bootstrap";
import { createHttpServer } from "./http-server";
import { ensureDemoDesktopDir } from "./demo-desktop";

const PORT = Number(process.env.PORT ?? 4000);
const demoDesktopPath = ensureDemoDesktopDir();

// Production: apps/web-ui/dist is served from this same process/port instead
// of the Vite dev server, so there's one thing to run and no cross-origin
// cookie/CORS setup needed. STATIC_DIR overrides the default location;
// set it to an empty string to disable (API-only, e.g. behind your own
// reverse proxy that already serves the SPA).
const defaultStaticDir = join(__dirname, "../../apps/web-ui/dist");
const staticDir = process.env.STATIC_DIR !== undefined ? process.env.STATIC_DIR || undefined : defaultStaticDir;
const resolvedStaticDir = staticDir && existsSync(staticDir) ? staticDir : undefined;

bootstrapAgentOffice({ userId: "demo-admin", dbPath: process.env.DB_PATH ?? "agent-office.sqlite" })
  .then((office) => {
    createHttpServer(office, { defaultWatchPath: demoDesktopPath, staticDir: resolvedStaticDir }).listen(PORT, () => {
      console.log(`Agent Office API listening on http://localhost:${PORT}`);
      if (resolvedStaticDir) {
        console.log(`Serving web UI from ${resolvedStaticDir} — open http://localhost:${PORT}`);
      } else {
        console.log(`No built web UI found at ${defaultStaticDir} — API-only mode (run apps/web-ui's dev server separately, or "npm run build:web")`);
      }
      console.log(`Demo desktop folder (for Desktop Auto Import): ${demoDesktopPath}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start Agent Office API", error);
    process.exit(1);
  });
