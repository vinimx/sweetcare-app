import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createInsulinRecordSchema } from "@sweetcare/shared-validation";
import {
  requirePatientAccess,
  requireWriteAccess,
} from "../../infrastructure/auth/rbac.middleware.js";
import {
  createInsulinRecord,
  updateInsulinRecord,
  deleteInsulinRecord,
  listInsulinRecords,
} from "../../application/services/insulin-record.service.js";

const errorSchema = z.object({
  error: z.string(),
  message: z.string(),
  correlationId: z.string().optional(),
});

const insulinRecordSchema = z.object({
  record_id: z.string(),
  client_id: z.string(),
  patient_profile_id: z.string(),
  insulin_type: z.string(),
  dose_units: z.number(),
  dose_rationale: z.enum(["correction", "meal_coverage", "basal", "combination"]),
  meal_carbs_grams: z.number().nullable(),
  glucose_before_mgdl: z.number().nullable(),
  administration_site: z.string().nullable(),
  notes: z.string().nullable(),
  applied_at: z.string(),
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

export default async function insulinRecordsRoutes(app: FastifyInstance) {
  // POST /patients/:patientId/insulin-records
  app.post(
    "/patients/:patientId/insulin-records",
    {
      preHandler: [app.authenticate, requirePatientAccess, requireWriteAccess],
      schema: {
        params: z.object({ patientId: z.string().uuid() }),
        body: createInsulinRecordSchema,
        response: {
          201: z.object({
            record_id: z.string(),
            client_id: z.string(),
            sync_status: z.literal("synced"),
            recorded_at: z.string(),
          }),
          200: z.object({
            record_id: z.string(),
            client_id: z.string(),
            sync_status: z.literal("synced"),
            recorded_at: z.string(),
          }),
          403: errorSchema,
          422: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { patientId } = request.params as { patientId: string };
      const body = request.body;

      const { record, isNew } = await createInsulinRecord(
        {
          clientId: body.client_id,
          patientProfileId: patientId,
          recordedByUserId: request.jwtUser.sub,
          insulinType: body.insulin_type,
          doseUnits: body.dose_units,
          doseRationale: body.dose_rationale,
          mealCarbsGrams: body.meal_carbs_grams,
          glucoseBeforeMgdl: body.glucose_before_mgdl,
          administrationSite: body.administration_site,
          notes: body.notes,
          appliedAt: new Date(body.applied_at),
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
      });
    },
  );

  // PATCH /patients/:patientId/insulin-records/:recordId
  app.patch(
    "/patients/:patientId/insulin-records/:recordId",
    {
      preHandler: [app.authenticate, requirePatientAccess, requireWriteAccess],
      schema: {
        params: z.object({ patientId: z.string().uuid(), recordId: z.string().uuid() }),
        body: z.object({
          insulin_type: z.string().min(1).max(100).optional(),
          dose_units: z.number().positive().max(100).optional(),
          dose_rationale: z
            .enum(["correction", "meal_coverage", "basal", "combination"])
            .optional(),
          meal_carbs_grams: z.number().int().min(0).max(500).nullable().optional(),
          glucose_before_mgdl: z.number().int().min(20).max(600).nullable().optional(),
          administration_site: z.string().max(100).nullable().optional(),
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
      const { patientId, recordId } = request.params as { patientId: string; recordId: string };
      const body = request.body as {
        insulin_type?: string;
        dose_units?: number;
        dose_rationale?: "correction" | "meal_coverage" | "basal" | "combination";
        meal_carbs_grams?: number | null;
        glucose_before_mgdl?: number | null;
        administration_site?: string | null;
        notes?: string | null;
      };

      const record = await updateInsulinRecord(
        recordId,
        patientId,
        {
          insulinType: body.insulin_type,
          doseUnits: body.dose_units,
          doseRationale: body.dose_rationale,
          mealCarbsGrams: body.meal_carbs_grams,
          glucoseBeforeMgdl: body.glucose_before_mgdl,
          administrationSite: body.administration_site,
          notes: body.notes,
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

  // DELETE /patients/:patientId/insulin-records/:recordId
  app.delete(
    "/patients/:patientId/insulin-records/:recordId",
    {
      preHandler: [app.authenticate, requirePatientAccess, requireWriteAccess],
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
      const { patientId, recordId } = request.params as { patientId: string; recordId: string };

      await deleteInsulinRecord(recordId, patientId, {
        actorUserId: request.jwtUser.sub,
        correlationId: request.id,
        ipAddress: request.ip ?? "unknown",
        userAgent: request.headers["user-agent"] ?? "unknown",
      });

      return reply.status(204).send();
    },
  );

  // GET /patients/:patientId/insulin-records
  app.get(
    "/patients/:patientId/insulin-records",
    {
      preHandler: [app.authenticate, requirePatientAccess],
      schema: {
        params: z.object({ patientId: z.string().uuid() }),
        querystring: listQuerySchema,
        response: {
          200: z.object({
            records: z.array(insulinRecordSchema),
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

      const result = await listInsulinRecords(patientId, {
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
          insulin_type: r.insulinType,
          dose_units: Number(r.doseUnits),
          dose_rationale: r.doseRationale,
          meal_carbs_grams: r.mealCarbsGrams,
          glucose_before_mgdl: r.glucoseBeforeMgdl,
          administration_site: r.administrationSite,
          notes: r.notes,
          applied_at: r.appliedAt.toISOString(),
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
