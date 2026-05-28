import { getPrismaClient } from "../database/client.js";
import type { InsightReport } from "@prisma/client";
import type { ReportType } from "../../domain/entities/insight-report.entity.js";

export interface CreateInsightReportInput {
  patientProfileId: string;
  requestedByUserId: string;
  reportType: ReportType;
  periodStart: Date;
  periodEnd: Date;
}

export interface UpdateReportCompletedInput {
  summaryText: string;
  patternFindings: unknown;
  confidenceContext: unknown;
  aiModelVersion: string;
}

export interface InsightReportQuery {
  reportType?: ReportType;
  limit?: number;
  cursor?: string;
}

export interface PaginatedInsightReports {
  reports: InsightReport[];
  nextCursor: string | null;
}

export async function createInsightReport(input: CreateInsightReportInput): Promise<InsightReport> {
  const prisma = getPrismaClient();
  return prisma.insightReport.create({
    data: {
      patientProfileId: input.patientProfileId,
      requestedByUserId: input.requestedByUserId,
      reportType: input.reportType,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      status: "processing",
    },
  });
}

export async function getReportById(reportId: string): Promise<InsightReport | null> {
  const prisma = getPrismaClient();
  return prisma.insightReport.findUnique({ where: { id: reportId } });
}

export async function listPatientReports(
  patientProfileId: string,
  query: InsightReportQuery,
): Promise<PaginatedInsightReports> {
  const prisma = getPrismaClient();
  const limit = Math.min(query.limit ?? 10, 50);

  const cursorDate = query.cursor
    ? new Date(Buffer.from(query.cursor, "base64url").toString("utf8"))
    : null;

  const reports = await prisma.insightReport.findMany({
    where: {
      patientProfileId,
      isInvalidated: false,
      ...(query.reportType ? { reportType: query.reportType } : {}),
      ...(cursorDate ? { generatedAt: { lt: cursorDate } } : {}),
    },
    orderBy: { generatedAt: "desc" },
    take: limit + 1,
  });

  const hasMore = reports.length > limit;
  const page = hasMore ? reports.slice(0, limit) : reports;
  const last = page.at(-1);
  const nextCursor =
    hasMore && last ? Buffer.from(last.generatedAt.toISOString()).toString("base64url") : null;

  return { reports: page, nextCursor };
}

export async function updateReportCompleted(
  reportId: string,
  data: UpdateReportCompletedInput,
): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.insightReport.update({
    where: { id: reportId },
    data: {
      status: "completed",
      summaryText: data.summaryText,
      patternFindings: data.patternFindings,
      confidenceContext: data.confidenceContext,
      aiModelVersion: data.aiModelVersion,
    },
  });
}

export async function updateReportFailed(reportId: string, errorCode: string): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.insightReport.update({
    where: { id: reportId },
    data: { status: "failed", errorCode },
  });
}
