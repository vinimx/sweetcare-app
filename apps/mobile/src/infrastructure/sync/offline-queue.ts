import { tokenStorage } from "../storage/secure-storage.js";
import { saveOfflineInsulinRecord, saveOfflineSymptomRecord } from "../storage/offline-db.js";
import type { CreateInsulinRecordInput } from "@sweetcare/shared-validation";
import type { CreateSymptomRecordInput } from "@sweetcare/shared-validation";

const API_BASE =
  (process.env["EXPO_PUBLIC_API_URL"] as string | undefined) ?? "http://localhost:3000/api/v1";

export type QueueResult =
  | { status: "synced"; recordId: string }
  | { status: "queued"; clientId: string }
  | { status: "duplicate"; recordId: string };

async function authHeaders(): Promise<Record<string, string>> {
  const token = await tokenStorage.getAccessToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function queueInsulinRecord(
  patientId: string,
  payload: CreateInsulinRecordInput & { client_id: string },
): Promise<QueueResult> {
  try {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/patients/${patientId}/insulin-records`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (res.status === 201) {
      const body = (await res.json()) as { record_id: string };
      return { status: "synced", recordId: body.record_id };
    }
    if (res.status === 200) {
      const body = (await res.json()) as { record_id: string };
      return { status: "duplicate", recordId: body.record_id };
    }
    // 403/422 — don't queue, surface error to caller
    const err = (await res.json()) as { message?: string };
    throw new Error(err.message ?? `HTTP ${String(res.status)}`);
  } catch (error) {
    if (error instanceof Error && !isNetworkError(error)) throw error;

    // Network unavailable — persist locally
    await saveOfflineInsulinRecord({
      id: payload.client_id,
      clientId: payload.client_id,
      patientId,
      payload: payload,
      createdAt: new Date().toISOString(),
    });
    return { status: "queued", clientId: payload.client_id };
  }
}

export async function queueSymptomRecord(
  patientId: string,
  payload: CreateSymptomRecordInput & { client_id: string },
): Promise<QueueResult> {
  try {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/patients/${patientId}/symptoms`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (res.status === 201) {
      const body = (await res.json()) as { record_id: string };
      return { status: "synced", recordId: body.record_id };
    }
    if (res.status === 200) {
      const body = (await res.json()) as { record_id: string };
      return { status: "duplicate", recordId: body.record_id };
    }
    const err = (await res.json()) as { message?: string };
    throw new Error(err.message ?? `HTTP ${String(res.status)}`);
  } catch (error) {
    if (error instanceof Error && !isNetworkError(error)) throw error;

    await saveOfflineSymptomRecord({
      id: payload.client_id,
      clientId: payload.client_id,
      patientId,
      payload: payload,
      createdAt: new Date().toISOString(),
    });
    return { status: "queued", clientId: payload.client_id };
  }
}

function isNetworkError(error: Error): boolean {
  return (
    error.message.includes("Network request failed") ||
    error.message.includes("Failed to fetch") ||
    error.message.includes("network") ||
    error.name === "TypeError"
  );
}
