import { createApp } from "./app.js";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";
import { pool } from "./lib/db.js";
import { startOutboxWorker } from "./pos/outbox-worker.js";
import { getPosAdapter } from "./pos/index.js";

const app = createApp();
const server = app.listen(config.port, () => {
  logger.info(
    { port: config.port, posDriver: getPosAdapter().name },
    "Il Chiosco ordering server started",
  );
});

// Keep sockets alive a little longer than typical load balancers do.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 70_000;

const stopWorker = startOutboxWorker();

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutting down");
  stopWorker();
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 15_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (err) => logger.error({ err }, "unhandled rejection"));
