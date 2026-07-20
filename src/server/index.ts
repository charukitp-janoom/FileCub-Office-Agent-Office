import { bootstrapAgentOffice } from "../agent-core/bootstrap";
import { createHttpServer } from "./http-server";
import { ensureDemoDesktopDir } from "./demo-desktop";

const PORT = Number(process.env.PORT ?? 4000);
const demoDesktopPath = ensureDemoDesktopDir();

bootstrapAgentOffice({ userId: "demo-admin", dbPath: process.env.DB_PATH ?? "agent-office.sqlite" })
  .then((office) => {
    createHttpServer(office, { defaultWatchPath: demoDesktopPath }).listen(PORT, () => {
      console.log(`Agent Office API listening on http://localhost:${PORT}`);
      console.log(`Demo desktop folder (for Desktop Auto Import): ${demoDesktopPath}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start Agent Office API", error);
    process.exit(1);
  });
