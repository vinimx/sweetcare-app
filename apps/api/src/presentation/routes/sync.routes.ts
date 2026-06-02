import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import { type ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { syncBatchSchema, resolveConflictSchema } from "@sweetcare/shared-validation";
import { requirePatientAccess } from "../../infrastructure/auth/rbac.middleware.js";
import {
  processSyncBatch,
  getSyncStatus,
  resolveConflict,
} from "../../application/services/sync-batch.service.js";

const errorSchema = z.object({
  error: z.string(),
  message: z.string(),
  correlationId: z.string().optional(),
});

const conflictSchema = z.object({
  client_id: z.string(),
  conflict_type: z.enum([
    "overlapping_insulin_window",
    "concurrent_edit",
    "patient_access_revoked",
    "consent_revoked",
  ]),
  details: z.string(),
  requires_manual_resolution: z.boolean(),
});

const conflictSummarySchema = z.object({
  sync_event_id: z.string(),
  conflict_count: z.number(),
  oldest_conflict_at: z.string(),
});

export default async function syncRoutes(baseApp: FastifyInstance) {
  const app = baseApp.withTypeProvider<ZodTypeProvider>();
  // POST /sync/batch
  app.post(
    "/sync/batch",
    {
      preHandler: [app.authenticate],
      schema: {
        body: syncBatchSchema,
        response: {
          200: z.object({
            batch_id: z.string(),
            committed: z.number(),
            skipped: z.number(),
            conflicts: z.array(conflictSchema),
            sync_event_id: z.string(),
          }),
          403: errorSchema,
          422: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await processSyncBatch(request.body, {
        actorUserId: request.jwtUser.sub,
        correlationId: request.id,
        ipAddress: request.ip ?? "unknown",
        userAgent: request.headers["user-agent"] ?? "unknown",
      });

      return reply.status(200).send(result);
    },
  );

  // GET /sync/status/:patientId
  app.get(
    "/sync/status/:patientId",
    {
      preHandler: [app.authenticate, requirePatientAccess as preHandlerHookHandler],
      schema: {
        params: z.object({ patientId: z.string().uuid() }),
        response: {
          200: z.object({
            patient_profile_id: z.string(),
            last_sync_at: z.string().nullable(),
            pending_conflicts: z.array(conflictSummarySchema),
            total_pending_local: z.number().nullable(),
          }),
          403: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { patientId } = request.params;
      const result = await getSyncStatus(patientId, request.jwtUser.sub);
      return reply.status(200).send(result);
    },
  );

  // POST /sync/resolve-conflict
  app.post(
    "/sync/resolve-conflict",
    {
      preHandler: [app.authenticate],
      schema: {
        body: resolveConflictSchema,
        response: {
          200: z.object({
            client_id: z.string(),
            resolution: z.string(),
            resolved_at: z.string(),
            audit_entry_id: z.string(),
          }),
          403: errorSchema,
          404: errorSchema,
          422: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await resolveConflict(request.body, {
        actorUserId: request.jwtUser.sub,
        correlationId: request.id,
        ipAddress: request.ip ?? "unknown",
        userAgent: request.headers["user-agent"] ?? "unknown",
      });

      return reply.status(200).send(result);
    },
  );
}
