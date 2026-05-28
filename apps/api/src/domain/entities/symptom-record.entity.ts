import { GLUCOSE_MIN_MGDL, GLUCOSE_MAX_MGDL } from "@sweetcare/shared-config";

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

export type SeverityLevel = "mild" | "moderate" | "severe" | "emergency";

export interface CreateSymptomRecordInput {
  clientId: string;
  patientProfileId: string;
  recordedByUserId: string;
  symptomCodes: SymptomCode[];
  severityLevel: SeverityLevel;
  glucoseReadingMgdl?: number;
  notes?: string;
  observedAt: Date;
  timezone: string;
}

export interface DomainValidationError {
  code: string;
  message: string;
  field?: string;
}

// Minimum severity required for each symptom — safety invariant
const MIN_SEVERITY: Partial<Record<SymptomCode, SeverityLevel>> = {
  loss_of_consciousness: "emergency",
  seizure: "emergency",
  confusion: "severe",
  ketoacidosis_risk: "severe",
};

const SEVERITY_ORDER: Record<SeverityLevel, number> = {
  mild: 0,
  moderate: 1,
  severe: 2,
  emergency: 3,
};

export function validateSymptomRecord(
  input: CreateSymptomRecordInput,
): DomainValidationError | null {
  if (input.symptomCodes.length === 0) {
    return {
      code: "SYMPTOM_CODES_EMPTY",
      message: "At least one symptom code is required",
      field: "symptom_codes",
    };
  }

  for (const code of input.symptomCodes) {
    const min = MIN_SEVERITY[code];
    if (min && SEVERITY_ORDER[input.severityLevel] < SEVERITY_ORDER[min]) {
      return {
        code: "SEVERITY_SYMPTOM_MISMATCH",
        message: `Symptom '${code}' requires at minimum '${min}' severity`,
        field: "severity_level",
      };
    }
  }

  const futureLimit = new Date(Date.now() + 5 * 60 * 1000);
  if (input.observedAt > futureLimit) {
    return {
      code: "INVALID_TIMESTAMP",
      message: "observed_at cannot be more than 5 minutes in the future",
      field: "observed_at",
    };
  }

  if (
    input.glucoseReadingMgdl !== undefined &&
    (input.glucoseReadingMgdl < GLUCOSE_MIN_MGDL || input.glucoseReadingMgdl > GLUCOSE_MAX_MGDL)
  ) {
    return {
      code: "GLUCOSE_OUT_OF_BOUNDS",
      message: `glucose_reading_mgdl must be between ${String(GLUCOSE_MIN_MGDL)} and ${String(GLUCOSE_MAX_MGDL)}`,
      field: "glucose_reading_mgdl",
    };
  }

  return null;
}

// Computes the minimum severity level implied by the given symptom codes.
// Used by mobile UI and server-side consistency checks.
export function computeMinimumSeverity(codes: SymptomCode[]): SeverityLevel {
  let maxOrder = 0;
  for (const code of codes) {
    const min = MIN_SEVERITY[code];
    if (min) maxOrder = Math.max(maxOrder, SEVERITY_ORDER[min]);
  }
  return (
    (Object.keys(SEVERITY_ORDER) as SeverityLevel[]).find((s) => SEVERITY_ORDER[s] === maxOrder) ??
    "mild"
  );
}
