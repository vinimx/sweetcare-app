import { getPrismaClient } from "../database/client.js";
import type { SymptomRecord } from "@prisma/client";
import type { CreateSymptomRecordInput } from "../../domain/entities/symptom-record.entity.js";

export interface PaginatedSymptomRecords {
  records: SymptomRecord[];
  nextCursor: string | null;
  totalCount: number;
}

export interface SymptomRecordQuery {
  from?: Date;
  to?: Date;
  limit?: number;
  cursor?: string;
}

// Returns [record, isNew] — isNew=false when client_id already existed (idempotent skip)
export async function upsertSymptomRecord(
  input: CreateSymptomRecordInput,
): Promise<[SymptomRecord, boolean]> {
  const prisma = getPrismaClient();
  const existing = await prisma.symptomRecord.findUnique({
    where: { clientId: input.clientId },
  });
  if (existing) return [existing, false];

  const created = await prisma.symptomRecord.create({
    data: {
      clientId: input.clientId,
      patientProfileId: input.patientProfileId,
      recordedByUserId: input.recordedByUserId,
      symptomCodes: input.symptomCodes,
      severityLevel: input.severityLevel,
      glucoseReadingMgdl:
        input.glucoseReadingMgdl != null ? String(input.glucoseReadingMgdl) : null,
      notes: input.notes ?? null,
      observedAt: input.observedAt,
      timezone: input.timezone,
      syncStatus: "synced",
    },
  });
  return [created, true];
}

export interface UpdateSymptomRecordData {
  symptomCodes?: string[];
  severityLevel?: "mild" | "moderate" | "severe" | "emergency";
  glucoseReadingMgdl?: number | null;
  notes?: string | null;
}

export async function updateSymptomRecord(
  id: string,
  patientId: string,
  data: UpdateSymptomRecordData,
): Promise<SymptomRecord | null> {
  const prisma = getPrismaClient();
  const existing = await prisma.symptomRecord.findFirst({
    where: { id, patientProfileId: patientId },
  });
  if (!existing) return null;

  return prisma.symptomRecord.update({
    where: { id },
    data: {
      ...(data.symptomCodes !== undefined && { symptomCodes: data.symptomCodes }),
      ...(data.severityLevel !== undefined && { severityLevel: data.severityLevel }),
      ...(data.glucoseReadingMgdl !== undefined && {
        glucoseReadingMgdl:
          data.glucoseReadingMgdl != null ? String(data.glucoseReadingMgdl) : null,
      }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  });
}

export async function deleteSymptomRecord(id: string, patientId: string): Promise<boolean> {
  const prisma = getPrismaClient();
  const existing = await prisma.symptomRecord.findFirst({
    where: { id, patientProfileId: patientId },
  });
  if (!existing) return false;
  await prisma.symptomRecord.delete({ where: { id } });
  return true;
}

export async function getPatientSymptomRecords(
  patientId: string,
  query: SymptomRecordQuery,
): Promise<PaginatedSymptomRecords> {
  const prisma = getPrismaClient();
  const limit = Math.min(query.limit ?? 50, 200);
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const from = query.from ?? defaultFrom;
  const cursorDate = query.cursor
    ? new Date(Buffer.from(query.cursor, "base64url").toString("utf8"))
    : null;

  const [records, totalCount] = await Promise.all([
    prisma.symptomRecord.findMany({
      where: {
        patientProfileId: patientId,
        observedAt: {
          gte: from,
          ...(cursorDate ? { lt: cursorDate } : { lte: query.to ?? now }),
        },
      },
      orderBy: { observedAt: "desc" },
      take: limit + 1,
    }),
    prisma.symptomRecord.count({
      where: {
        patientProfileId: patientId,
        observedAt: { gte: from, lte: query.to ?? now },
      },
    }),
  ]);

  const hasMore = records.length > limit;
  const page = hasMore ? records.slice(0, limit) : records;
  const last = page.at(-1);
  const nextCursor =
    hasMore && last ? Buffer.from(last.observedAt.toISOString()).toString("base64url") : null;

  return { records: page, nextCursor, totalCount };
}
