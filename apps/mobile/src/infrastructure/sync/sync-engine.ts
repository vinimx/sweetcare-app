import { useEffect, useRef, useCallback } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { tokenStorage } from "../storage/secure-storage.js";
import {
  getPendingInsulinRecords,
  getPendingSymptomRecords,
  markInsulinRecordSynced,
  markInsulinRecordConflict,
  markSymptomRecordSynced,
  markSymptomRecordConflict,
} from "../storage/offline-db.js";

const API_BASE = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3000/api/v1";
const BATCH_SIZE = 100;

export type SyncState = "idle" | "syncing" | "error";

export interface SyncResult {
  committed: number;
  skipped: number;
  conflicts: number;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await tokenStorage.getAccessToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function runSync(patientId: string): Promise<SyncResult> {
  const [insulinPending, symptomPending] = await Promise.all([
    getPendingInsulinRecords(patientId),
    getPendingSymptomRecords(patientId),
  ]);

  if (insulinPending.length === 0 && symptomPending.length === 0) {
    return { committed: 0, skipped: 0, conflicts: 0 };
  }

  const batchId = crypto.randomUUID();
  const records = [
    ...insulinPending.slice(0, BATCH_SIZE).map((r) => ({
      record_type: "insulin_application" as const,
      client_id: r.clientId,
      payload: r.payload,
    })),
    ...symptomPending.slice(0, BATCH_SIZE).map((r) => ({
      record_type: "symptom" as const,
      client_id: r.clientId,
      payload: r.payload,
    })),
  ].slice(0, BATCH_SIZE);

  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/sync/batch`, {
    method: "POST",
    headers,
    body: JSON.stringify({ batch_id: batchId, patient_profile_id: patientId, records }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({ message: `HTTP ${String(res.status)}` }))) as {
      message: string;
    };
    throw new Error(err.message);
  }

  const result = (await res.json()) as {
    committed: number;
    skipped: number;
    conflicts: Array<{ client_id: string; conflict_type: string }>;
  };

  const conflictIds = new Set(result.conflicts.map((c) => c.client_id));

  await Promise.all([
    ...insulinPending.map((r) =>
      conflictIds.has(r.clientId)
        ? markInsulinRecordConflict(r.clientId)
        : markInsulinRecordSynced(r.clientId),
    ),
    ...symptomPending.map((r) =>
      conflictIds.has(r.clientId)
        ? markSymptomRecordConflict(r.clientId)
        : markSymptomRecordSynced(r.clientId),
    ),
  ]);

  return {
    committed: result.committed,
    skipped: result.skipped,
    conflicts: result.conflicts.length,
  };
}

// Hook that triggers sync automatically when app returns to foreground
export function useSyncEngine(patientId: string | null) {
  const queryClient = useQueryClient();
  const syncingRef = useRef(false);

  const sync = useCallback(async () => {
    if (!patientId || syncingRef.current) return;
    syncingRef.current = true;
    try {
      await runSync(patientId);
      void queryClient.invalidateQueries({ queryKey: ["insulin-records", patientId] });
      void queryClient.invalidateQueries({ queryKey: ["symptom-records", patientId] });
      void queryClient.invalidateQueries({ queryKey: ["timeline", patientId] });
    } catch {
      // Silently fail — next foreground will retry
    } finally {
      syncingRef.current = false;
    }
  }, [patientId, queryClient]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") void sync();
    });
    return () => {
      sub.remove();
    };
  }, [sync]);

  return { sync };
}
