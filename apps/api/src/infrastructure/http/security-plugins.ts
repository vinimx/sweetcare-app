import type { FastifyInstance } from "fastify";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { RATE_LIMIT_AUTH_MAX, RATE_LIMIT_AUTH_WINDOW_MS } from "@sweetcare/shared-config";

export default async function securityPlugins(app: FastifyInstance) {
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: {
      maxAge: 63_072_000, // 2 years
      includeSubDomains: true,
      preload: true,
    },
  });

  const allowedOrigins = (process.env["CORS_ALLOWED_ORIGINS"] ?? "").split(",").filter(Boolean);

  await app.register(cors, {
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });

  await app.register(rateLimit, {
    global: true,
    max: RATE_LIMIT_AUTH_MAX,
    timeWindow: RATE_LIMIT_AUTH_WINDOW_MS,
    errorResponseBuilder: (_request, context) => ({
      error: "RATE_LIMITED",
      message: `Too many requests — retry after ${String(Math.ceil(context.ttl / 1000))} seconds`,
      correlationId: _request.id,
    }),
  });
}
