import { getPrismaClient } from "../../infrastructure/database/client.js";

export interface CaregiverAccess {
  assignmentId: string;
  assignmentRole: string;
}

export async function checkPatientAccess(
  userId: string,
  patientId: string,
): Promise<CaregiverAccess | null> {
  const prisma = getPrismaClient();
  const assignment = await prisma.caregiverAssignment.findFirst({
    where: { patientProfileId: patientId, userId, revokedAt: null },
    select: { id: true, assignmentRole: true },
  });
  if (!assignment) return null;
  return { assignmentId: assignment.id, assignmentRole: assignment.assignmentRole };
}

export async function hasActiveConsent(
  guardianUserId: string,
  patientProfileId: string,
  consentType: "data_processing" | "ai_analysis" | "data_sharing" = "data_processing",
): Promise<boolean> {
  const prisma = getPrismaClient();
  const consent = await prisma.consentRecord.findFirst({
    where: { guardianUserId, patientProfileId, consentType, revokedAt: null },
    select: { id: true },
  });
  return consent !== null;
}

export function isReadOnly(role: string): boolean {
  return role === "read_only";
}
