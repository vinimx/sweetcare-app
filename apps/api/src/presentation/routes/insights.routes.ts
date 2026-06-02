import type { FastifyInstance } from "fastify";
import { type ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  checkPatientAccess,
  hasActiveConsent,
} from "../../domain/services/caregiver-access.guard.js";
import {
  validateReportPeriod,
  CLINICAL_DISCLAIMER_V1,
} from "../../domain/entities/insight-report.entity.js";
import { aggregatePatientData } from "../../application/services/insight-aggregation.service.js";
import {
  createInsightReport,
  getReportById,
  listPatientReports,
  updateReportCompleted,
  updateReportFailed,
} from "../../infrastructure/repositories/insight-report.repository.js";
import { callAnalyze } from "../../infrastructure/ai/ai-service-client.js";
import { logger } from "../../infrastructure/logging/logger.js";

const REPORT_TYPES = [
  "weekly_summary",
  "glucose_pattern",
  "insulin_effectiveness",
  "symptom_trend",
] as const;

const errorSchema = z.object({
  error: z.string(),
  message: z.string(),
  correlationId: z.string().optional(),
});

const patternFindingSchema = z.object({
  finding_type: z.string(),
  description: z.string(),
  supporting_data_points: z.number().int(),
  confidence: z.enum(["low", "medium", "high"]),
});

const confidenceContextSchema = z.object({
  data_coverage_percent: z.number(),
  model_limitations: z.array(z.string()),
});

export default async function insightsRoutes(baseApp: FastifyInstance) {
  const app = baseApp.withTypeProvider<ZodTypeProvider>();
  // POST /insights/reports — request generation (async, returns 202)
  app.post(
    "/insights/reports",
    {
      preHandler: [app.authenticate],
      schema: {
        body: z.object({
          patient_id: z.string().uuid(),
          report_type: z.enum(REPORT_TYPES),
          period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        }),
        response: {
          202: z.object({
            report_id: z.string().uuid(),
            status: z.literal("processing"),
            estimated_ready_in_seconds: z.number(),
            poll_url: z.string(),
          }),
          403: errorSchema,
          422: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const body = request.body;

      // Verify caregiver assignment before any processing
      const patientAccess = await checkPatientAccess(request.jwtUser.sub, body.patient_id);
      if (!patientAccess) {
        return reply.status(403).send({
          error: "PATIENT_ACCESS_DENIED",
          message: "No active caregiver assignment for this patient",
          correlationId: request.id,
        });
      }

      // Parse as UTC midnight — used for storage and period validation (calendar days)
      const periodStart = new Date(body.period_start + "T00:00:00.000Z");
      // End-of-day version used for DB queries so records created during period_end are included
      const periodEndForStorage = new Date(body.period_end + "T00:00:00.000Z");
      const periodEndForQuery = new Date(body.period_end + "T23:59:59.999Z");

      if (isNaN(periodStart.getTime()) || isNaN(periodEndForStorage.getTime())) {
        return reply.status(422).send({
          error: "INVALID_DATE",
          message: "period_start and period_end must be valid calendar dates",
          correlationId: request.id,
        });
      }

      const periodError = validateReportPeriod(periodStart, periodEndForStorage);
      if (periodError) {
        return reply.status(422).send({
          error: periodError.code,
          message: periodError.message,
          correlationId: request.id,
        });
      }

      // Require active ai_analysis consent
      const aiConsent = await hasActiveConsent(
        request.jwtUser.sub,
        body.patient_id,
        "ai_analysis",
      ).catch(() => false);
      if (!aiConsent) {
        return reply.status(403).send({
          error: "CONSENT_REQUIRED",
          message: "Active ai_analysis consent is required to generate insight reports",
          correlationId: request.id,
        });
      }

      // Validate minimum data (synchronous check before creating the record)
      try {
        await aggregatePatientData(body.patient_id, periodStart, periodEndForQuery);
      } catch (err) {
        if (err instanceof Error && (err as { code?: string }).code === "INSUFFICIENT_DATA") {
          return reply.status(422).send({
            error: "INSUFFICIENT_DATA",
            message: "At least 3 insulin records are required in the selected period",
            correlationId: request.id,
          });
        }
        logger.error({ err, correlationId: request.id }, "Data aggregation pre-check failed");
        return reply.status(503).send({
          error: "INSIGHTS_SERVICE_UNAVAILABLE",
          message: "Unable to process insight request at this time",
          correlationId: request.id,
        });
      }

      const report = await createInsightReport({
        patientProfileId: body.patient_id,
        requestedByUserId: request.jwtUser.sub,
        reportType: body.report_type,
        periodStart,
        periodEnd: periodEndForStorage,
      });

      const correlationId = request.id;

      // Fire-and-forget background AI analysis
      void (async () => {
        try {
          const aggregation = await aggregatePatientData(
            body.patient_id,
            periodStart,
            periodEndForQuery,
          );
          const aiResult = await callAnalyze({
            request_id: correlationId,
            patient_profile_id: body.patient_id,
            report_type: body.report_type,
            period_start: body.period_start,
            period_end: body.period_end,
            records: aggregation.records,
          });
          await updateReportCompleted(report.id, {
            summaryText: aiResult.summary_text,
            patternFindings: aiResult.pattern_findings,
            confidenceContext: aiResult.confidence_context,
            aiModelVersion: aiResult.model_version,
          });
        } catch (err) {
          const code =
            err instanceof Error && (err as unknown as { code?: string }).code
              ? (err as unknown as { code: string }).code
              : "AI_SERVICE_ERROR";
          logger.error(
            { err, reportId: report.id, correlationId },
            "Background AI analysis failed",
          );
          await updateReportFailed(report.id, code).catch(() => undefined);
        }
      })();

      const host = request.headers.host ?? "localhost";
      const protocol = request.protocol ?? "http";

      return reply.status(202).send({
        report_id: report.id,
        status: "processing",
        estimated_ready_in_seconds: 15,
        poll_url: `${protocol}://${host}/api/v1/insights/reports/${report.id}`,
      });
    },
  );

  // GET /insights/reports/:reportId — poll status or retrieve completed report
  app.get(
    "/insights/reports/:reportId",
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({ reportId: z.string().uuid() }),
        response: {
          200: z.discriminatedUnion("status", [
            z.object({
              report_id: z.string().uuid(),
              status: z.literal("processing"),
              progress_percent: z.number().nullable(),
            }),
            z.object({
              report_id: z.string().uuid(),
              status: z.literal("completed"),
              report_type: z.string(),
              period_start: z.string(),
              period_end: z.string(),
              generated_at: z.string(),
              ai_model_version: z.string(),
              is_invalidated: z.boolean(),
              content: z.object({
                summary_text: z.string(),
                pattern_findings: z.array(patternFindingSchema),
                confidence_context: confidenceContextSchema.nullable(),
                disclaimer: z.string(),
              }),
            }),
            z.object({
              report_id: z.string().uuid(),
              status: z.literal("failed"),
              error_code: z.string(),
              retry_allowed: z.boolean(),
            }),
          ]),
          403: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { reportId } = request.params;

      const report = await getReportById(reportId);
      if (!report) {
        return reply.status(404).send({
          error: "REPORT_NOT_FOUND",
          message: "Insight report not found",
          correlationId: request.id,
        });
      }

      const access = await checkPatientAccess(request.jwtUser.sub, report.patientProfileId);
      if (!access) {
        return reply.status(403).send({
          error: "FORBIDDEN",
          message: "No active caregiver assignment for this patient",
          correlationId: request.id,
        });
      }

      if (report.status === "processing") {
        return reply.status(200).send({
          report_id: report.id,
          status: "processing",
          progress_percent: null,
        });
      }

      if (report.status === "failed") {
        return reply.status(200).send({
          report_id: report.id,
          status: "failed",
          error_code: report.errorCode ?? "AI_SERVICE_ERROR",
          retry_allowed: report.errorCode !== "INSUFFICIENT_DATA",
        });
      }

      // completed
      return reply.status(200).send({
        report_id: report.id,
        status: "completed",
        report_type: report.reportType,
        period_start: report.periodStart.toISOString().split("T")[0] ?? "",
        period_end: report.periodEnd.toISOString().split("T")[0] ?? "",
        generated_at: report.generatedAt.toISOString(),
        ai_model_version: report.aiModelVersion,
        is_invalidated: report.isInvalidated,
        content: {
          summary_text: report.summaryText ?? "",
          pattern_findings:
            (report.patternFindings as {
              finding_type: string;
              description: string;
              supporting_data_points: number;
              confidence: "low" | "medium" | "high";
            }[]) ?? [],
          confidence_context:
            (report.confidenceContext as {
              data_coverage_percent: number;
              model_limitations: string[];
            } | null) ?? null,
          disclaimer: CLINICAL_DISCLAIMER_V1,
        },
      });
    },
  );

  // GET /insights/reports — list reports for a patient
  app.get(
    "/insights/reports",
    {
      preHandler: [app.authenticate],
      schema: {
        querystring: z.object({
          patient_id: z.string().uuid(),
          report_type: z.enum(REPORT_TYPES).optional(),
          limit: z.coerce.number().int().min(1).max(50).default(10),
          cursor: z.string().optional(),
        }),
        response: {
          200: z.object({
            reports: z.array(
              z.object({
                report_id: z.string().uuid(),
                status: z.enum(["processing", "completed", "failed"]),
                report_type: z.string(),
                period_start: z.string(),
                period_end: z.string(),
                generated_at: z.string(),
                is_invalidated: z.boolean(),
              }),
            ),
            next_cursor: z.string().nullable(),
          }),
          403: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const query = request.query as {
        patient_id: string;
        report_type?: (typeof REPORT_TYPES)[number];
        limit: number;
        cursor?: string;
      };

      const access = await checkPatientAccess(request.jwtUser.sub, query.patient_id);
      if (!access) {
        return reply.status(403).send({
          error: "FORBIDDEN",
          message: "No active caregiver assignment for this patient",
          correlationId: request.id,
        });
      }

      const result = await listPatientReports(query.patient_id, {
        ...(query.report_type !== undefined && { reportType: query.report_type }),
        limit: query.limit,
        ...(query.cursor !== undefined && { cursor: query.cursor }),
      });

      return reply.status(200).send({
        reports: result.reports.map((r) => ({
          report_id: r.id,
          status: r.status,
          report_type: r.reportType,
          period_start: r.periodStart.toISOString().split("T")[0] ?? "",
          period_end: r.periodEnd.toISOString().split("T")[0] ?? "",
          generated_at: r.generatedAt.toISOString(),
          is_invalidated: r.isInvalidated,
        })),
        next_cursor: result.nextCursor,
      });
    },
  );
}
