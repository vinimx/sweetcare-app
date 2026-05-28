export const CLINICAL_DISCLAIMER_V1 =
  "Este relatório é gerado por análise estatística e não substitui avaliação ou orientação de profissional de saúde habilitado. Decisões clínicas não devem ser baseadas exclusivamente neste conteúdo.";

export const MAX_PERIOD_DAYS = 90;
export const MIN_INSULIN_RECORDS = 3;

export type ReportType =
  | "weekly_summary"
  | "glucose_pattern"
  | "insulin_effectiveness"
  | "symptom_trend";

export interface PeriodValidationError {
  code: "PERIOD_INVALID" | "PERIOD_TOO_LONG";
  message: string;
}

export function validateReportPeriod(
  periodStart: Date,
  periodEnd: Date,
): PeriodValidationError | null {
  if (periodEnd < periodStart) {
    return { code: "PERIOD_INVALID", message: "period_end must be >= period_start" };
  }
  const diffMs = periodEnd.getTime() - periodStart.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays > MAX_PERIOD_DAYS) {
    return {
      code: "PERIOD_TOO_LONG",
      message: `Period exceeds ${String(MAX_PERIOD_DAYS)} calendar days`,
    };
  }
  return null;
}
