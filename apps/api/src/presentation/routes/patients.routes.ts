import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createPatientSchema } from "@sweetcare/shared-validation";
import { CONSENT_TEXT_VERSION } from "@sweetcare/shared-config";
import { getPrismaClient } from "../../infrastructure/database/client.js";
import { hashSensitive } from "../../infrastructure/database/encryption-middleware.js";
import { auditCreate } from "../../application/audit/audit.service.js";
import { requirePatientAccess } from "../../infrastructure/auth/rbac.middleware.js";

const errorSchema = z.object({
  error: z.string(),
  message: z.string(),
  correlationId: z.string().optional(),
});

const patientResponseSchema = z.object({
  patient_id: z.string(),
  full_name: z.string(),
  date_of_birth: z.string(),
  diagnosis_year: z.number(),
  target_glucose_min_mgdl: z.number(),
  target_glucose_max_mgdl: z.number(),
  insulin_type_basal: z.string().nullable(),
  insulin_type_bolus: z.string().nullable(),
  icr_units_per_gram_carb: z.number().nullable(),
  isf_mgdl_per_unit: z.number().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
});

export default async function patientsRoutes(app: FastifyInstance) {
  // POST /patients
  app.post(
    "/patients",
    {
      preHandler: [app.authenticate],
      schema: {
        body: createPatientSchema,
        response: {
          201: z.object({ patient_id: z.string(), created_at: z.string() }),
          403: errorSchema,
          422: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { jwtUser } = request;
      if (jwtUser.role !== "guardian") {
        return reply.status(403).send({
          error: "FORBIDDEN",
          message: "Only guardians can create patient profiles",
          correlationId: request.id,
        });
      }

      const prisma = getPrismaClient();
      const body = request.body;

      const existingCount = await prisma.patientProfile.count({
        where: { createdByUserId: jwtUser.sub },
      });
      if (existingCount >= 10) {
        return reply.status(422).send({
          error: "PATIENT_LIMIT_EXCEEDED",
          message: "Guardians may not create more than 10 patient profiles",
          correlationId: request.id,
        });
      }

      const ipAddress = request.ip ?? "unknown";
      const userAgent = request.headers["user-agent"] ?? "unknown";

      const { patient, consent } = await prisma.$transaction(async (tx) => {
        const patient = await tx.patientProfile.create({
          data: {
            fullName: body.full_name,
            dateOfBirth: new Date(body.date_of_birth),
            diagnosisYear: body.diagnosis_year,
            targetGlucoseMinMgdl: body.target_glucose_min_mgdl,
            targetGlucoseMaxMgdl: body.target_glucose_max_mgdl,
            insulinTypeBasal: body.insulin_type_basal ?? null,
            insulinTypeBolus: body.insulin_type_bolus ?? null,
            icrUnitsPerGramCarb: body.icr_units_per_gram_carb ?? null,
            isfMgdlPerUnit: body.isf_mgdl_per_unit ?? null,
            createdByUserId: jwtUser.sub,
          },
          select: { id: true, createdAt: true },
        });

        // Auto-create primary guardian assignment
        await tx.caregiverAssignment.create({
          data: {
            patientProfileId: patient.id,
            userId: jwtUser.sub,
            assignmentRole: "primary_guardian",
            grantedByUserId: jwtUser.sub,
            grantedAt: new Date(),
          },
        });

        // Auto-grant data_processing consent (LGPD Art. 14)
        const consent = await tx.consentRecord.create({
          data: {
            guardianUserId: jwtUser.sub,
            patientProfileId: patient.id,
            consentType: "data_processing",
            grantedAt: new Date(),
            consentTextVersion: CONSENT_TEXT_VERSION,
            ipAddressHash: hashSensitive(ipAddress),
            userAgentHash: hashSensitive(userAgent),
          },
          select: { id: true },
        });

        return { patient, consent };
      });

      void auditCreate({
        actorUserId: jwtUser.sub,
        correlationId: request.id,
        targetTable: "patient_profiles",
        targetId: patient.id,
        diffSummary: { consentId: consent.id, diagnosisYear: body.diagnosis_year },
        ipAddress,
        userAgent,
      });

      return reply.status(201).send({
        patient_id: patient.id,
        created_at: patient.createdAt.toISOString(),
      });
    },
  );

  // GET /patients/:patientId
  app.get(
    "/patients/:patientId",
    {
      preHandler: [app.authenticate, requirePatientAccess],
      schema: {
        params: z.object({ patientId: z.string().uuid() }),
        response: { 200: patientResponseSchema, 403: errorSchema, 404: errorSchema },
      },
    },
    async (request, reply) => {
      const { patientId } = request.params as { patientId: string };
      const prisma = getPrismaClient();

      const profile = await prisma.patientProfile.findUnique({
        where: { id: patientId },
      });
      if (!profile || !profile.isActive) {
        return reply.status(404).send({
          error: "PATIENT_NOT_FOUND",
          message: "Patient profile not found",
          correlationId: request.id,
        });
      }

      return reply.status(200).send({
        patient_id: profile.id,
        full_name: profile.fullName,
        date_of_birth: profile.dateOfBirth.toISOString().split("T")[0] ?? "",
        diagnosis_year: profile.diagnosisYear,
        target_glucose_min_mgdl: profile.targetGlucoseMinMgdl,
        target_glucose_max_mgdl: profile.targetGlucoseMaxMgdl,
        insulin_type_basal: profile.insulinTypeBasal,
        insulin_type_bolus: profile.insulinTypeBolus,
        icr_units_per_gram_carb: profile.icrUnitsPerGramCarb
          ? Number(profile.icrUnitsPerGramCarb)
          : null,
        isf_mgdl_per_unit: profile.isfMgdlPerUnit ? Number(profile.isfMgdlPerUnit) : null,
        is_active: profile.isActive,
        created_at: profile.createdAt.toISOString(),
      });
    },
  );
}
