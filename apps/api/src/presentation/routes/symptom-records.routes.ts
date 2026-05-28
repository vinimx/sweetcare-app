import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createSymptomRecordSchema } from "@sweetcare/shared-validation";
import {
  requirePatientAccess,
  requireWriteAccess,
} from "../../infrastructure/auth/rbac.middleware.js";
import {
  createSymptomRecord,
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

export default async function symptomRecordsRoutes(app: FastifyInstance) {
  // POST /patients/:patientId/symptoms
  app.post(
    "/patients/:patientId/symptoms",
    {
      preHandler: [app.authenticate, requirePatientAccess, requireWriteAccess],
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
      const { patientId } = request.params as { patientId: string };
      const body = request.body;

      const { record, isNew, alertTriggered, alertId } = await createSymptomRecord(
        {
          clientId: body.client_id,
          patientProfileId: patientId,
          recordedByUserId: request.jwtUser.sub,
          symptomCodes: body.symptom_codes as Parameters<
            typeof createSymptomRecord
          >[0]["symptomCodes"],
          severityLevel: body.severity_level,
          glucoseReadingMgdl: body.glucose_reading_mgdl,
          notes: body.notes,
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

  // GET /patients/:patientId/symptoms
  app.get(
    "/patients/:patientId/symptoms",
    {
      preHandler: [app.authenticate, requirePatientAccess],
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
      const { patientId } = request.params as { patientId: string };
      const query = request.query as z.infer<typeof listQuerySchema>;

      const result = await listSymptomRecords(patientId, {
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
        limit: query.limit,
        cursor: query.cursor,
      });

      return reply.status(200).send({
        records: result.records.map((r) => ({
          record_id: r.id,
          client_id: r.clientId,
          patient_profile_id: r.patientProfileId,
          symptom_codes: r.symptomCodes as string[],
          severity_level: r.severityLevel,
          glucose_reading_mgdl: r.glucoseReadingMgdl,
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
