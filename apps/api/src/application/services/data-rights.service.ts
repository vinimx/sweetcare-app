import { getPrismaClient } from "../../infrastructure/database/client.js";
import { verifyPassword } from "../../infrastructure/auth/password.service.js";
import { revokeAllUserSessions } from "../../infrastructure/auth/session.repository.js";
import { auditCreate, auditDelete } from "../audit/audit.service.js";

export interface AuditContext {
  correlationId: string;
  ipAddress: string;
  userAgent: string;
}

// ── Export types ─────────────────────────────────────────────────────────────

interface InsulinRecordExport {
  record_id: string;
  client_id: string;
  insulin_type: string | null;
  dose_units: string;
  dose_rationale: string;
  meal_carbs_grams: number | null;
  glucose_before_mgdl: number | null;
  administration_site: string | null;
  notes: string | null;
  applied_at: string;
  timezone: string;
  recorded_at: string;
}

interface SymptomRecordExport {
  record_id: string;
  client_id: string;
  symptom_codes: string[];
  severity_level: string;
  glucose_reading_mgdl: number | null;
  notes: string | null;
  observed_at: string;
  timezone: string;
  recorded_at: string;
}

interface AlertExport {
  alert_id: string;
  alert_type: string;
  severity_level: string;
  guidance_key: string;
  created_at: string;
  resolved_at: string | null;
}

interface InsightReportExport {
  report_id: string;
  report_type: string;
  status: string;
  period_start: string;
  period_end: string;
  generated_at: string;
  summary_text: string | null;
}

interface PatientExport {
  patient_id: string;
  full_name: string | null;
  date_of_birth: string;
  diagnosis_year: number;
  target_glucose_min_mgdl: number;
  target_glucose_max_mgdl: number;
  insulin_type_basal: string | null;
  insulin_type_bolus: string | null;
  created_at: string;
  insulin_records: InsulinRecordExport[];
  symptom_records: SymptomRecordExport[];
  alerts: AlertExport[];
  insight_reports: InsightReportExport[];
}

interface ConsentExport {
  consent_id: string;
  consent_type: string;
  patient_profile_id: string;
  granted_at: string;
  revoked_at: string | null;
  consent_text_version: string;
}

interface AssignmentExport {
  assignment_id: string;
  patient_profile_id: string;
  assignment_role: string;
  granted_at: string;
  revoked_at: string | null;
}

export interface UserDataExport {
  export_generated_at: string;
  user: {
    user_id: string;
    email: string;
    display_name: string | null;
    phone_e164: string | null;
    role: string;
    created_at: string;
  };
  consent_records: ConsentExport[];
  caregiver_assignments: AssignmentExport[];
  patients: PatientExport[];
}

// ── exportUserData ────────────────────────────────────────────────────────────

export async function exportUserData(userId: string, ctx: AuditContext): Promise<UserDataExport> {
  const prisma = getPrismaClient();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      phoneE164: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) {
    const err = new Error("USER_NOT_FOUND") as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  const [patients, consentRecords, assignments] = await Promise.all([
    prisma.patientProfile.findMany({
      where: { createdByUserId: userId },
      include: {
        insulinRecords: { orderBy: { appliedAt: "desc" } },
        symptomRecords: { orderBy: { observedAt: "desc" } },
        alertEvents: { orderBy: { createdAt: "desc" } },
        insightReports: {
          where: { isInvalidated: false, status: "completed" },
          orderBy: { generatedAt: "desc" },
        },
      },
    }),
    prisma.consentRecord.findMany({
      where: { guardianUserId: userId },
      orderBy: { grantedAt: "desc" },
    }),
    prisma.caregiverAssignment.findMany({
      where: { userId },
      orderBy: { grantedAt: "desc" },
    }),
  ]);

  void auditCreate({
    actorUserId: userId,
    correlationId: ctx.correlationId,
    targetTable: "users",
    targetId: userId,
    diffSummary: { action: "data_export" },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return {
    export_generated_at: new Date().toISOString(),
    user: {
      user_id: user.id,
      email: user.email,
      display_name: (user.displayName as string | null) ?? null,
      phone_e164: (user.phoneE164 as string | null) ?? null,
      role: user.role,
      created_at: user.createdAt.toISOString(),
    },
    consent_records: consentRecords.map((c) => ({
      consent_id: c.id,
      consent_type: c.consentType,
      patient_profile_id: c.patientProfileId,
      granted_at: c.grantedAt.toISOString(),
      revoked_at: c.revokedAt?.toISOString() ?? null,
      consent_text_version: c.consentTextVersion,
    })),
    caregiver_assignments: assignments.map((a) => ({
      assignment_id: a.id,
      patient_profile_id: a.patientProfileId,
      assignment_role: a.assignmentRole,
      granted_at: a.grantedAt.toISOString(),
      revoked_at: a.revokedAt?.toISOString() ?? null,
    })),
    patients: patients.map((p) => ({
      patient_id: p.id,
      full_name: (p.fullName as string | null) ?? null,
      date_of_birth: p.dateOfBirth.toISOString().split("T")[0] ?? "",
      diagnosis_year: p.diagnosisYear,
      target_glucose_min_mgdl: p.targetGlucoseMinMgdl,
      target_glucose_max_mgdl: p.targetGlucoseMaxMgdl,
      insulin_type_basal: (p.insulinTypeBasal as string | null) ?? null,
      insulin_type_bolus: (p.insulinTypeBolus as string | null) ?? null,
      created_at: p.createdAt.toISOString(),
      insulin_records: p.insulinRecords.map((r) => ({
        record_id: r.id,
        client_id: r.clientId,
        insulin_type: (r.insulinType as string | null) ?? null,
        dose_units: r.doseUnits.toString(),
        dose_rationale: r.doseRationale,
        meal_carbs_grams: r.mealCarbsGrams,
        glucose_before_mgdl: r.glucoseBeforeMgdl !== null ? Number(r.glucoseBeforeMgdl) : null,
        administration_site: r.administrationSite,
        notes: (r.notes as string | null) ?? null,
        applied_at: r.appliedAt.toISOString(),
        timezone: r.timezone,
        recorded_at: r.recordedAt.toISOString(),
      })),
      symptom_records: p.symptomRecords.map((r) => ({
        record_id: r.id,
        client_id: r.clientId,
        symptom_codes: r.symptomCodes as string[],
        severity_level: r.severityLevel,
        glucose_reading_mgdl: r.glucoseReadingMgdl !== null ? Number(r.glucoseReadingMgdl) : null,
        notes: (r.notes as string | null) ?? null,
        observed_at: r.observedAt.toISOString(),
        timezone: r.timezone,
        recorded_at: r.recordedAt.toISOString(),
      })),
      alerts: p.alertEvents.map((a) => ({
        alert_id: a.id,
        alert_type: a.alertType,
        severity_level: a.severityLevel,
        guidance_key: a.guidanceKey,
        created_at: a.createdAt.toISOString(),
        resolved_at: a.resolvedAt?.toISOString() ?? null,
      })),
      insight_reports: p.insightReports.map((r) => ({
        report_id: r.id,
        report_type: r.reportType,
        status: r.status,
        period_start: r.periodStart.toISOString().split("T")[0] ?? "",
        period_end: r.periodEnd.toISOString().split("T")[0] ?? "",
        generated_at: r.generatedAt.toISOString(),
        summary_text: (r.summaryText as string | null) ?? null,
      })),
    })),
  };
}

// ── deleteUserAccount ─────────────────────────────────────────────────────────

export async function deleteUserAccount(
  userId: string,
  password: string,
  ctx: AuditContext,
): Promise<void> {
  const prisma = getPrismaClient();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true, isActive: true },
  });

  if (!user || !user.isActive) {
    const err = new Error("USER_NOT_FOUND") as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  const passwordValid = await verifyPassword(user.passwordHash, password);
  if (!passwordValid) {
    const err = new Error("INVALID_PASSWORD") as Error & { statusCode: number };
    err.statusCode = 403;
    throw err;
  }

  const patientIds = (
    await prisma.patientProfile.findMany({
      where: { createdByUserId: userId },
      select: { id: true },
    })
  ).map((p) => p.id);

  await prisma.$transaction(async (tx) => {
    if (patientIds.length > 0) {
      await tx.insightReport.deleteMany({
        where: { patientProfileId: { in: patientIds } },
      });
      await tx.syncEvent.deleteMany({
        where: { patientProfileId: { in: patientIds } },
      });
      await tx.alertEvent.deleteMany({
        where: { patientProfileId: { in: patientIds } },
      });
      await tx.symptomRecord.deleteMany({
        where: { patientProfileId: { in: patientIds } },
      });
      await tx.insulinApplicationRecord.deleteMany({
        where: { patientProfileId: { in: patientIds } },
      });
    }

    // Delete insight reports and sync events the user requested outside their own patients
    await tx.insightReport.deleteMany({ where: { requestedByUserId: userId } });
    await tx.syncEvent.deleteMany({ where: { initiatedByUserId: userId } });

    await tx.caregiverAssignment.deleteMany({
      where: {
        OR: [
          { userId },
          { grantedByUserId: userId },
          ...(patientIds.length > 0 ? [{ patientProfileId: { in: patientIds } }] : []),
        ],
      },
    });

    await tx.consentRecord.deleteMany({
      where: {
        OR: [
          { guardianUserId: userId },
          ...(patientIds.length > 0 ? [{ patientProfileId: { in: patientIds } }] : []),
        ],
      },
    });

    if (patientIds.length > 0) {
      await tx.patientProfile.deleteMany({
        where: { createdByUserId: userId },
      });
    }

    await revokeAllUserSessions(userId, "account_deletion");

    // Anonymize instead of hard-deleting to preserve FK integrity for AuditEntry records.
    await tx.user.update({
      where: { id: userId },
      data: {
        email: `deleted+${userId}@sweetcare.invalid`,
        passwordHash: "",
        displayName: "",
        phoneE164: null,
        mfaSecretEnc: null,
        isActive: false,
      },
    });
  });

  void auditDelete({
    actorUserId: userId,
    correlationId: ctx.correlationId,
    targetTable: "users",
    targetId: userId,
    diffSummary: {
      action: "account_deletion",
      patientsDeleted: patientIds.length,
    },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
}
