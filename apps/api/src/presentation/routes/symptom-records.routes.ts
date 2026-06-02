import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import { type ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createSymptomRecordSchema } from "@sweetcare/shared-validation";
import {
  requirePatientAccess,
  requireWriteAccess,
} from "../../infrastructure/auth/rbac.middleware.js";
import {
  createSymptomRecord,
  updateSymptomRecord,
  deleteSymptomRecord,
  listSymptomRecords,
} from "../../application/services/symptom-record.service.js";

const errorSchema = z.object({
  error: z.string(),
  message: z.string(),
  correlationId: z.string().optional(),
});

const symptomRecordSchema = z.object({
  record_id: z.string(),
  client_id: z.string(),
  patient_profile_id: z.string(),
  symptom_codes: z.array(z.string()),
  severity_level: z.enum(["mild", "moderate", "severe", "emergency"]),
  glucose_reading_mgdl: z.number().nullable(),
  notes: z.string().nullable(),
  observed_at: z.string(),
  recorded_at: z.string(),
  sync_status: z.enum(["pending", "synced", "conflict"]),
  timezone: z.string(),
});

const listQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});

export default async function symptomRecordsRoutes(baseApp: FastifyInstance) {
  const app = baseApp.withTypeProvider<ZodTypeProvider>();
  // POST /patients/:patientId/symptoms
  app.post(
    "/patients/:patientId/symptoms",
    {
      preHandler: [
        app.authenticate,
        requirePatientAccess as preHandlerHookHandler,
        requireWriteAccess as preHandlerHookHandler,
      ],
      schema: {
        params: z.object({ patientId: z.string().uuid() }),
        body: createSymptomRecordSchema,
        response: {
          201: z.object({
            record_id: z.string(),
            client_id: z.string(),
            sync_status: z.literal("synced"),
            recorded_at: z.string(),
            alert_triggered: z.boolean(),
            alert_id: z.string().uuid().nullable(),
          }),
          200: z.object({
            record_id: z.string(),
            client_id: z.string(),
            sync_status: z.literal("synced"),
            recorded_at: z.string(),
            alert_triggered: z.boolean(),
            alert_id: z.string().uuid().nullable(),
          }),
          403: errorSchema,
          422: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { patientId } = request.params;
      const body = request.body;

      const { record, isNew, alertTriggered, alertId } = await createSymptomRecord(
        {
          clientId: body.client_id,
          patientProfileId: patientId,
          recordedByUserId: request.jwtUser.sub,
          symptomCodes: body.symptom_codes,
          severityLevel: body.severity_level,
          ...(body.glucose_reading_mgdl !== undefined && {
            glucoseReadingMgdl: body.glucose_reading_mgdl,
          }),
          ...(body.notes !== undefined && { notes: body.notes }),
          observedAt: new Date(body.observed_at),
          timezone: body.timezone,
        },
        {
          actorUserId: request.jwtUser.sub,
          correlationId: request.id,
          ipAddress: request.ip ?? "unknown",
          userAgent: request.headers["user-agent"] ?? "unknown",
        },
      );

      const status = isNew ? 201 : 200;
      return reply.status(status).send({
        record_id: record.id,
        client_id: record.clientId,
        sync_status: "synced" as const,
        recorded_at: record.recordedAt.toISOString(),
        alert_triggered: alertTriggered,
        alert_id: alertId,
      });
    },
  );

  // PATCH /patients/:patientId/symptoms/:recordId
  app.patch(
    "/patients/:patientId/symptoms/:recordId",
    {
      preHandler: [
        app.authenticate,
        requirePatientAccess as preHandlerHookHandler,
        requireWriteAccess as preHandlerHookHandler,
      ],
      schema: {
        params: z.object({ patientId: z.string().uuid(), recordId: z.string().uuid() }),
        body: z.object({
          symptom_codes: z.array(z.string()).min(1).optional(),
          severity_level: z.enum(["mild", "moderate", "severe", "emergency"]).optional(),
          glucose_reading_mgdl: z.number().int().min(20).max(600).nullable().optional(),
          notes: z.string().max(1000).nullable().optional(),
        }),
        response: {
          200: z.object({ record_id: z.string(), updated: z.literal(true) }),
          403: errorSchema,
          404: errorSchema,
          422: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { patientId, recordId } = request.params;
      const body = request.body as {
        symptom_codes?: string[];
        severity_level?: "mild" | "moderate" | "severe" | "emergency";
        glucose_reading_mgdl?: number | null;
        notes?: string | null;
      };

      const record = await updateSymptomRecord(
        recordId,
        patientId,
        {
          ...(body.symptom_codes !== undefined && { symptomCodes: body.symptom_codes }),
          ...(body.severity_level !== undefined && { severityLevel: body.severity_level }),
          ...(body.glucose_reading_mgdl !== undefined && {
            glucoseReadingMgdl: body.glucose_reading_mgdl,
          }),
          ...(body.notes !== undefined && { notes: body.notes }),
        },
        {
          actorUserId: request.jwtUser.sub,
          correlationId: request.id,
          ipAddress: request.ip ?? "unknown",
          userAgent: request.headers["user-agent"] ?? "unknown",
        },
      );

      return reply.status(200).send({ record_id: record.id, updated: true });
    },
  );

  // DELETE /patients/:patientId/symptoms/:recordId
  app.delete(
    "/patients/:patientId/symptoms/:recordId",
    {
      preHandler: [
        app.authenticate,
        requirePatientAccess as preHandlerHookHandler,
        requireWriteAccess as preHandlerHookHandler,
      ],
      schema: {
        params: z.object({ patientId: z.string().uuid(), recordId: z.string().uuid() }),
        response: {
          204: z.undefined(),
          403: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { patientId, recordId } = request.params;

      await deleteSymptomRecord(recordId, patientId, {
        actorUserId: request.jwtUser.sub,
        correlationId: request.id,
        ipAddress: request.ip ?? "unknown",
        userAgent: request.headers["user-agent"] ?? "unknown",
      });

      return reply.status(204).send();
    },
  );

  // GET /patients/:patientId/symptoms
  app.get(
    "/patients/:patientId/symptoms",
    {
      preHandler: [app.authenticate, requirePatientAccess as preHandlerHookHandler],
      schema: {
        params: z.object({ patientId: z.string().uuid() }),
        querystring: listQuerySchema,
        response: {
          200: z.object({
            records: z.array(symptomRecordSchema),
            next_cursor: z.string().nullable(),
            total_count: z.number(),
          }),
          403: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { patientId } = request.params;
      const query = request.query;

      const result = await listSymptomRecords(patientId, {
        ...(query.from ? { from: new Date(query.from) } : {}),
        ...(query.to ? { to: new Date(query.to) } : {}),
        limit: query.limit,
        ...(query.cursor ? { cursor: query.cursor } : {}),
      });

      return reply.status(200).send({
        records: result.records.map((r) => ({
          record_id: r.id,
          client_id: r.clientId,
          patient_profile_id: r.patientProfileId,
          symptom_codes: r.symptomCodes,
          severity_level: r.severityLevel,
          glucose_reading_mgdl: r.glucoseReadingMgdl != null ? Number(r.glucoseReadingMgdl) : null,
          notes: r.notes,
          observed_at: r.observedAt.toISOString(),
          recorded_at: r.recordedAt.toISOString(),
          sync_status: r.syncStatus,
          timezone: r.timezone,
        })),
        next_cursor: result.nextCursor,
        total_count: result.totalCount,
      });
    },
  );
}
