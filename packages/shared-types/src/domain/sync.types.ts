import type { SyncStatus } from "./medical-records.types.js";

export type ConflictType =
  | "overlapping_insulin_window"
  | "concurrent_edit"
  | "patient_access_revoked"
  | "consent_revoked";

export type SyncRecordType = "insulin_application" | "symptom";

export type SyncEventStatus = "initiated" | "completed" | "partial_failure" | "failed";

export interface SyncConflict {
  clientId: string;
  conflictType: ConflictType;
  details: string;
  requiresManualResolution: boolean;
}

export interface SyncBatchResult {
  batchId: string;
  committed: number;
  skipped: number;
  conflicts: SyncConflict[];
  syncEventId: string;
}

export interface OfflineRecord {
  clientId: string;
  recordType: SyncRecordType;
  patientProfileId: string;
  syncStatus: SyncStatus;
  createdAt: string;
  pendingSince: string;
  payload: Record<string, unknown>;
}
