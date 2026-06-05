import type { FastifyInstance } from "fastify";
import { type ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  requestPasswordReset,
  resetPassword,
} from "../../application/auth/password-reset.service.js";

const errorSchema = z.object({
  error: z.string(),
  message: z.string(),
  correlationId: z.string().optional(),
});

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export default async function passwordResetRoutes(baseApp: FastifyInstance) {
  const app = baseApp.withTypeProvider<ZodTypeProvider>();

  // POST /auth/forgot-password
  // Rate-limited to 3/15 min — stricter than login to prevent email spam
  app.post(
    "/auth/forgot-password",
    {
      config: { rateLimit: { max: 3, timeWindow: RATE_LIMIT_WINDOW_MS } },
      schema: {
        body: z.object({ email: z.string().email() }),
        response: {
          200: z.object({ message: z.string() }),
          422: errorSchema,
          429: errorSchema,
        },
      },
    },
    async (request, reply) => {
      await requestPasswordReset(request.body.email);
      // Fixed message regardless of outcome — don't reveal if email is registered
      return reply.status(200).send({
        message: "Se este e-mail estiver cadastrado, você receberá as instruções em breve.",
      });
    },
  );

  // POST /auth/reset-password
  app.post(
    "/auth/reset-password",
    {
      config: { rateLimit: { max: 5, timeWindow: RATE_LIMIT_WINDOW_MS } },
      schema: {
        body: z.object({
          token: z.string().min(1),
          password: z.string().min(8).max(128),
        }),
        response: {
          200: z.object({ message: z.string() }),
          400: errorSchema,
          422: errorSchema,
          429: errorSchema,
        },
      },
    },
    async (request, reply) => {
      await resetPassword(request.body.token, request.body.password);
      return reply.status(200).send({
        message: "Senha redefinida com sucesso. Faça login com a nova senha.",
      });
    },
  );
}
