import type { AuditOperation } from "@prisma/client";
import { getPrismaClient } from "../../infrastructure/database/client.js";
import { hashSensitive } from "../../infrastructure/database/encryption-middleware.js";
import { logger } from "../../infrastructure/logging/logger.js";

export interface AuditParams {
  actorUserId: string;
  correlationId: string;
  operation: AuditOperation;
  targetTable: string;
  targetId: string;
  diffSummary?: Record<string, unknown>; // field NAMES only — never PHI values
  ipAddress: string;
  userAgent: string;
}

// Append-only write — no UPDATE or DELETE methods exposed.
// If this write fails, log the failure but do NOT throw (audit must not break core flows).
export async function writeAuditEntry(params: AuditParams): Promise<void> {
  const prisma = getPrismaClient();
  try {
    await prisma.auditEntry.create({
      data: {
        actorUserId: params.actorUserId,
        correlationId: params.correlationId,
        operation: params.operation,
        targetTable: params.targetTable,
        targetId: params.targetId,
        diffSummary: params.diffSummary ?? null,
        ipAddressHash: hashSensitive(params.ipAddress),
        userAgentHash: hashSensitive(params.userAgent),
      },
    });
  } catch (err) {
    // Audit failure is critical but must not cascade to the caller
    logger.error(
      {
        err,
        correlationId: params.correlationId,
        operation: params.operation,
        targetTable: params.targetTable,
      },
      "AUDIT_WRITE_FAILED — audit entry lost",
    );
  }
}

// Convenience wrappers used by route handlers

export function auditCreate(params: Omit<AuditParams, "operation">): Promise<void> {
  return writeAuditEntry({ ...params, operation: "create" });
}

export function auditSyncCommit(params: Omit<AuditParams, "operation">): Promise<void> {
  return writeAuditEntry({ ...params, operation: "sync_commit" });
}

export function auditConsentGranted(params: Omit<AuditParams, "operation">): Promise<void> {
  return writeAuditEntry({ ...params, operation: "consent_granted" });
}

export function auditConsentRevoked(params: Omit<AuditParams, "operation">): Promise<void> {
  return writeAuditEntry({ ...params, operation: "consent_revoked" });
}

export function auditAlertGenerated(params: Omit<AuditParams, "operation">): Promise<void> {
  return writeAuditEntry({ ...params, operation: "alert_generated" });
}

export function auditDelete(params: Omit<AuditParams, "operation">): Promise<void> {
  return writeAuditEntry({ ...params, operation: "delete" });
}
