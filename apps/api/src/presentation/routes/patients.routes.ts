import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import { type ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createPatientSchema } from "@sweetcare/shared-validation";
import { CONSENT_TEXT_VERSION } from "@sweetcare/shared-config";
import { getPrismaClient } from "../../infrastructure/database/client.js";
import { type Prisma } from "@prisma/client";
import { hashSensitive } from "../../infrastructure/database/encryption-middleware.js";
import { auditCreate, auditUpdate } from "../../application/audit/audit.service.js";
import {
  requirePatientAccess,
  requireWriteAccess,
} from "../../infrastructure/auth/rbac.middleware.js";

const errorSchema = z.object({
  error: z.string(),
  message: z.string(),
  correlationId: z.string().optional(),
});

// camelCase schema matching shared-types PatientProfile
const patientProfileSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  dateOfBirth: z.string(),
  diagnosisYear: z.number(),
  targetGlucoseMinMgdl: z.number(),
  targetGlucoseMaxMgdl: z.number(),
  insulinTypeBasal: z.string().nullable(),
  insulinTypeBolus: z.string().nullable(),
  icrUnitsPerGramCarb: z.number().nullable(),
  isfMgdlPerUnit: z.number().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

function mapPatientProfile(profile: {
  id: string;
  fullName: string;
  dateOfBirth: Date;
  diagnosisYear: number;
  targetGlucoseMinMgdl: number;
  targetGlucoseMaxMgdl: number;
  insulinTypeBasal: string | null;
  insulinTypeBolus: string | null;
  icrUnitsPerGramCarb: unknown;
  isfMgdlPerUnit: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: profile.id,
    fullName: profile.fullName,
    dateOfBirth: profile.dateOfBirth.toISOString().split("T")[0] ?? "",
    diagnosisYear: profile.diagnosisYear,
    targetGlucoseMinMgdl: profile.targetGlucoseMinMgdl,
    targetGlucoseMaxMgdl: profile.targetGlucoseMaxMgdl,
    insulinTypeBasal: profile.insulinTypeBasal,
    insulinTypeBolus: profile.insulinTypeBolus,
    icrUnitsPerGramCarb: profile.icrUnitsPerGramCarb ? Number(profile.icrUnitsPerGramCarb) : null,
    isfMgdlPerUnit: profile.isfMgdlPerUnit ? Number(profile.isfMgdlPerUnit) : null,
    isActive: profile.isActive,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

const PATIENT_SELECT = {
  id: true,
  fullName: true,
  dateOfBirth: true,
  diagnosisYear: true,
  targetGlucoseMinMgdl: true,
  targetGlucoseMaxMgdl: true,
  insulinTypeBasal: true,
  insulinTypeBolus: true,
  icrUnitsPerGramCarb: true,
  isfMgdlPerUnit: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export default async function patientsRoutes(baseApp: FastifyInstance) {
  const app = baseApp.withTypeProvider<ZodTypeProvider>();
  // POST /patients
  app.post(
    "/patients",
    {
      preHandler: [app.authenticate],
      schema: {
        body: createPatientSchema,
        response: {
          201: patientProfileSchema,
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

      const { patient, consent } = await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
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
            select: PATIENT_SELECT,
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

          // Auto-grant ai_analysis consent so insights work immediately after patient creation
          await tx.consentRecord.create({
            data: {
              guardianUserId: jwtUser.sub,
              patientProfileId: patient.id,
              consentType: "ai_analysis",
              grantedAt: new Date(),
              consentTextVersion: CONSENT_TEXT_VERSION,
              ipAddressHash: hashSensitive(ipAddress),
              userAgentHash: hashSensitive(userAgent),
            },
            select: { id: true },
          });

          return { patient, consent };
        },
      );

      void auditCreate({
        actorUserId: jwtUser.sub,
        correlationId: request.id,
        targetTable: "patient_profiles",
        targetId: patient.id,
        diffSummary: { consentId: consent.id, diagnosisYear: body.diagnosis_year },
        ipAddress,
        userAgent,
      });

      return reply.status(201).send(mapPatientProfile(patient));
    },
  );

  // GET /patients — list all patients the authenticated user has access to
  app.get(
    "/patients",
    {
      preHandler: [app.authenticate],
      schema: {
        response: { 200: z.object({ patients: z.array(patientProfileSchema) }) },
      },
    },
    async (request, reply) => {
      const prisma = getPrismaClient();

      // Two-step query: PHI extension decrypts by modelKey.
      // Using include nests patientProfile under caregiverAssignment, so the
      // extension runs with modelKey="caregiverAssignment" and never decrypts
      // the PHI fields of patientProfile (fullName, insulinType*).
      const assignments = await prisma.caregiverAssignment.findMany({
        where: { userId: request.jwtUser.sub, revokedAt: null },
        select: { patientProfileId: true },
      });

      if (assignments.length === 0) {
        return reply.status(200).send({ patients: [] });
      }

      const patientIds = assignments.map((a) => a.patientProfileId);
      const profiles = await prisma.patientProfile.findMany({
        where: { id: { in: patientIds }, isActive: true },
        select: PATIENT_SELECT,
      });

      return reply.status(200).send({ patients: profiles.map(mapPatientProfile) });
    },
  );

  // GET /patients/:patientId
  app.get(
    "/patients/:patientId",
    {
      preHandler: [app.authenticate, requirePatientAccess as preHandlerHookHandler],
      schema: {
        params: z.object({ patientId: z.string().uuid() }),
        response: { 200: patientProfileSchema, 403: errorSchema, 404: errorSchema },
      },
    },
    async (request, reply) => {
      const { patientId } = request.params;
      const prisma = getPrismaClient();

      const profile = await prisma.patientProfile.findUnique({
        where: { id: patientId },
        select: PATIENT_SELECT,
      });
      if (!profile || !profile.isActive) {
        return reply.status(404).send({
          error: "PATIENT_NOT_FOUND",
          message: "Patient profile not found",
          correlationId: request.id,
        });
      }

      return reply.status(200).send(mapPatientProfile(profile));
    },
  );

  // PATCH /patients/:patientId — partial update of patient profile
  const updatePatientBodySchema = z.object({
    full_name: z.string().min(1).max(120).optional(),
    date_of_birth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    diagnosis_year: z.number().int().min(1950).max(new Date().getFullYear()).optional(),
    target_glucose_min_mgdl: z.number().int().min(40).max(300).optional(),
    target_glucose_max_mgdl: z.number().int().min(60).max(400).optional(),
    insulin_type_basal: z.string().max(60).nullable().optional(),
    insulin_type_bolus: z.string().max(60).nullable().optional(),
    icr_units_per_gram_carb: z.number().positive().max(10).nullable().optional(),
    isf_mgdl_per_unit: z.number().positive().max(300).nullable().optional(),
  });

  app.patch(
    "/patients/:patientId",
    {
      preHandler: [
        app.authenticate,
        requirePatientAccess as preHandlerHookHandler,
        requireWriteAccess as preHandlerHookHandler,
      ],
      schema: {
        params: z.object({ patientId: z.string().uuid() }),
        body: updatePatientBodySchema,
        response: {
          200: patientProfileSchema,
          403: errorSchema,
          404: errorSchema,
          422: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { patientId } = request.params;
      const body = request.body;
      const prisma = getPrismaClient();

      if (
        body.target_glucose_min_mgdl !== undefined &&
        body.target_glucose_max_mgdl !== undefined &&
        body.target_glucose_max_mgdl <= body.target_glucose_min_mgdl
      ) {
        return reply.status(422).send({
          error: "INVALID_GLUCOSE_TARGETS",
          message: "target_glucose_max_mgdl must be greater than target_glucose_min_mgdl",
          correlationId: request.id,
        });
      }

      const updateData: Record<string, unknown> = {};
      if (body.full_name !== undefined) updateData.fullName = body.full_name;
      if (body.date_of_birth !== undefined) updateData.dateOfBirth = new Date(body.date_of_birth);
      if (body.diagnosis_year !== undefined) updateData.diagnosisYear = body.diagnosis_year;
      if (body.target_glucose_min_mgdl !== undefined)
        updateData.targetGlucoseMinMgdl = body.target_glucose_min_mgdl;
      if (body.target_glucose_max_mgdl !== undefined)
        updateData.targetGlucoseMaxMgdl = body.target_glucose_max_mgdl;
      if (body.insulin_type_basal !== undefined)
        updateData.insulinTypeBasal = body.insulin_type_basal;
      if (body.insulin_type_bolus !== undefined)
        updateData.insulinTypeBolus = body.insulin_type_bolus;
      if (body.icr_units_per_gram_carb !== undefined)
        updateData.icrUnitsPerGramCarb = body.icr_units_per_gram_carb;
      if (body.isf_mgdl_per_unit !== undefined) updateData.isfMgdlPerUnit = body.isf_mgdl_per_unit;

      if (Object.keys(updateData).length === 0) {
        return reply.status(422).send({
          error: "EMPTY_UPDATE",
          message: "At least one field must be provided",
          correlationId: request.id,
        });
      }

      const profile = await prisma.patientProfile.update({
        where: { id: patientId },
        data: updateData,
        select: PATIENT_SELECT,
      });

      void auditUpdate({
        actorUserId: request.jwtUser.sub,
        correlationId: request.id,
        targetTable: "patient_profiles",
        targetId: patientId,
        diffSummary: { updatedFields: Object.keys(updateData) },
        ipAddress: request.ip ?? "unknown",
        userAgent: request.headers["user-agent"] ?? "unknown",
      });

      return reply.status(200).send(mapPatientProfile(profile));
    },
  );
}
