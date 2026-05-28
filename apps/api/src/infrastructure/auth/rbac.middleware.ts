import type { FastifyRequest, FastifyReply } from "fastify";
import type { UserRole } from "@prisma/client";
import { getPrismaClient } from "../database/client.js";

// Verifies that the authenticated user has an active CaregiverAssignment
// for the given patientProfileId. Used on all patient-specific routes.
export async function requirePatientAccess(
  request: FastifyRequest<{ Params: { patientId: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const userId = request.jwtUser.sub;
  const { patientId } = request.params;

  if (!patientId) {
    return reply.status(400).send({
      error: "MISSING_PATIENT_ID",
      message: "patientId path parameter is required",
      correlationId: request.id,
    });
  }

  const prisma = getPrismaClient();
  const assignment = await prisma.caregiverAssignment.findFirst({
    where: {
      patientProfileId: patientId,
      userId,
      revokedAt: null,
    },
    select: { id: true, assignmentRole: true },
  });

  if (!assignment) {
    return reply.status(403).send({
      error: "PATIENT_ACCESS_DENIED",
      message: "No active caregiver assignment for this patient",
      correlationId: request.id,
    });
  }

  // Attach for downstream use without extra DB round-trip
  (request as FastifyRequest & { patientAccess: { assignmentRole: string } }).patientAccess = {
    assignmentRole: assignment.assignmentRole,
  };
}

// Guard for write operations: read_only role must not write records
export async function requireWriteAccess(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const access = (request as FastifyRequest & { patientAccess?: { assignmentRole: string } })
    .patientAccess;
  if (access?.assignmentRole === "read_only") {
    return reply.status(403).send({
      error: "READ_ONLY_ASSIGNMENT",
      message: "Your caregiver role is read-only for this patient",
      correlationId: request.id,
    });
  }
}

// Verifies that the calling user has an active data_processing consent record
// linked to the given patientProfileId (LGPD Art. 14 gate).
export async function requireActiveConsent(
  patientProfileId: string,
  guardianUserId: string,
): Promise<boolean> {
  const prisma = getPrismaClient();
  const consent = await prisma.consentRecord.findFirst({
    where: {
      patientProfileId,
      guardianUserId,
      consentType: "data_processing",
      revokedAt: null,
    },
    select: { id: true },
  });
  return consent !== null;
}

export function isAdminRole(role: UserRole): boolean {
  return role === "admin";
}
