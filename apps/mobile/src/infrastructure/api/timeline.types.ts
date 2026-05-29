import type { InsulinDoseRationale, SeverityLevel } from "@sweetcare/shared-types";

export interface ApiInsulinData {
  record_id: string;
  client_id: string;
  insulin_type: string;
  dose_units: number;
  dose_rationale: InsulinDoseRationale;
  meal_carbs_grams: number | null;
  glucose_before_mgdl: number | null;
  administration_site: string | null;
  notes: string | null;
  applied_at: string;
  timezone: string;
}

export interface ApiSymptomData {
  record_id: string;
  client_id: string;
  symptom_codes: string[];
  severity_level: SeverityLevel;
  glucose_reading_mgdl: number | null;
  notes: string | null;
  observed_at: string;
  timezone: string;
}

export type ApiInsulinEvent = { type: "insulin"; event_time: string; data: ApiInsulinData };
export type ApiSymptomEvent = { type: "symptom"; event_time: string; data: ApiSymptomData };
export type ApiTimelineEvent = ApiInsulinEvent | ApiSymptomEvent;

export interface TimelineResponse {
  events: ApiTimelineEvent[];
  next_cursor: string | null;
  total_count: number;
}

export interface SuccessSignal {
  type: "insulin" | "symptom" | "correction" | "edit" | "delete";
  ts: number;
}
