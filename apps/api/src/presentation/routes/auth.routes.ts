import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { registerSchema, loginSchema, mfaVerifySchema } from "@sweetcare/shared-validation";
import { register, login, refresh, logout } from "../../application/auth/auth.service.js";
import { REFRESH_COOKIE, buildRefreshCookie } from "../../infrastructure/auth/jwt.plugin.js";

const isProduction = process.env["NODE_ENV"] === "production";

export default async function authRoutes(app: FastifyInstance) {
  // POST /auth/register
  app.post(
    "/auth/register",
    {
      schema: {
        body: registerSchema,
        response: {
          201: z.object({ user_id: z.string(), created_at: z.string() }),
          409: z.object({
            error: z.string(),
            message: z.string(),
            correlationId: z.string().optional(),
          }),
          422: z.object({
            error: z.string(),
            message: z.string(),
            correlationId: z.string().optional(),
          }),
          429: z.object({
            error: z.string(),
            message: z.string(),
            correlationId: z.string().optional(),
          }),
        },
      },
    },
    async (request, reply) => {
      const result = await register(request.body);
      return reply.status(201).send({
        user_id: result.userId,
        created_at: new Date().toISOString(),
      });
    },
  );

  // POST /auth/login
  app.post(
    "/auth/login",
    {
      schema: {
        body: loginSchema,
        response: {
          200: z.object({
            access_token: z.string(),
            token_type: z.literal("Bearer"),
            expires_in: z.number(),
            user_id: z.string(),
            role: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const result = await login(app, request.body, request.body.device_fingerprint);

      reply.header("Set-Cookie", buildRefreshCookie(result.refreshToken, isProduction));

      return reply.status(200).send({
        access_token: result.accessToken,
        token_type: "Bearer",
        expires_in: 900,
        user_id: result.userId,
        role: result.role,
      });
    },
  );

  // POST /auth/refresh — reads refresh token from HttpOnly cookie
  app.post(
    "/auth/refresh",
    {
      schema: {
        response: {
          200: z.object({
            access_token: z.string(),
            token_type: z.literal("Bearer"),
            expires_in: z.number(),
          }),
        },
      },
    },
    async (request, reply) => {
      const rawToken = request.cookies[REFRESH_COOKIE];
      if (!rawToken) {
        return reply.status(401).send({
          error: "REFRESH_TOKEN_INVALID",
          message: "Refresh token cookie missing",
          correlationId: request.id,
        });
      }

      const result = await refresh(app, rawToken);

      reply.header("Set-Cookie", buildRefreshCookie(result.refreshToken, isProduction));

      return reply.status(200).send({
        access_token: result.accessToken,
        token_type: "Bearer",
        expires_in: 900,
      });
    },
  );

  // POST /auth/logout
  app.post("/auth/logout", { preHandler: [app.authenticate] }, async (request, reply) => {
    const rawToken = request.cookies[REFRESH_COOKIE];
    if (rawToken) await logout(rawToken);

    // Clear the cookie
    reply.header(
      "Set-Cookie",
      `${REFRESH_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth/refresh; Max-Age=0`,
    );

    return reply.status(204).send();
  });

  // POST /auth/mfa/verify — stub for Phase 2 extension
  app.post("/auth/mfa/verify", { schema: { body: mfaVerifySchema } }, async (_request, reply) => {
    return reply.status(501).send({
      error: "NOT_IMPLEMENTED",
      message: "MFA verification is planned for a future release",
    });
  });
}
