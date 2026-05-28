import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  exportUserData,
  type UserDataExport,
} from "../../application/services/data-rights.service.js";
import { deleteUserAccount } from "../../application/services/data-rights.service.js";
import { REFRESH_COOKIE } from "../../infrastructure/auth/jwt.plugin.js";

export default async function dataRightsRoutes(app: FastifyInstance) {
  // GET /users/me/data-export — LGPD Art. 18 direito de acesso
  app.get(
    "/users/me/data-export",
    {
      preHandler: [app.authenticate],
      schema: {
        response: {
          200: z.object({}).passthrough(),
          401: z.object({ error: z.string(), message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const data: UserDataExport = await exportUserData(request.jwtUser.sub, {
        correlationId: request.id,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"] ?? "",
      });

      return reply.status(200).send(data);
    },
  );

  // DELETE /users/me — LGPD Art. 18 direito à exclusão
  app.delete(
    "/users/me",
    {
      preHandler: [app.authenticate],
      schema: {
        body: z.object({ password: z.string().min(1) }),
        response: {
          204: z.undefined(),
          401: z.object({ error: z.string(), message: z.string() }),
          403: z.object({
            error: z.string(),
            message: z.string(),
            correlationId: z.string().optional(),
          }),
          404: z.object({
            error: z.string(),
            message: z.string(),
            correlationId: z.string().optional(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { password } = request.body as { password: string };

      await deleteUserAccount(request.jwtUser.sub, password, {
        correlationId: request.id,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"] ?? "",
      });

      // Clear refresh token cookie (same pattern as POST /auth/logout)
      reply.header(
        "Set-Cookie",
        `${REFRESH_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth/refresh; Max-Age=0`,
      );

      return reply.status(204).send();
    },
  );
}
