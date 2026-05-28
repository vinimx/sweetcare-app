import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { registerSchema, loginSchema, mfaVerifySchema } from "@sweetcare/shared-validation";
import { register, login, refresh, logout } from "../../application/auth/auth.service.js";
import { REFRESH_COOKIE, buildRefreshCookie } from "../../infrastructure/auth/jwt.plugin.js";
import { RATE_LIMIT_AUTH_WINDOW_MS } from "@sweetcare/shared-config";
import { getPrismaClient } from "../../infrastructure/database/client.js";

const isProduction = process.env["NODE_ENV"] === "production";

// Shared response schemas
const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.string(),
  displayName: z.string(),
  isActive: z.boolean(),
  mfaEnabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const authResponseSchema = z.object({
  accessToken: z.string(),
  tokenType: z.literal("Bearer"),
  expiresIn: z.number(),
  refreshToken: z.string(),
  userId: z.string(),
  role: z.string(),
  user: userSchema,
});

const errorSchema = z.object({
  error: z.string(),
  message: z.string(),
  correlationId: z.string().optional(),
});

async function fetchUserById(userId: string) {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      displayName: true,
      isActive: true,
      mfaEnabled: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return {
    id: user.id,
    email: user.email,
    role: user.role as string,
    displayName: user.displayName,
    isActive: user.isActive,
    mfaEnabled: user.mfaEnabled,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export default async function authRoutes(app: FastifyInstance) {
  // GET /users/me — returns authenticated user profile
  app.get(
    "/users/me",
    {
      preHandler: [app.authenticate],
      schema: {
        response: {
          200: userSchema,
          401: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await fetchUserById(request.jwtUser.sub);
      return reply.status(200).send(user);
    },
  );

  // POST /auth/register — creates account and auto-logs in
  app.post(
    "/auth/register",
    {
      config: { rateLimit: { max: 5, timeWindow: RATE_LIMIT_AUTH_WINDOW_MS } },
      schema: {
        body: registerSchema,
        response: {
          201: authResponseSchema,
          409: errorSchema,
          422: errorSchema,
          429: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const body = request.body;
      await register(body);

      // Auto-login after registration
      const result = await login(app, { email: body.email, password: body.password });
      const user = await fetchUserById(result.userId);

      reply.header("Set-Cookie", buildRefreshCookie(result.refreshToken, isProduction));

      return reply.status(201).send({
        accessToken: result.accessToken,
        tokenType: "Bearer",
        expiresIn: 900,
        refreshToken: result.refreshToken,
        userId: result.userId,
        role: result.role as string,
        user,
      });
    },
  );

  // POST /auth/login
  app.post(
    "/auth/login",
    {
      config: { rateLimit: { max: 5, timeWindow: RATE_LIMIT_AUTH_WINDOW_MS } },
      schema: {
        body: loginSchema,
        response: {
          200: authResponseSchema,
          401: errorSchema,
          403: errorSchema,
          429: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await login(app, request.body, request.body.device_fingerprint);
      const user = await fetchUserById(result.userId);

      reply.header("Set-Cookie", buildRefreshCookie(result.refreshToken, isProduction));

      return reply.status(200).send({
        accessToken: result.accessToken,
        tokenType: "Bearer",
        expiresIn: 900,
        refreshToken: result.refreshToken,
        userId: result.userId,
        role: result.role as string,
        user,
      });
    },
  );

  // POST /auth/refresh — reads refresh token from HttpOnly cookie OR request body
  // Note: no body schema — body is optional and read via type assertion to avoid
  // Fastify rejecting requests with empty body before the handler runs
  app.post(
    "/auth/refresh",
    {
      schema: {
        response: {
          200: z.object({
            accessToken: z.string(),
            tokenType: z.literal("Bearer"),
            expiresIn: z.number(),
            refreshToken: z.string(),
          }),
          401: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { refreshToken?: string } | undefined;
      const rawToken = request.cookies[REFRESH_COOKIE] ?? body?.refreshToken;

      if (!rawToken) {
        return reply.status(401).send({
          error: "REFRESH_TOKEN_INVALID",
          message: "Refresh token missing",
          correlationId: request.id,
        });
      }

      const result = await refresh(app, rawToken);

      reply.header("Set-Cookie", buildRefreshCookie(result.refreshToken, isProduction));

      return reply.status(200).send({
        accessToken: result.accessToken,
        tokenType: "Bearer",
        expiresIn: 900,
        refreshToken: result.refreshToken,
      });
    },
  );

  // POST /auth/logout
  app.post("/auth/logout", { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = request.body as { refreshToken?: string } | undefined;
    const rawToken = request.cookies[REFRESH_COOKIE] ?? body?.refreshToken;
    if (rawToken) await logout(rawToken);

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
