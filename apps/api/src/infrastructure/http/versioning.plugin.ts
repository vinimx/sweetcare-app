import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

const SUPPORTED_VERSIONS = new Set(["1"]);
const CURRENT_VERSION = "1";

// Validates the optional Accept-Version request header and adds X-API-Version
// to every response. Clients that don't send the header receive v1 behaviour.
// Future versions can be added to SUPPORTED_VERSIONS without breaking v1 clients.
export default fp(async function versioningPlugin(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", async (request, reply) => {
    const requested = request.headers["accept-version"];
    if (requested !== undefined && !SUPPORTED_VERSIONS.has(String(requested))) {
      await reply.status(400).send({
        error: "UNSUPPORTED_VERSION",
        message: `API version '${String(requested)}' is not supported. Supported: ${[...SUPPORTED_VERSIONS].join(", ")}`,
        correlationId: request.id,
      });
    }
  });

  app.addHook("onSend", async (_request, reply) => {
    void reply.header("X-API-Version", CURRENT_VERSION);
  });
});
