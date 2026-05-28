import { getPrismaClient } from "../database/client.js";
import type { InsulinApplicationRecord } from "@prisma/client";
import type { CreateInsulinRecordInput } from "../../domain/entities/insulin-application-record.entity.js";

export interface PaginatedInsulinRecords {
  records: InsulinApplicationRecord[];
  nextCursor: string | null;
  totalCount: number;
}

export interface InsulinRecordQuery {
  from?: Date;
  to?: Date;
  limit?: number;
  cursor?: string;
}

// Returns [record, isNew] — isNew=false when client_id already existed (idempotent skip)
export async function upsertInsulinRecord(
  input: CreateInsulinRecordInput,
): Promise<[InsulinApplicationRecord, boolean]> {
  const prisma = getPrismaClient();
  const existing = await prisma.insulinApplicationRecord.findUnique({
    where: { clientId: input.clientId },
  });
  if (existing) return [existing, false];

  const created = await prisma.insulinApplicationRecord.create({
    data: {
      clientId: input.clientId,
      patientProfileId: input.patientProfileId,
      recordedByUserId: input.recordedByUserId,
      insulinType: input.insulinType,
      doseUnits: input.doseUnits,
      doseRationale: input.doseRationale,
      mealCarbsGrams: input.mealCarbsGrams ?? null,
      glucoseBeforeMgdl: input.glucoseBeforeMgdl ?? null,
      administrationSite: input.administrationSite ?? null,
      notes: input.notes ?? null,
      appliedAt: input.appliedAt,
      timezone: input.timezone,
      syncStatus: "synced",
    },
  });
  return [created, true];
}

export async function getPatientInsulinRecords(
  patientId: string,
  query: InsulinRecordQuery,
): Promise<PaginatedInsulinRecords> {
  const prisma = getPrismaClient();
  const limit = Math.min(query.limit ?? 50, 200);
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const from = query.from ?? defaultFrom;
  const cursorDate = query.cursor
    ? new Date(Buffer.from(query.cursor, "base64url").toString("utf8"))
    : null;

  const [records, totalCount] = await Promise.all([
    prisma.insulinApplicationRecord.findMany({
      where: {
        patientProfileId: patientId,
        appliedAt: {
          gte: from,
          ...(cursorDate ? { lt: cursorDate } : { lte: query.to ?? now }),
        },
      },
      orderBy: { appliedAt: "desc" },
      take: limit + 1,
    }),
    prisma.insulinApplicationRecord.count({
      where: {
        patientProfileId: patientId,
        appliedAt: { gte: from, lte: query.to ?? now },
      },
    }),
  ]);

  const hasMore = records.length > limit;
  const page = hasMore ? records.slice(0, limit) : records;
  const last = page.at(-1);
  const nextCursor =
    hasMore && last ? Buffer.from(last.appliedAt.toISOString()).toString("base64url") : null;

  return { records: page, nextCursor, totalCount };
}

// Used by sync batch service for overlapping-window conflict detection
export async function findBolusRecordsInWindow(
  patientId: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<InsulinApplicationRecord[]> {
  const prisma = getPrismaClient();
  return prisma.insulinApplicationRecord.findMany({
    where: {
      patientProfileId: patientId,
      appliedAt: { gte: windowStart, lte: windowEnd },
      doseRationale: { in: ["correction", "meal_coverage", "combination"] },
    },
    orderBy: { appliedAt: "asc" },
  });
}
