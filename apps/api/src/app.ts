import Fastify, { type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { ZodError } from "zod";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    bodyLimit: 1_048_576,
    logger: {
      level: process.env["LOG_LEVEL"] ?? "info",
      redact: {
        // PHI-safe logging: never expose patient identifiers in logs
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "req.body.password",
          "req.body.email",
          "req.body.full_name",
          "req.body.date_of_birth",
          "req.body.notes",
          "req.body.glucose_before_mgdl",
          "req.body.glucose_reading_mgdl",
          "req.body.insulin_type",
          "req.body.phone_e164",
        ],
        remove: true,
      },
    },
    trustProxy: true,
    disableRequestLogging: false,
    genReqId: () => crypto.randomUUID(),
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Schema validation errors must return 422, not Fastify's default 400.
  // wrapValidationError preserves statusCode if truthy (422 || 400 = 422).
  app.setSchemaErrorFormatter((errors, dataVar) => {
    const err = new Error(`Validation failed for ${dataVar}`) as Error & {
      statusCode: number;
    };
    err.statusCode = 422;
    return err;
  });

  // ── Security & auth plugins ──────────────────────────────────────────────
  await app.register(import("./infrastructure/http/security-plugins.js"));
  await app.register(import("./infrastructure/auth/jwt.plugin.js"));

  // ── Routes ───────────────────────────────────────────────────────────────
  await app.register(import("./presentation/routes/health.routes.js"), { prefix: "/api/v1" });
  await app.register(import("./presentation/routes/auth.routes.js"), { prefix: "/api/v1" });
  await app.register(import("./presentation/routes/consent.routes.js"), { prefix: "/api/v1" });
  // Phase 3 (US1):
  await app.register(import("./presentation/routes/patients.routes.js"), { prefix: "/api/v1" });
  await app.register(import("./presentation/routes/insulin-records.routes.js"), {
    prefix: "/api/v1",
  });
  await app.register(import("./presentation/routes/symptom-records.routes.js"), {
    prefix: "/api/v1",
  });
  await app.register(import("./presentation/routes/sync.routes.js"), { prefix: "/api/v1" });
  await app.register(import("./presentation/routes/timeline.routes.js"), { prefix: "/api/v1" });
  // Phase 4 (US2):
  await app.register(import("./presentation/routes/alerts.routes.js"), { prefix: "/api/v1" });
  // Phase 5 (US3):
  await app.register(import("./presentation/routes/insights.routes.js"), { prefix: "/api/v1" });
  // Phase 6 (T078 — LGPD data rights):
  await app.register(import("./presentation/routes/data-rights.routes.js"), { prefix: "/api/v1" });

  // ── Global error handler ─────────────────────────────────────────────────
  app.setErrorHandler((error, request, reply) => {
    const correlationId = request.id;

    if (error.validation || error instanceof ZodError) {
      return reply.status(422).send({
        error: "VALIDATION_ERROR",
        message: "Request validation failed",
        correlationId,
        details: error.validation ?? (error instanceof ZodError ? error.issues : undefined),
      });
    }

    app.log.error({ err: error, correlationId }, "Unhandled application error");

    const statusCode = error.statusCode ?? 500;
    const isServerError = statusCode >= 500;
    return reply.status(statusCode).send({
      error: isServerError ? "INTERNAL_ERROR" : (error.code ?? "REQUEST_ERROR"),
      message: isServerError ? "An unexpected error occurred" : "Request failed",
      correlationId,
    });
  });

  return app;
}
