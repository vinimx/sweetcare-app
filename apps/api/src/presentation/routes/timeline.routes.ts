import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requirePatientAccess } from "../../infrastructure/auth/rbac.middleware.js";
import { getPatientInsulinRecords } from "../../infrastructure/repositories/insulin-record.repository.js";
import { getPatientSymptomRecords } from "../../infrastructure/repositories/symptom-record.repository.js";

const errorSchema = z.object({
  error: z.string(),
  message: z.string(),
  correlationId: z.string().optional(),
});

const insulinEventSchema = z.object({
  type: z.literal("insulin"),
  event_time: z.string(),
  data: z.object({
    record_id: z.string(),
    client_id: z.string(),
    insulin_type: z.string(),
    dose_units: z.number(),
    dose_rationale: z.enum(["correction", "meal_coverage", "basal", "combination"]),
    meal_carbs_grams: z.number().nullable(),
    glucose_before_mgdl: z.number().nullable(),
    administration_site: z.string().nullable(),
    notes: z.string().nullable(),
    applied_at: z.string(),
    timezone: z.string(),
  }),
});

const symptomEventSchema = z.object({
  type: z.literal("symptom"),
  event_time: z.string(),
  data: z.object({
    record_id: z.string(),
    client_id: z.string(),
    symptom_codes: z.array(z.string()),
    severity_level: z.enum(["mild", "moderate", "severe", "emergency"]),
    glucose_reading_mgdl: z.number().nullable(),
    notes: z.string().nullable(),
    observed_at: z.string(),
    timezone: z.string(),
  }),
});

const timelineEventSchema = z.discriminatedUnion("type", [insulinEventSchema, symptomEventSchema]);

const listQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  types: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});

export default async function timelineRoutes(app: FastifyInstance) {
  // GET /patients/:patientId/timeline
  app.get(
    "/patients/:patientId/timeline",
    {
      preHandler: [app.authenticate, requirePatientAccess],
      schema: {
        params: z.object({ patientId: z.string().uuid() }),
        querystring: listQuerySchema,
        response: {
          200: z.object({
            events: z.array(timelineEventSchema),
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

      const requestedTypes = query.types
        ? new Set(query.types.split(",").map((t) => t.trim()))
        : new Set(["insulin", "symptom"]);

      const includeInsulin = requestedTypes.has("insulin");
      const includeSymptom = requestedTypes.has("symptom");

      const cursorDate = query.cursor
        ? new Date(Buffer.from(query.cursor, "base64url").toString("utf8"))
        : null;

      const baseQuery = {
        from: query.from ? new Date(query.from) : undefined,
        to: cursorDate ?? (query.to ? new Date(query.to) : undefined),
        limit: query.limit + 1,
        cursor: undefined as string | undefined,
      };

      // Fetch oversized pages to allow merge + sort + cursor slicing
      const [insulinResult, symptomResult] = await Promise.all([
        includeInsulin
          ? getPatientInsulinRecords(patientId, baseQuery)
          : Promise.resolve({ records: [], nextCursor: null, totalCount: 0 }),
        includeSymptom
          ? getPatientSymptomRecords(patientId, baseQuery)
          : Promise.resolve({ records: [], nextCursor: null, totalCount: 0 }),
      ]);

      type RawEvent = {
        type: "insulin" | "symptom";
        eventTime: Date;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        raw: any;
      };

      const events: RawEvent[] = [
        ...insulinResult.records.map((r) => ({
          type: "insulin" as const,
          eventTime: r.appliedAt,
          raw: r,
        })),
        ...symptomResult.records.map((r) => ({
          type: "symptom" as const,
          eventTime: r.observedAt,
          raw: r,
        })),
      ];

      events.sort((a, b) => b.eventTime.getTime() - a.eventTime.getTime());

      const limit = query.limit;
      const hasMore = events.length > limit;
      const page = hasMore ? events.slice(0, limit) : events;
      const last = page.at(-1);
      const nextCursor =
        hasMore && last ? Buffer.from(last.eventTime.toISOString()).toString("base64url") : null;

      const totalCount = insulinResult.totalCount + symptomResult.totalCount;

      const mapped = page.map((e) => {
        if (e.type === "insulin") {
          const r = e.raw;
          return {
            type: "insulin" as const,
            event_time: r.appliedAt.toISOString(),
            data: {
              record_id: r.id,
              client_id: r.clientId,
              insulin_type: r.insulinType,
              dose_units: Number(r.doseUnits),
              dose_rationale: r.doseRationale,
              meal_carbs_grams: r.mealCarbsGrams,
              glucose_before_mgdl: r.glucoseBeforeMgdl,
              administration_site: r.administrationSite,
              notes: r.notes,
              applied_at: r.appliedAt.toISOString(),
              timezone: r.timezone,
            },
          };
        } else {
          const r = e.raw;
          return {
            type: "symptom" as const,
            event_time: r.observedAt.toISOString(),
            data: {
              record_id: r.id,
              client_id: r.clientId,
              symptom_codes: r.symptomCodes as string[],
              severity_level: r.severityLevel,
              glucose_reading_mgdl: r.glucoseReadingMgdl,
              notes: r.notes,
              observed_at: r.observedAt.toISOString(),
              timezone: r.timezone,
            },
          };
        }
      });

      return reply.status(200).send({
        events: mapped,
        next_cursor: nextCursor,
        total_count: totalCount,
      });
    },
  );
}
