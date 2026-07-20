import { bootstrapAgentOffice } from "../agent-core/bootstrap";
import { createHttpServer } from "./http-server";

const PORT = Number(process.env.PORT ?? 4000);

bootstrapAgentOffice({ userId: "demo-admin", dbPath: process.env.DB_PATH ?? "agent-office.sqlite" })
  .then((office) => {
    createHttpServer(office).listen(PORT, () => {
      console.log(`Agent Office API listening on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start Agent Office API", error);
    process.exit(1);
  });
