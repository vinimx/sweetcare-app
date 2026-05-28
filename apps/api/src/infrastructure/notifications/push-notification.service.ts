import { logger } from "../logging/logger.js";

export interface AlertNotificationPayload {
  notificationType: "alert";
  alertId: string;
  alertType: string;
  severityLevel: string;
  patientProfileId: string;
}

// Returns the list of user IDs that were successfully notified.
// Payload MUST NOT contain PHI — mobile app fetches full content via GET /alerts/:id.
export async function sendAlertNotification(
  patientProfileId: string,
  payload: AlertNotificationPayload,
): Promise<string[]> {
  // FCM/APNs integration is wired in once device token storage (Phase 6) is complete.
  // For now: log the intent and return empty — alert is still created and accessible via API.
  logger.info(
    {
      alertId: payload.alertId,
      alertType: payload.alertType,
      severityLevel: payload.severityLevel,
      patientProfileId,
    },
    "Push notification dispatch (stub — FCM/APNs not yet configured)",
  );
  return [];
}
