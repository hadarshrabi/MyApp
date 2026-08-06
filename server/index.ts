import "dotenv/config";
import { createApp } from "./app";
import { disconnectPrisma } from "./prisma";

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
const host = process.env.HOST ?? (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
const shutdownTimeoutMs = Number(process.env.SHUTDOWN_TIMEOUT_MS ?? 10_000);
const server = createApp().listen(port, host, () => console.log(`API listening on ${host}:${port}`));
let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; stopping HTTP server`);

  const forceShutdown = setTimeout(() => {
    console.error(`Graceful shutdown exceeded ${shutdownTimeoutMs}ms; closing active connections`);
    server.closeAllConnections();
    void disconnectPrisma().finally(() => process.exit(1));
  }, shutdownTimeoutMs);
  forceShutdown.unref();

  server.close(async error => {
    clearTimeout(forceShutdown);
    try {
      await disconnectPrisma();
    } catch (disconnectError) {
      console.error("Failed to disconnect Prisma during shutdown", disconnectError instanceof Error ? disconnectError.message : "UnknownError");
      process.exit(1);
    }
    if (error) {
      console.error("HTTP server failed to close cleanly", error.message);
      process.exit(1);
    }
    console.log("Graceful shutdown completed");
    process.exit(0);
  });
}

process.once("SIGTERM", () => { void shutdown("SIGTERM"); });
process.once("SIGINT", () => { void shutdown("SIGINT"); });
