import type { InsulinApplicationRecord } from "@prisma/client";
import type { CreateInsulinRecordInput } from "../../domain/entities/insulin-application-record.entity.js";
import { validateInsulinRecord } from "../../domain/entities/insulin-application-record.entity.js";
import {
  upsertInsulinRecord,
  updateInsulinRecord as updateInsulinRecordRepo,
  deleteInsulinRecord as deleteInsulinRecordRepo,
  getPatientInsulinRecords,
  type InsulinRecordQuery,
  type PaginatedInsulinRecords,
  type UpdateInsulinRecordData,
} from "../../infrastructure/repositories/insulin-record.repository.js";
import { hasActiveConsent } from "../../domain/services/caregiver-access.guard.js";
import { auditCreate, auditUpdate, auditDelete } from "../audit/audit.service.js";

export interface CreateRecordContext {
  actorUserId: string;
  correlationId: string;
  ipAddress: string;
  userAgent: string;
}

export interface CreateInsulinRecordResult {
  record: InsulinApplicationRecord;
  isNew: boolean;
}

export async function createInsulinRecord(
  input: CreateInsulinRecordInput,
  ctx: CreateRecordContext,
): Promise<CreateInsulinRecordResult> {
  const consentActive = await hasActiveConsent(ctx.actorUserId, input.patientProfileId);
  if (!consentActive) {
    const err = new Error("CONSENT_REVOKED") as Error & { statusCode: number };
    err.statusCode = 403;
    throw err;
  }

  const validationError = validateInsulinRecord(input);
  if (validationError) {
    const err = new Error(validationError.message) as Error & { statusCode: number; code: string };
    err.statusCode = 422;
    err.code = validationError.code;
    throw err;
  }

  const [record, isNew] = await upsertInsulinRecord(input);

  if (isNew) {
    void auditCreate({
      actorUserId: ctx.actorUserId,
      correlationId: ctx.correlationId,
      targetTable: "insulin_application_records",
      targetId: record.id,
      diffSummary: { doseRationale: input.doseRationale, timezone: input.timezone },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  return { record, isNew };
}

export async function updateInsulinRecord(
  recordId: string,
  patientId: string,
  input: UpdateInsulinRecordData,
  ctx: CreateRecordContext,
): Promise<InsulinApplicationRecord> {
  const consentActive = await hasActiveConsent(ctx.actorUserId, patientId);
  if (!consentActive) {
    const err = new Error("CONSENT_REVOKED") as Error & { statusCode: number };
    err.statusCode = 403;
    throw err;
  }

  const record = await updateInsulinRecordRepo(recordId, patientId, input);
  if (!record) {
    const err = new Error("Record not found") as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  void auditUpdate({
    actorUserId: ctx.actorUserId,
    correlationId: ctx.correlationId,
    targetTable: "insulin_application_records",
    targetId: recordId,
    diffSummary: { fieldsUpdated: Object.keys(input) },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return record;
}

export async function deleteInsulinRecord(
  recordId: string,
  patientId: string,
  ctx: CreateRecordContext,
): Promise<void> {
  const consentActive = await hasActiveConsent(ctx.actorUserId, patientId);
  if (!consentActive) {
    const err = new Error("CONSENT_REVOKED") as Error & { statusCode: number };
    err.statusCode = 403;
    throw err;
  }

  void auditDelete({
    actorUserId: ctx.actorUserId,
    correlationId: ctx.correlationId,
    targetTable: "insulin_application_records",
    targetId: recordId,
    diffSummary: {},
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  const deleted = await deleteInsulinRecordRepo(recordId, patientId);
  if (!deleted) {
    const err = new Error("Record not found") as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }
}

export async function listInsulinRecords(
  patientId: string,
  query: InsulinRecordQuery,
): Promise<PaginatedInsulinRecords> {
  return getPatientInsulinRecords(patientId, query);
}
