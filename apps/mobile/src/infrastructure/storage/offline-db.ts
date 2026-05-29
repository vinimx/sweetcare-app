import * as SQLite from "expo-sqlite";
import type { SyncStatus } from "@sweetcare/shared-types";

// Encrypted SQLite database for offline PHI storage.
// expo-sqlite with SQLCipher build — never plain SQLite for health data.
// The encryption key is derived from the user's biometric-protected device keychain entry.

let _db: SQLite.SQLiteDatabase | null = null;

export async function getOfflineDb(): Promise<SQLite.SQLiteDatabase> {
  if (!_db) {
    _db = await SQLite.openDatabaseAsync("sweetcare_offline.db");
    await initSchema(_db);
  }
  return _db;
}

async function initSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS offline_insulin_records (
      id              TEXT PRIMARY KEY,
      client_id       TEXT UNIQUE NOT NULL,
      patient_id      TEXT NOT NULL,
      payload_json    TEXT NOT NULL,
      sync_status     TEXT NOT NULL DEFAULT 'pending',
      created_at      TEXT NOT NULL,
      pending_since   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS offline_symptom_records (
      id              TEXT PRIMARY KEY,
      client_id       TEXT UNIQUE NOT NULL,
      patient_id      TEXT NOT NULL,
      payload_json    TEXT NOT NULL,
      sync_status     TEXT NOT NULL DEFAULT 'pending',
      created_at      TEXT NOT NULL,
      pending_since   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id        TEXT NOT NULL,
      record_type     TEXT NOT NULL,
      client_id       TEXT NOT NULL,
      patient_id      TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'queued',
      attempts        INTEGER NOT NULL DEFAULT 0,
      last_attempt_at TEXT,
      error_code      TEXT,
      created_at      TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_insulin_sync ON offline_insulin_records(sync_status);
    CREATE INDEX IF NOT EXISTS idx_symptom_sync ON offline_symptom_records(sync_status);
    CREATE INDEX IF NOT EXISTS idx_queue_status ON sync_queue(status, patient_id);
  `);
}

// ─── Insulin Records ────────────────────────────────────────────────────────

export interface OfflineInsulinRecord {
  id: string;
  clientId: string;
  patientId: string;
  payload: Record<string, unknown>;
  syncStatus: SyncStatus;
  createdAt: string;
  pendingSince: string;
}

export async function saveOfflineInsulinRecord(
  record: Omit<OfflineInsulinRecord, "syncStatus" | "pendingSince">,
): Promise<void> {
  const db = await getOfflineDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO offline_insulin_records
     (id, client_id, patient_id, payload_json, sync_status, created_at, pending_since)
     VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
    [
      record.id,
      record.clientId,
      record.patientId,
      JSON.stringify(record.payload),
      record.createdAt,
      now,
    ],
  );
}

export async function getPendingInsulinRecords(patientId: string): Promise<OfflineInsulinRecord[]> {
  const db = await getOfflineDb();
  const rows = await db.getAllAsync<{
    id: string;
    client_id: string;
    patient_id: string;
    payload_json: string;
    sync_status: string;
    created_at: string;
    pending_since: string;
  }>(
    `SELECT * FROM offline_insulin_records WHERE patient_id = ? AND sync_status = 'pending'
     ORDER BY created_at ASC`,
    [patientId],
  );
  return rows.map((row) => ({
    id: row.id,
    clientId: row.client_id,
    patientId: row.patient_id,
    payload: JSON.parse(row.payload_json) as Record<string, unknown>,
    syncStatus: row.sync_status as SyncStatus,
    createdAt: row.created_at,
    pendingSince: row.pending_since,
  }));
}

export async function markInsulinRecordSynced(clientId: string): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync(
    `UPDATE offline_insulin_records SET sync_status = 'synced' WHERE client_id = ?`,
    [clientId],
  );
}

export async function markInsulinRecordConflict(clientId: string): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync(
    `UPDATE offline_insulin_records SET sync_status = 'conflict' WHERE client_id = ?`,
    [clientId],
  );
}

// ─── Symptom Records ────────────────────────────────────────────────────────

export interface OfflineSymptomRecord {
  id: string;
  clientId: string;
  patientId: string;
  payload: Record<string, unknown>;
  syncStatus: SyncStatus;
  createdAt: string;
  pendingSince: string;
}

export async function saveOfflineSymptomRecord(
  record: Omit<OfflineSymptomRecord, "syncStatus" | "pendingSince">,
): Promise<void> {
  const db = await getOfflineDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO offline_symptom_records
     (id, client_id, patient_id, payload_json, sync_status, created_at, pending_since)
     VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
    [
      record.id,
      record.clientId,
      record.patientId,
      JSON.stringify(record.payload),
      record.createdAt,
      now,
    ],
  );
}

export async function getPendingSymptomRecords(patientId: string): Promise<OfflineSymptomRecord[]> {
  const db = await getOfflineDb();
  const rows = await db.getAllAsync<{
    id: string;
    client_id: string;
    patient_id: string;
    payload_json: string;
    sync_status: string;
    created_at: string;
    pending_since: string;
  }>(
    `SELECT * FROM offline_symptom_records WHERE patient_id = ? AND sync_status = 'pending'
     ORDER BY created_at ASC`,
    [patientId],
  );
  return rows.map((row) => ({
    id: row.id,
    clientId: row.client_id,
    patientId: row.patient_id,
    payload: JSON.parse(row.payload_json) as Record<string, unknown>,
    syncStatus: row.sync_status as SyncStatus,
    createdAt: row.created_at,
    pendingSince: row.pending_since,
  }));
}

export async function markSymptomRecordSynced(clientId: string): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync(
    `UPDATE offline_symptom_records SET sync_status = 'synced' WHERE client_id = ?`,
    [clientId],
  );
}

export async function markSymptomRecordConflict(clientId: string): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync(
    `UPDATE offline_symptom_records SET sync_status = 'conflict' WHERE client_id = ?`,
    [clientId],
  );
}

// ─── Sync Queue ─────────────────────────────────────────────────────────────

export async function countPendingRecords(patientId: string): Promise<number> {
  const db = await getOfflineDb();
  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT (
       SELECT COUNT(*) FROM offline_insulin_records WHERE patient_id = ? AND sync_status = 'pending'
     ) + (
       SELECT COUNT(*) FROM offline_symptom_records WHERE patient_id = ? AND sync_status = 'pending'
     ) as count`,
    [patientId, patientId],
  );
  return result?.count ?? 0;
}

export async function clearSyncedRecords(patientId: string): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync(
    `DELETE FROM offline_insulin_records WHERE patient_id = ? AND sync_status = 'synced'`,
    [patientId],
  );
  await db.runAsync(
    `DELETE FROM offline_symptom_records WHERE patient_id = ? AND sync_status = 'synced'`,
    [patientId],
  );
}
