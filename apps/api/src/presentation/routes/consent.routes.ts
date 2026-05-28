import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { consentGrantSchema } from "@sweetcare/shared-validation";
import { grantConsent, revokeConsent } from "../../application/auth/auth.service.js";

export default async function consentRoutes(app: FastifyInstance) {
  // POST /consent — LGPD Art. 14 guardian consent grant
  app.post(
    "/consent",
    {
      preHandler: [app.authenticate],
      schema: {
        body: consentGrantSchema,
        response: {
          201: z.object({
            consent_id: z.string(),
            consent_type: z.string(),
            granted_at: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const ipAddress = request.ip ?? "unknown";
      const userAgent = request.headers["user-agent"] ?? "unknown";

      const result = await grantConsent(
        request.jwtUser.sub,
        request.body,
        ipAddress,
        userAgent,
        request.id,
      );

      return reply.status(201).send({
        consent_id: result.consentId,
        consent_type: request.body.consent_type,
        granted_at: result.grantedAt.toISOString(),
      });
    },
  );

  // DELETE /consent/:consentId — revoke a consent record
  app.delete(
    "/consent/:consentId",
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({ consentId: z.string().uuid() }),
        response: {
          200: z.object({
            consent_id: z.string(),
            revoked_at: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { consentId } = request.params as { consentId: string };
      const ipAddress = request.ip ?? "unknown";
      const userAgent = request.headers["user-agent"] ?? "unknown";

      const result = await revokeConsent(
        consentId,
        request.jwtUser.sub,
        ipAddress,
        userAgent,
        request.id,
      );

      return reply.status(200).send({
        consent_id: consentId,
        revoked_at: result.revokedAt.toISOString(),
      });
    },
  );
}
