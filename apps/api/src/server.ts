import { apiEnvSchema } from "@sweetcare/shared-config";
import { buildApp } from "./app.js";

const env = apiEnvSchema.parse(process.env);

const app = await buildApp();

try {
  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info({ port: env.PORT }, "SweetCare API server started");
} catch (err) {
  app.log.fatal({ err }, "Failed to start server");
  process.exit(1);
}

// Graceful shutdown
const shutdown = async (signal: string) => {
  app.log.info({ signal }, "Shutdown signal received");
  await app.close();
  process.exit(0);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
