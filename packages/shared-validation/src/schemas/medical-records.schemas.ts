import { z } from "zod";

export const ianaTimezoneSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z_/+\-0-9]+$/, "Must be IANA timezone");

export const uuidv7Schema = z.string().uuid();

export const insulinDoseRationaleSchema = z.enum([
  "correction",
  "meal_coverage",
  "basal",
  "combination",
]);

export const symptomCodeSchema = z.enum([
  "hypoglycemia_mild",
  "tremor",
  "confusion",
  "loss_of_consciousness",
  "seizure",
  "hyperglycemia",
  "ketoacidosis_risk",
  "excessive_thirst",
  "frequent_urination",
  "fatigue",
]);

export const severityLevelSchema = z.enum(["mild", "moderate", "severe", "emergency"]);

export const createPatientSchema = z
  .object({
    full_name: z.string().min(1).max(150),
    date_of_birth: z.string().date(),
    diagnosis_year: z.number().int().min(1900).max(new Date().getFullYear()),
    target_glucose_min_mgdl: z.number().int().min(40).max(100),
    target_glucose_max_mgdl: z.number().int().min(120).max(300),
    insulin_type_basal: z.string().max(100).optional(),
    insulin_type_bolus: z.string().max(100).optional(),
    icr_units_per_gram_carb: z.number().min(0.1).max(2.0).optional(),
    isf_mgdl_per_unit: z.number().min(10).max(200).optional(),
  })
  .refine((d) => d.target_glucose_max_mgdl > d.target_glucose_min_mgdl, {
    message: "max glucose must be greater than min",
    path: ["target_glucose_max_mgdl"],
  });

export const createInsulinRecordSchemaBase = z.object({
  client_id: uuidv7Schema,
  insulin_type: z.string().min(1).max(100),
  dose_units: z.number().positive().max(100),
  dose_rationale: insulinDoseRationaleSchema,
  meal_carbs_grams: z.number().int().min(0).max(500).optional(),
  glucose_before_mgdl: z.number().int().min(20).max(600).optional(),
  administration_site: z.string().max(50).optional(),
  notes: z.string().max(1000).optional(),
  applied_at: z.string().datetime({ offset: true }),
  timezone: ianaTimezoneSchema,
});

export const createInsulinRecordSchema = createInsulinRecordSchemaBase.refine(
  (d) => d.dose_rationale !== "meal_coverage" || d.meal_carbs_grams !== undefined,
  { message: "meal_carbs_grams required for meal_coverage", path: ["meal_carbs_grams"] },
);

export const createSymptomRecordSchema = z.object({
  client_id: uuidv7Schema,
  symptom_codes: z.array(symptomCodeSchema).min(1),
  severity_level: severityLevelSchema,
  glucose_reading_mgdl: z.number().int().min(20).max(600).optional(),
  notes: z.string().max(1000).optional(),
  observed_at: z.string().datetime({ offset: true }),
  timezone: ianaTimezoneSchema,
});

export const timelineQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  types: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type CreateInsulinRecordInput = z.infer<typeof createInsulinRecordSchema>;
export type CreateSymptomRecordInput = z.infer<typeof createSymptomRecordSchema>;

type SymptomCode = z.infer<typeof symptomCodeSchema>;
type SeverityLevel = z.infer<typeof severityLevelSchema>;

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
