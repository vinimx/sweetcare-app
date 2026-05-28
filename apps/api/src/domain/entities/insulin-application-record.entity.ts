import {
  INSULIN_DOSE_MAX_UNITS,
  INSULIN_DOSE_MIN_UNITS,
  GLUCOSE_MIN_MGDL,
  GLUCOSE_MAX_MGDL,
} from "@sweetcare/shared-config";

export type InsulinDoseRationale = "correction" | "meal_coverage" | "basal" | "combination";

export interface CreateInsulinRecordInput {
  clientId: string;
  patientProfileId: string;
  recordedByUserId: string;
  insulinType: string;
  doseUnits: number;
  doseRationale: InsulinDoseRationale;
  mealCarbsGrams?: number;
  glucoseBeforeMgdl?: number;
  administrationSite?: string;
  notes?: string;
  appliedAt: Date;
  timezone: string;
}

export interface DomainValidationError {
  code: string;
  message: string;
  field?: string;
}

export function validateInsulinRecord(
  input: CreateInsulinRecordInput,
): DomainValidationError | null {
  if (input.doseUnits < INSULIN_DOSE_MIN_UNITS || input.doseUnits > INSULIN_DOSE_MAX_UNITS) {
    return {
      code: "DOSE_OUT_OF_BOUNDS",
      message: `dose_units must be between ${String(INSULIN_DOSE_MIN_UNITS)} and ${String(INSULIN_DOSE_MAX_UNITS)}`,
      field: "dose_units",
    };
  }

  if (input.doseRationale === "meal_coverage" && input.mealCarbsGrams === undefined) {
    return {
      code: "MEAL_CARBS_REQUIRED",
      message: "meal_carbs_grams is required when dose_rationale is meal_coverage",
      field: "meal_carbs_grams",
    };
  }

  // 5-minute grace window for clock skew
  const futureLimit = new Date(Date.now() + 5 * 60 * 1000);
  if (input.appliedAt > futureLimit) {
    return {
      code: "INVALID_TIMESTAMP",
      message: "applied_at cannot be more than 5 minutes in the future",
      field: "applied_at",
    };
  }

  if (
    input.glucoseBeforeMgdl !== undefined &&
    (input.glucoseBeforeMgdl < GLUCOSE_MIN_MGDL || input.glucoseBeforeMgdl > GLUCOSE_MAX_MGDL)
  ) {
    return {
      code: "GLUCOSE_OUT_OF_BOUNDS",
      message: `glucose_before_mgdl must be between ${String(GLUCOSE_MIN_MGDL)} and ${String(GLUCOSE_MAX_MGDL)}`,
      field: "glucose_before_mgdl",
    };
  }

  return null;
}
