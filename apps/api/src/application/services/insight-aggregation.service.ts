import { getPrismaClient } from "../../infrastructure/database/client.js";
import { MIN_INSULIN_RECORDS } from "../../domain/entities/insight-report.entity.js";

export interface AggregatedRecord {
  record_type: "insulin" | "symptom" | "glucose";
  occurred_at: string;
  value: number;
  metadata: Record<string, string | number>;
}

export interface AggregationResult {
  records: AggregatedRecord[];
  insulinCount: number;
  symptomCount: number;
}

const SEVERITY_NUMERIC: Record<string, number> = {
  mild: 1,
  moderate: 2,
  severe: 3,
  emergency: 4,
};

// Returns PHI-stripped aggregated records for forwarding to the AI service.
// Throws INSUFFICIENT_DATA if the period contains fewer than MIN_INSULIN_RECORDS insulin entries.
export async function aggregatePatientData(
  patientProfileId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<AggregationResult> {
  const prisma = getPrismaClient();

  const [insulinRecords, symptomRecords] = await Promise.all([
    prisma.insulinApplicationRecord.findMany({
      where: {
        patientProfileId,
        appliedAt: { gte: periodStart, lte: periodEnd },
      },
      orderBy: { appliedAt: "asc" },
    }),
    prisma.symptomRecord.findMany({
      where: {
        patientProfileId,
        observedAt: { gte: periodStart, lte: periodEnd },
      },
      orderBy: { observedAt: "asc" },
    }),
  ]);

  if (insulinRecords.length < MIN_INSULIN_RECORDS) {
    const err = new Error("INSUFFICIENT_DATA") as Error & { code: string; statusCode: number };
    err.code = "INSUFFICIENT_DATA";
    err.statusCode = 422;
    throw err;
  }

  const records: AggregatedRecord[] = [];

  for (const r of insulinRecords) {
    records.push({
      record_type: "insulin",
      occurred_at: r.appliedAt.toISOString(),
      value: Number(r.doseUnits),
      metadata: {
        dose_rationale: r.doseRationale,
        ...(r.mealCarbsGrams !== null ? { meal_carbs_grams: r.mealCarbsGrams } : {}),
        timezone: r.timezone,
      },
    });

    const glucoseBefore = r.glucoseBeforeMgdl;
    if (glucoseBefore !== null && typeof glucoseBefore === "number") {
      records.push({
        record_type: "glucose",
        occurred_at: r.appliedAt.toISOString(),
        value: glucoseBefore,
        metadata: { source: "pre_insulin" },
      });
    }
  }

  for (const s of symptomRecords) {
    records.push({
      record_type: "symptom",
      occurred_at: s.observedAt.toISOString(),
      value: SEVERITY_NUMERIC[s.severityLevel] ?? 1,
      metadata: {
        severity_level: s.severityLevel,
        symptom_count: s.symptomCodes.length,
        timezone: s.timezone,
      },
    });

    const glucoseReading = s.glucoseReadingMgdl;
    if (glucoseReading !== null && typeof glucoseReading === "number") {
      records.push({
        record_type: "glucose",
        occurred_at: s.observedAt.toISOString(),
        value: glucoseReading,
        metadata: { source: "symptom_reading" },
      });
    }
  }

  return { records, insulinCount: insulinRecords.length, symptomCount: symptomRecords.length };
}
