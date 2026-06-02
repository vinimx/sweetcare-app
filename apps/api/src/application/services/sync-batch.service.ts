import { SYNC_CONFLICT_WINDOW_MINUTES } from "@sweetcare/shared-config";
import type { SyncBatchInput, ResolveConflictInput } from "@sweetcare/shared-validation";
import { Prisma } from "@prisma/client";
import { getPrismaClient } from "../../infrastructure/database/client.js";
import { validateInsulinRecord } from "../../domain/entities/insulin-application-record.entity.js";
import { validateSymptomRecord } from "../../domain/entities/symptom-record.entity.js";
import {
  checkPatientAccess,
  hasActiveConsent,
} from "../../domain/services/caregiver-access.guard.js";
import {
  upsertInsulinRecord,
  findBolusRecordsInWindow,
} from "../../infrastructure/repositories/insulin-record.repository.js";
import { upsertSymptomRecord } from "../../infrastructure/repositories/symptom-record.repository.js";
import { auditSyncCommit, auditCreate } from "../audit/audit.service.js";

export interface SyncConflict {
  client_id: string;
  conflict_type:
    | "overlapping_insulin_window"
    | "concurrent_edit"
    | "patient_access_revoked"
    | "consent_revoked";
  details: string;
  requires_manual_resolution: boolean;
}

export interface SyncBatchResult {
  batch_id: string;
  committed: number;
  skipped: number;
  conflicts: SyncConflict[];
  sync_event_id: string;
}

export interface SyncContext {
  actorUserId: string;
  correlationId: string;
  ipAddress: string;
  userAgent: string;
}

const WINDOW_MS = SYNC_CONFLICT_WINDOW_MINUTES * 60 * 1000;

export async function processSyncBatch(
  input: SyncBatchInput,
  ctx: SyncContext,
): Promise<SyncBatchResult> {
  const prisma = getPrismaClient();
  const { batch_id, patient_profile_id, records } = input;

  // Verify access
  const access = await checkPatientAccess(ctx.actorUserId, patient_profile_id);
  if (!access) {
    const err = new Error("PATIENT_ACCESS_DENIED") as Error & { statusCode: number };
    err.statusCode = 403;
    throw err;
  }

  const consentActive = await hasActiveConsent(ctx.actorUserId, patient_profile_id);

  // Create SyncEvent
  const syncEvent = await prisma.syncEvent.create({
    data: {
      patientProfileId: patient_profile_id,
      initiatedByUserId: ctx.actorUserId,
      syncType: "full",
      recordsSubmitted: records.length,
      recordsCommitted: 0,
      recordsConflicted: 0,
      status: "initiated",
    },
    select: { id: true },
  });

  let committed = 0;
  let skipped = 0;
  const conflicts: SyncConflict[] = [];

  // Track bolus timestamps committed in this batch to detect intra-batch overlaps
  const batchBolusTimestamps: Date[] = [];

  for (const record of records) {
    if (!consentActive) {
      conflicts.push({
        client_id: record.client_id,
        conflict_type: "consent_revoked",
        details: "Patient data processing consent has been revoked",
        requires_manual_resolution: false,
      });
      continue;
    }

    if (record.record_type === "insulin_application") {
      const p = record.payload;
      const appliedAt = new Date(p.applied_at);
      const isBolus = ["correction", "meal_coverage", "combination"].includes(p.dose_rationale);

      // Overlapping window check for bolus types
      if (isBolus) {
        const windowStart = new Date(appliedAt.getTime() - WINDOW_MS);
        const windowEnd = new Date(appliedAt.getTime() + WINDOW_MS);

        const serverOverlap = await findBolusRecordsInWindow(
          patient_profile_id,
          windowStart,
          windowEnd,
        );
        const batchOverlap = batchBolusTimestamps.some(
          (t) => Math.abs(t.getTime() - appliedAt.getTime()) <= WINDOW_MS,
        );

        if (serverOverlap.length > 0 || batchOverlap) {
          conflicts.push({
            client_id: record.client_id,
            conflict_type: "overlapping_insulin_window",
            details: `A bolus dose was recorded within ${String(SYNC_CONFLICT_WINDOW_MINUTES)} minutes of this record`,
            requires_manual_resolution: true,
          });
          continue;
        }
      }

      const validationErr = validateInsulinRecord({
        clientId: record.client_id,
        patientProfileId: patient_profile_id,
        recordedByUserId: ctx.actorUserId,
        insulinType: p.insulin_type,
        doseUnits: p.dose_units,
        doseRationale: p.dose_rationale,
        ...(p.meal_carbs_grams !== undefined && { mealCarbsGrams: p.meal_carbs_grams }),
        ...(p.glucose_before_mgdl !== undefined && { glucoseBeforeMgdl: p.glucose_before_mgdl }),
        ...(p.administration_site !== undefined && { administrationSite: p.administration_site }),
        ...(p.notes !== undefined && { notes: p.notes }),
        appliedAt,
        timezone: p.timezone,
      });

      if (validationErr) {
        conflicts.push({
          client_id: record.client_id,
          conflict_type: "concurrent_edit",
          details: validationErr.message,
          requires_manual_resolution: false,
        });
        continue;
      }

      const [created, isNew] = await upsertInsulinRecord({
        clientId: record.client_id,
        patientProfileId: patient_profile_id,
        recordedByUserId: ctx.actorUserId,
        insulinType: p.insulin_type,
        doseUnits: p.dose_units,
        doseRationale: p.dose_rationale,
        ...(p.meal_carbs_grams !== undefined && { mealCarbsGrams: p.meal_carbs_grams }),
        ...(p.glucose_before_mgdl !== undefined && { glucoseBeforeMgdl: p.glucose_before_mgdl }),
        ...(p.administration_site !== undefined && { administrationSite: p.administration_site }),
        ...(p.notes !== undefined && { notes: p.notes }),
        appliedAt,
        timezone: p.timezone,
      });

      if (isNew) {
        committed++;
        if (isBolus) batchBolusTimestamps.push(appliedAt);
        void auditCreate({
          actorUserId: ctx.actorUserId,
          correlationId: ctx.correlationId,
          targetTable: "insulin_application_records",
          targetId: created.id,
          diffSummary: { source: "sync_batch", syncEventId: syncEvent.id },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        });
      } else {
        skipped++;
      }
    } else {
      // symptom record
      const p = record.payload;
      const observedAt = new Date(p.observed_at);

      const validationErr = validateSymptomRecord({
        clientId: record.client_id,
        patientProfileId: patient_profile_id,
        recordedByUserId: ctx.actorUserId,
        symptomCodes: p.symptom_codes,
        severityLevel: p.severity_level,
        ...(p.glucose_reading_mgdl !== undefined && { glucoseReadingMgdl: p.glucose_reading_mgdl }),
        ...(p.notes !== undefined && { notes: p.notes }),
        observedAt,
        timezone: p.timezone,
      });

      if (validationErr) {
        conflicts.push({
          client_id: record.client_id,
          conflict_type: "concurrent_edit",
          details: validationErr.message,
          requires_manual_resolution: false,
        });
        continue;
      }

      const [created, isNew] = await upsertSymptomRecord({
        clientId: record.client_id,
        patientProfileId: patient_profile_id,
        recordedByUserId: ctx.actorUserId,
        symptomCodes: p.symptom_codes,
        severityLevel: p.severity_level,
        ...(p.glucose_reading_mgdl !== undefined && { glucoseReadingMgdl: p.glucose_reading_mgdl }),
        ...(p.notes !== undefined && { notes: p.notes }),
        observedAt,
        timezone: p.timezone,
      });

      if (isNew) {
        committed++;
        void auditCreate({
          actorUserId: ctx.actorUserId,
          correlationId: ctx.correlationId,
          targetTable: "symptom_records",
          targetId: created.id,
          diffSummary: { source: "sync_batch", syncEventId: syncEvent.id },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        });
      } else {
        skipped++;
      }
    }
  }

  const finalStatus =
    conflicts.length > 0 && committed + skipped === 0
      ? "failed"
      : conflicts.length > 0
        ? "partial_failure"
        : "completed";

  // Store conflict metadata (no PHI values) for later resolution lookup
  const conflictDetails =
    conflicts.length > 0
      ? conflicts.map((c) => ({ ...c, resolved: false, resolution: null }))
      : null;

  await prisma.syncEvent.update({
    where: { id: syncEvent.id },
    data: {
      recordsCommitted: committed,
      recordsConflicted: conflicts.length,
      conflictDetails: conflictDetails ?? Prisma.JsonNull,
      status: finalStatus,
      completedAt: new Date(),
    },
  });

  void auditSyncCommit({
    actorUserId: ctx.actorUserId,
    correlationId: ctx.correlationId,
    targetTable: "sync_events",
    targetId: syncEvent.id,
    diffSummary: { committed, skipped, conflicts: conflicts.length },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return { batch_id, committed, skipped, conflicts, sync_event_id: syncEvent.id };
}

// ─── Sync status ─────────────────────────────────────────────────────────────

export interface ConflictSummary {
  sync_event_id: string;
  conflict_count: number;
  oldest_conflict_at: string;
}

export interface SyncStatusResult {
  patient_profile_id: string;
  last_sync_at: string | null;
  pending_conflicts: ConflictSummary[];
  total_pending_local: number | null;
}

export async function getSyncStatus(
  patientId: string,
  actorUserId: string,
): Promise<SyncStatusResult> {
  const access = await checkPatientAccess(actorUserId, patientId);
  if (!access) {
    const err = new Error("PATIENT_ACCESS_DENIED") as Error & { statusCode: number };
    err.statusCode = 403;
    throw err;
  }

  const prisma = getPrismaClient();
  const recentEvents = await prisma.syncEvent.findMany({
    where: { patientProfileId: patientId, status: { in: ["completed", "partial_failure"] } },
    orderBy: { startedAt: "desc" },
    take: 20,
    select: {
      id: true,
      status: true,
      startedAt: true,
      recordsConflicted: true,
      conflictDetails: true,
    },
  });

  type SyncEventRow = (typeof recentEvents)[number];

  const lastCompleted = recentEvents.find(
    (e: SyncEventRow) => e.status === "completed" || e.status === "partial_failure",
  );

  const pendingConflicts: ConflictSummary[] = recentEvents
    .filter((e: SyncEventRow) => e.recordsConflicted > 0 && e.conflictDetails != null)
    .map((e: SyncEventRow) => ({
      sync_event_id: e.id,
      conflict_count: e.recordsConflicted,
      oldest_conflict_at: e.startedAt.toISOString(),
    }));

  return {
    patient_profile_id: patientId,
    last_sync_at: lastCompleted?.startedAt.toISOString() ?? null,
    pending_conflicts: pendingConflicts,
    total_pending_local: null, // client-reported; server has no visibility
  };
}

// ─── Resolve conflict ────────────────────────────────────────────────────────

export interface ResolveConflictResult {
  client_id: string;
  resolution: string;
  resolved_at: string;
  audit_entry_id: string;
}

export async function resolveConflict(
  input: ResolveConflictInput,
  ctx: SyncContext,
): Promise<ResolveConflictResult> {
  const prisma = getPrismaClient();

  // Find SyncEvent containing this client_id in conflict_details
  const events = await prisma.$queryRaw<Array<{ id: string; patient_profile_id: string }>>`
    SELECT id, patient_profile_id
    FROM sync_events
    WHERE conflict_details IS NOT NULL
      AND conflict_details @> ${JSON.stringify([{ client_id: input.client_id }])}::jsonb
    ORDER BY started_at DESC
    LIMIT 1
  `;

  const event = events[0];
  if (!event) {
    const err = new Error("CONFLICT_NOT_FOUND") as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  // Verify the requesting user has access to this patient
  const access = await checkPatientAccess(ctx.actorUserId, event.patient_profile_id);
  if (!access) {
    const err = new Error("FORBIDDEN") as Error & { statusCode: number };
    err.statusCode = 403;
    throw err;
  }

  const resolvedAt = new Date();

  // Update conflictDetails to mark this client_id as resolved
  await prisma.$executeRaw`
    UPDATE sync_events
    SET conflict_details = (
      SELECT jsonb_agg(
        CASE
          WHEN elem->>'client_id' = ${input.client_id}
          THEN elem || jsonb_build_object('resolved', true, 'resolution', ${input.resolution}, 'resolved_at', ${resolvedAt.toISOString()})
          ELSE elem
        END
      )
      FROM jsonb_array_elements(conflict_details) AS elem
    )
    WHERE id = ${event.id}
  `;

  const auditEntry = await prisma.auditEntry.create({
    data: {
      actorUserId: ctx.actorUserId,
      correlationId: ctx.correlationId,
      operation: "update",
      targetTable: "sync_events",
      targetId: event.id,
      diffSummary: { resolution: input.resolution, client_id: input.client_id },
      ipAddressHash: (
        await import("../../infrastructure/database/encryption-middleware.js")
      ).hashSensitive(ctx.ipAddress),
      userAgentHash: (
        await import("../../infrastructure/database/encryption-middleware.js")
      ).hashSensitive(ctx.userAgent),
    },
    select: { id: true },
  });

  return {
    client_id: input.client_id,
    resolution: input.resolution,
    resolved_at: resolvedAt.toISOString(),
    audit_entry_id: auditEntry.id,
  };
}
