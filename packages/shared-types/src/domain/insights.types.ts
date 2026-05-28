export type ReportType =
  | "weekly_summary"
  | "glucose_pattern"
  | "insulin_effectiveness"
  | "symptom_trend";

export type ReportStatus = "processing" | "completed" | "failed";

export type ReportErrorCode = "INSUFFICIENT_DATA" | "AI_SERVICE_ERROR" | "TIMEOUT";

export type PatternFindingConfidence = "low" | "medium" | "high";

export interface PatternFinding {
  findingType: string;
  description: string;
  supportingDataPoints: number;
  confidence: PatternFindingConfidence;
}

export interface ConfidenceContext {
  dataCoveragePercent: number;
  modelLimitations: string[];
}

export interface ReportContent {
  summaryText: string;
  patternFindings: PatternFinding[];
  confidenceContext: ConfidenceContext | null;
  disclaimer: string;
}

export interface InsightReport {
  id: string;
  patientProfileId: string;
  requestedByUserId: string;
  reportType: ReportType;
  periodStart: string;
  periodEnd: string;
  aiModelVersion: string;
  status: ReportStatus;
  content: ReportContent | null;
  generatedAt: string;
  isInvalidated: boolean;
}
