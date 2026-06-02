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
      glucoseBeforeMgdl: input.glucoseBeforeMgdl != null ? String(input.glucoseBeforeMgdl) : null,
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

export interface UpdateInsulinRecordData {
  insulinType?: string;
  doseUnits?: number;
  doseRationale?: "correction" | "meal_coverage" | "basal" | "combination";
  mealCarbsGrams?: number | null;
  glucoseBeforeMgdl?: number | null;
  administrationSite?: string | null;
  notes?: string | null;
}

export async function updateInsulinRecord(
  id: string,
  patientId: string,
  data: UpdateInsulinRecordData,
): Promise<InsulinApplicationRecord | null> {
  const prisma = getPrismaClient();
  const existing = await prisma.insulinApplicationRecord.findFirst({
    where: { id, patientProfileId: patientId },
  });
  if (!existing) return null;

  return prisma.insulinApplicationRecord.update({
    where: { id },
    data: {
      ...(data.insulinType !== undefined && { insulinType: data.insulinType }),
      ...(data.doseUnits !== undefined && { doseUnits: data.doseUnits }),
      ...(data.doseRationale !== undefined && { doseRationale: data.doseRationale }),
      ...(data.mealCarbsGrams !== undefined && { mealCarbsGrams: data.mealCarbsGrams }),
      ...(data.glucoseBeforeMgdl !== undefined && {
        glucoseBeforeMgdl: data.glucoseBeforeMgdl != null ? String(data.glucoseBeforeMgdl) : null,
      }),
      ...(data.administrationSite !== undefined && { administrationSite: data.administrationSite }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  });
}

export async function deleteInsulinRecord(id: string, patientId: string): Promise<boolean> {
  const prisma = getPrismaClient();
  const existing = await prisma.insulinApplicationRecord.findFirst({
    where: { id, patientProfileId: patientId },
  });
  if (!existing) return false;
  await prisma.insulinApplicationRecord.delete({ where: { id } });
  return true;
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
