import { getPrismaClient } from "../database/client.js";
import type { AlertEvent } from "@prisma/client";
import type {
  AlertType,
  AlertSeverity,
  GuidanceKey,
} from "../../domain/entities/alert-event.entity.js";

export interface CreateAlertInput {
  patientProfileId: string;
  triggerSymptomRecordId: string;
  alertType: AlertType;
  severityLevel: AlertSeverity;
  guidanceKey: GuidanceKey;
}

export interface AlertQuery {
  status?: "active" | "resolved" | "all";
  from?: Date;
  limit?: number;
  cursor?: string;
}

export interface PaginatedAlerts {
  alerts: AlertEvent[];
  nextCursor: string | null;
}

export async function createAlertEvent(input: CreateAlertInput): Promise<AlertEvent> {
  const prisma = getPrismaClient();
  return prisma.alertEvent.create({
    data: {
      patientProfileId: input.patientProfileId,
      triggerSymptomRecordId: input.triggerSymptomRecordId,
      alertType: input.alertType,
      severityLevel: input.severityLevel,
      guidanceKey: input.guidanceKey,
      notifiedUserIds: [],
    },
  });
}

export async function updateAlertNotifiedUsers(alertId: string, userIds: string[]): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.alertEvent.update({
    where: { id: alertId },
    data: { notifiedUserIds: userIds },
  });
}

export async function getPatientAlerts(
  patientId: string,
  query: AlertQuery,
): Promise<PaginatedAlerts> {
  const prisma = getPrismaClient();
  const limit = Math.min(query.limit ?? 20, 100);
  const defaultFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const from = query.from ?? defaultFrom;

  const cursorDate = query.cursor
    ? new Date(Buffer.from(query.cursor, "base64url").toString("utf8"))
    : null;

  const resolvedFilter =
    query.status === "resolved"
      ? ({ not: null } as const)
      : query.status === "all"
        ? undefined
        : null;

  const alerts = await prisma.alertEvent.findMany({
    where: {
      patientProfileId: patientId,
      createdAt: {
        gte: from,
        ...(cursorDate ? { lt: cursorDate } : {}),
      },
      ...(resolvedFilter !== undefined ? { resolvedAt: resolvedFilter } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
  });

  const hasMore = alerts.length > limit;
  const page = hasMore ? alerts.slice(0, limit) : alerts;
  const last = page.at(-1);
  const nextCursor =
    hasMore && last ? Buffer.from(last.createdAt.toISOString()).toString("base64url") : null;

  return { alerts: page, nextCursor };
}

export async function getAlertById(alertId: string): Promise<AlertEvent | null> {
  const prisma = getPrismaClient();
  return prisma.alertEvent.findUnique({ where: { id: alertId } });
}

export async function resolveAlert(alertId: string, resolvedByUserId: string): Promise<AlertEvent> {
  const prisma = getPrismaClient();
  return prisma.alertEvent.update({
    where: { id: alertId },
    data: {
      resolvedAt: new Date(),
      resolvedByUserId: resolvedByUserId,
    },
  });
}
