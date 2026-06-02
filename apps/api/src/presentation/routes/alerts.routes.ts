import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import { type ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { requirePatientAccess } from "../../infrastructure/auth/rbac.middleware.js";
import { checkPatientAccess, isReadOnly } from "../../domain/services/caregiver-access.guard.js";
import {
  getPatientAlerts,
  getAlertById,
  resolveAlert,
} from "../../infrastructure/repositories/alert-event.repository.js";
import {
  ALERT_GUIDANCE,
  GUIDANCE_SUMMARY,
  type GuidanceKey,
} from "../../domain/entities/alert-event.entity.js";

const errorSchema = z.object({
  error: z.string(),
  message: z.string(),
  correlationId: z.string().optional(),
});

const alertEventSchema = z.object({
  alert_id: z.string().uuid(),
  patient_profile_id: z.string().uuid(),
  trigger_symptom_record_id: z.string().uuid(),
  alert_type: z.enum([
    "hypoglycemia_risk",
    "severe_hypoglycemia",
    "ketoacidosis_risk",
    "emergency_response_required",
  ]),
  severity_level: z.enum(["warning", "critical", "emergency"]),
  guidance_key: z.string(),
  guidance_summary: z.string(),
  created_at: z.string(),
  resolved_at: z.string().nullable(),
  resolved_by_user_id: z.string().uuid().nullable(),
});

const alertDetailSchema = alertEventSchema.omit({ guidance_summary: true }).extend({
  guidance: z.object({
    title: z.string(),
    immediate_steps: z.array(z.string()),
    emergency_contacts: z.array(z.object({ label: z.string(), phone: z.string() })),
    seek_emergency_care: z.boolean(),
    disclaimer: z.string(),
  }),
});

const listQuerySchema = z.object({
  status: z.enum(["active", "resolved", "all"]).default("active"),
  from: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export default async function alertsRoutes(baseApp: FastifyInstance) {
  const app = baseApp.withTypeProvider<ZodTypeProvider>();
  // GET /patients/:patientId/alerts
  app.get(
    "/patients/:patientId/alerts",
    {
      preHandler: [app.authenticate, requirePatientAccess as preHandlerHookHandler],
      schema: {
        params: z.object({ patientId: z.string().uuid() }),
        querystring: listQuerySchema,
        response: {
          200: z.object({
            alerts: z.array(alertEventSchema),
            next_cursor: z.string().nullable(),
          }),
          403: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { patientId } = request.params;
      const query = request.query;

      const result = await getPatientAlerts(patientId, {
        status: query.status,
        limit: query.limit,
        ...(query.from ? { from: new Date(query.from) } : {}),
        ...(query.cursor ? { cursor: query.cursor } : {}),
      });

      return reply.status(200).send({
        alerts: result.alerts.map((a) => ({
          alert_id: a.id,
          patient_profile_id: a.patientProfileId,
          trigger_symptom_record_id: a.triggerSymptomRecordId,
          alert_type: a.alertType,
          severity_level: a.severityLevel,
          guidance_key: a.guidanceKey,
          guidance_summary: GUIDANCE_SUMMARY[a.guidanceKey as GuidanceKey] ?? "",
          created_at: a.createdAt.toISOString(),
          resolved_at: a.resolvedAt?.toISOString() ?? null,
          resolved_by_user_id: a.resolvedByUserId ?? null,
        })),
        next_cursor: result.nextCursor,
      });
    },
  );

  // GET /alerts/:alertId
  app.get(
    "/alerts/:alertId",
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({ alertId: z.string().uuid() }),
        response: {
          200: alertDetailSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { alertId } = request.params;

      const alert = await getAlertById(alertId);
      // Return 404 for both "not found" and "no access" to prevent alert ID enumeration.
      const access = alert
        ? await checkPatientAccess(request.jwtUser.sub, alert.patientProfileId)
        : null;

      if (!alert || !access) {
        return reply.status(404).send({
          error: "ALERT_NOT_FOUND",
          message: "Alert not found",
          correlationId: request.id,
        });
      }

      const guidance = ALERT_GUIDANCE[alert.guidanceKey as GuidanceKey];

      return reply.status(200).send({
        alert_id: alert.id,
        patient_profile_id: alert.patientProfileId,
        trigger_symptom_record_id: alert.triggerSymptomRecordId,
        alert_type: alert.alertType,
        severity_level: alert.severityLevel,
        guidance_key: alert.guidanceKey,
        guidance: guidance,
        created_at: alert.createdAt.toISOString(),
        resolved_at: alert.resolvedAt?.toISOString() ?? null,
        resolved_by_user_id: alert.resolvedByUserId ?? null,
      });
    },
  );

  // PATCH /alerts/:alertId/resolve
  app.patch(
    "/alerts/:alertId/resolve",
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({ alertId: z.string().uuid() }),
        body: z.object({
          resolution_note: z.string().max(500).optional(),
        }),
        response: {
          200: z.object({
            alert_id: z.string().uuid(),
            resolved_at: z.string(),
            resolved_by_user_id: z.string().uuid(),
          }),
          403: errorSchema,
          404: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { alertId } = request.params;

      const alert = await getAlertById(alertId);
      // Return 404 for both "not found" and "no access" to prevent alert ID enumeration.
      const access = alert
        ? await checkPatientAccess(request.jwtUser.sub, alert.patientProfileId)
        : null;

      if (!alert || !access) {
        return reply.status(404).send({
          error: "ALERT_NOT_FOUND",
          message: "Alert not found",
          correlationId: request.id,
        });
      }

      if (isReadOnly(access.assignmentRole)) {
        return reply.status(403).send({
          error: "READ_ONLY_ASSIGNMENT",
          message: "Your caregiver role is read-only for this patient",
          correlationId: request.id,
        });
      }

      if (alert.resolvedAt !== null) {
        return reply.status(409).send({
          error: "ALERT_ALREADY_RESOLVED",
          message: "This alert has already been resolved",
          correlationId: request.id,
        });
      }

      const resolved = await resolveAlert(alertId, request.jwtUser.sub);

      return reply.status(200).send({
        alert_id: resolved.id,
        resolved_at: resolved.resolvedAt?.toISOString() ?? new Date().toISOString(),
        resolved_by_user_id: resolved.resolvedByUserId ?? request.jwtUser.sub,
      });
    },
  );
}
