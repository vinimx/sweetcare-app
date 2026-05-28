import { z } from "zod";
import {
  createInsulinRecordSchemaBase,
  createSymptomRecordSchema,
} from "./medical-records.schemas.js";

const insulinSyncRecord = z.object({
  record_type: z.literal("insulin_application"),
  client_id: z.string().uuid(),
  payload: createInsulinRecordSchemaBase.omit({ client_id: true }),
});

const symptomSyncRecord = z.object({
  record_type: z.literal("symptom"),
  client_id: z.string().uuid(),
  payload: createSymptomRecordSchema.omit({ client_id: true }),
});

export const syncBatchSchema = z.object({
  batch_id: z.string().uuid(),
  patient_profile_id: z.string().uuid(),
  records: z
    .array(z.discriminatedUnion("record_type", [insulinSyncRecord, symptomSyncRecord]))
    .min(1)
    .max(100),
});

export const resolveConflictSchema = z.object({
  client_id: z.string().uuid(),
  resolution: z.enum(["keep_local", "keep_server", "discard"]),
  resolution_note: z.string().max(500).optional(),
});

export type SyncBatchInput = z.infer<typeof syncBatchSchema>;
export type ResolveConflictInput = z.infer<typeof resolveConflictSchema>;
