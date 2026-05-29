import { apiClient } from "../api/client.js";
import { saveOfflineInsulinRecord, saveOfflineSymptomRecord } from "../storage/offline-db.js";
import type { CreateInsulinRecordInput } from "@sweetcare/shared-validation";
import type { CreateSymptomRecordInput } from "@sweetcare/shared-validation";

export type QueueResult =
  | { status: "synced"; recordId: string }
  | { status: "queued"; clientId: string };

export async function queueInsulinRecord(
  patientId: string,
  payload: CreateInsulinRecordInput & { client_id: string },
): Promise<QueueResult> {
  try {
    const body = await apiClient.post<{ record_id: string }>(
      `/patients/${patientId}/insulin-records`,
      payload,
    );
    return { status: "synced", recordId: body.record_id };
  } catch (error) {
    if (error instanceof Error && !isNetworkError(error)) throw error;

    await saveOfflineInsulinRecord({
      id: payload.client_id,
      clientId: payload.client_id,
      patientId,
      payload,
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
    const body = await apiClient.post<{ record_id: string }>(
      `/patients/${patientId}/symptoms`,
      payload,
    );
    return { status: "synced", recordId: body.record_id };
  } catch (error) {
    if (error instanceof Error && !isNetworkError(error)) throw error;

    await saveOfflineSymptomRecord({
      id: payload.client_id,
      clientId: payload.client_id,
      patientId,
      payload,
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
