export type InsulinDoseRationale = "correction" | "meal_coverage" | "basal" | "combination";

export type SyncStatus = "pending" | "synced" | "conflict";

export type SeverityLevel = "mild" | "moderate" | "severe" | "emergency";

export type AlertType =
  | "hypoglycemia_risk"
  | "severe_hypoglycemia"
  | "ketoacidosis_risk"
  | "emergency_response_required";

export type AlertSeverity = "warning" | "critical" | "emergency";

export type SymptomCode =
  | "hypoglycemia_mild"
  | "tremor"
  | "confusion"
  | "loss_of_consciousness"
  | "seizure"
  | "hyperglycemia"
  | "ketoacidosis_risk"
  | "excessive_thirst"
  | "frequent_urination"
  | "fatigue";

export interface PatientProfile {
  id: string;
  fullName: string;
  dateOfBirth: string;
  diagnosisYear: number;
  targetGlucoseMinMgdl: number;
  targetGlucoseMaxMgdl: number;
  insulinTypeBasal: string | null;
  insulinTypeBolus: string | null;
  icrUnitsPerGramCarb: number | null;
  isfMgdlPerUnit: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InsulinApplicationRecord {
  id: string;
  clientId: string;
  patientProfileId: string;
  recordedByUserId: string;
  insulinType: string;
  doseUnits: number;
  doseRationale: InsulinDoseRationale;
  mealCarbsGrams: number | null;
  glucoseBeforeMgdl: number | null;
  administrationSite: string | null;
  notes: string | null;
  appliedAt: string;
  recordedAt: string;
  syncStatus: SyncStatus;
  timezone: string;
}

export interface SymptomRecord {
  id: string;
  clientId: string;
  patientProfileId: string;
  recordedByUserId: string;
  symptomCodes: SymptomCode[];
  severityLevel: SeverityLevel;
  glucoseReadingMgdl: number | null;
  notes: string | null;
  observedAt: string;
  recordedAt: string;
  syncStatus: SyncStatus;
  timezone: string;
}

export interface AlertEvent {
  id: string;
  patientProfileId: string;
  triggerSymptomRecordId: string;
  alertType: AlertType;
  severityLevel: AlertSeverity;
  guidanceKey: string;
  notifiedUserIds: string[];
  createdAt: string;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
}

export type TimelineEventType = "insulin" | "symptom" | "alert";

export type TimelineEvent =
  | { type: "insulin"; data: InsulinApplicationRecord }
  | { type: "symptom"; data: SymptomRecord }
  | { type: "alert"; data: AlertEvent };
