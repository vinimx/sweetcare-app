import type { SymptomRecord } from "@prisma/client";
import type { CreateSymptomRecordInput } from "../../domain/entities/symptom-record.entity.js";
import { validateSymptomRecord } from "../../domain/entities/symptom-record.entity.js";
import {
  upsertSymptomRecord,
  getPatientSymptomRecords,
  type SymptomRecordQuery,
  type PaginatedSymptomRecords,
} from "../../infrastructure/repositories/symptom-record.repository.js";
import {
  createAlertEvent,
  updateAlertNotifiedUsers,
} from "../../infrastructure/repositories/alert-event.repository.js";
import { evaluateAlertRules } from "../../domain/services/alert-rule-engine.js";
import { sendAlertNotification } from "../../infrastructure/notifications/push-notification.service.js";
import { hasActiveConsent } from "../../domain/services/caregiver-access.guard.js";
import { auditCreate, auditAlertGenerated } from "../audit/audit.service.js";
import { logger } from "../../infrastructure/logging/logger.js";
import type { CreateRecordContext } from "./insulin-record.service.js";

export interface CreateSymptomRecordResult {
  record: SymptomRecord;
  isNew: boolean;
  alertTriggered: boolean;
  alertId: string | null;
}

export async function createSymptomRecord(
  input: CreateSymptomRecordInput,
  ctx: CreateRecordContext,
): Promise<CreateSymptomRecordResult> {
  const consentActive = await hasActiveConsent(ctx.actorUserId, input.patientProfileId);
  if (!consentActive) {
    const err = new Error("CONSENT_REVOKED") as Error & { statusCode: number };
    err.statusCode = 403;
    throw err;
  }

  const validationError = validateSymptomRecord(input);
  if (validationError) {
    const err = new Error(validationError.message) as Error & { statusCode: number; code: string };
    err.statusCode = 422;
    err.code = validationError.code;
    throw err;
  }

  const [record, isNew] = await upsertSymptomRecord(input);

  if (isNew) {
    void auditCreate({
      actorUserId: ctx.actorUserId,
      correlationId: ctx.correlationId,
      targetTable: "symptom_records",
      targetId: record.id,
      diffSummary: { severityLevel: input.severityLevel, symptomCount: input.symptomCodes.length },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  if (!isNew) {
    return { record, isNew, alertTriggered: false, alertId: null };
  }

  const ruleResult = evaluateAlertRules(input.symptomCodes, input.severityLevel);
  if (!ruleResult) {
    return { record, isNew, alertTriggered: false, alertId: null };
  }

  try {
    const alert = await createAlertEvent({
      patientProfileId: input.patientProfileId,
      triggerSymptomRecordId: record.id,
      alertType: ruleResult.alertType,
      severityLevel: ruleResult.severityLevel,
      guidanceKey: ruleResult.guidanceKey,
    });

    void auditAlertGenerated({
      actorUserId: ctx.actorUserId,
      correlationId: ctx.correlationId,
      targetTable: "alert_events",
      targetId: alert.id,
      diffSummary: { alertType: ruleResult.alertType, triggerRecord: record.id },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    // Dispatch push notification (PHI-free payload) — failure is non-fatal
    void sendAlertNotification(input.patientProfileId, {
      notificationType: "alert",
      alertId: alert.id,
      alertType: ruleResult.alertType,
      severityLevel: ruleResult.severityLevel,
      patientProfileId: input.patientProfileId,
    }).then((notifiedIds) => {
      if (notifiedIds.length > 0) {
        void updateAlertNotifiedUsers(alert.id, notifiedIds);
      }
    });

    return { record, isNew, alertTriggered: true, alertId: alert.id };
  } catch (err) {
    // Alert creation failure MUST NOT roll back the symptom record (fail-safe per contracts/api-alerts.md)
    logger.error(
      { err, correlationId: ctx.correlationId, symptomRecordId: record.id },
      "Alert generation failed — symptom record committed; background retry required",
    );
    return { record, isNew, alertTriggered: false, alertId: null };
  }
}

export async function listSymptomRecords(
  patientId: string,
  query: SymptomRecordQuery,
): Promise<PaginatedSymptomRecords> {
  return getPatientSymptomRecords(patientId, query);
}
