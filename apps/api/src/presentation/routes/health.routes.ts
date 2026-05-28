import type { FastifyInstance } from "fastify";

export default async function healthRoutes(app: FastifyInstance) {
  app.get("/health", { logLevel: "warn" }, async (_request, reply) => {
    return reply.status(200).send({
      status: "ok",
      service: "sweetcare-api",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/ready", { logLevel: "warn" }, async (_request, reply) => {
    // Phase 2: add DB + Redis liveness checks here
    return reply.status(200).send({
      status: "ready",
      checks: {
        database: "pending",
        cache: "pending",
      },
    });
  });
}
