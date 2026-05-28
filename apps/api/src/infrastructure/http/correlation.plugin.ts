import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

// Echoes the request's correlation ID as X-Correlation-Id on every response.
// Fastify generates a UUID v4 per request (genReqId in app.ts).
// The AI service client already forwards it as X-Internal-Request-Id.
export default fp(async function correlationPlugin(app: FastifyInstance): Promise<void> {
  app.addHook("onSend", async (request, reply) => {
    void reply.header("X-Correlation-Id", request.id);
  });
});
