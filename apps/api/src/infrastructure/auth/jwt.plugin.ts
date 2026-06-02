import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";
import type { UserRole } from "@prisma/client";
import {
  ACCESS_TOKEN_EXPIRY_SECONDS,
  REFRESH_TOKEN_EXPIRY_SECONDS,
} from "@sweetcare/shared-config";

export interface JwtPayload {
  sub: string; // user ID
  jti: string; // unique token ID
  role: UserRole;
}

// Augment Fastify types
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (
      ...roles: UserRole[]
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    jwtUser: JwtPayload;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

export const REFRESH_COOKIE = "sc_refresh_token";

function getSecret(key: string, minLength: number): string {
  const value = process.env[key];
  if (!value || value.length < minLength) {
    throw new Error(`${key} must be at least ${String(minLength)} characters`);
  }
  return value;
}

export default fp(async function jwtPlugin(app: FastifyInstance) {
  await app.register(fastifyCookie, { secret: getSecret("JWT_ACCESS_SECRET", 32) });

  await app.register(fastifyJwt as unknown as Parameters<typeof app.register>[0], {
    secret: getSecret("JWT_ACCESS_SECRET", 32),
    sign: {
      algorithm: "HS256",
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
      audience: "sweetcare-api",
      issuer: "sweetcare",
    },
    verify: {
      audience: "sweetcare-api",
      issuer: "sweetcare",
    },
  });

  // authenticate decorator — verifies access token from Authorization header
  app.decorate(
    "authenticate",
    async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
      try {
        await request.jwtVerify<JwtPayload>();
        request.jwtUser = request.user;
      } catch {
        return reply.status(401).send({
          error: "UNAUTHORIZED",
          message: "Valid access token required",
          correlationId: request.id,
        });
      }
    },
  );

  // requireRole decorator factory — always chains authenticate first
  app.decorate("requireRole", function (...roles: UserRole[]) {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      await app.authenticate(request, reply);
      if (reply.sent) return;
      if (!roles.includes(request.jwtUser.role)) {
        return reply.status(403).send({
          error: "FORBIDDEN",
          message: "Insufficient permissions for this operation",
          correlationId: request.id,
        });
      }
    };
  });
});

// Helpers used by auth service and route handlers

export function signAccessToken(app: FastifyInstance, payload: Omit<JwtPayload, "jti">): string {
  return app.jwt.sign({ ...payload, jti: crypto.randomUUID() });
}

export function buildRefreshCookie(token: string, secure: boolean): string {
  const maxAge = REFRESH_TOKEN_EXPIRY_SECONDS;
  const flags = [
    `Max-Age=${String(maxAge)}`,
    "HttpOnly",
    secure ? "Secure" : "",
    "SameSite=Strict",
    `Path=/api/v1/auth/refresh`,
  ]
    .filter(Boolean)
    .join("; ");
  return `${REFRESH_COOKIE}=${token}; ${flags}`;
}
