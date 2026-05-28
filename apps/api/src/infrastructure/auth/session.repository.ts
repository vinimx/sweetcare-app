import { createHash, randomBytes } from "crypto";
import type { RevocationReason } from "@prisma/client";
import { getPrismaClient } from "../database/client.js";

const TOKEN_BYTES = 32; // 256-bit random token

export function generateRefreshToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

interface CreateSessionParams {
  userId: string;
  familyId: string;
  tokenHash: string;
  parentTokenHash?: string;
  deviceFingerprint?: string;
  expiresAt: Date;
}

export async function createSession(params: CreateSessionParams) {
  const prisma = getPrismaClient();
  return prisma.userSession.create({
    data: {
      userId: params.userId,
      familyId: params.familyId,
      tokenHash: params.tokenHash,
      parentTokenHash: params.parentTokenHash ?? null,
      deviceFingerprint: params.deviceFingerprint ?? null,
      expiresAt: params.expiresAt,
    },
    select: { id: true, familyId: true, expiresAt: true },
  });
}

export async function findSessionByTokenHash(tokenHash: string) {
  const prisma = getPrismaClient();
  return prisma.userSession.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      familyId: true,
      tokenHash: true,
      parentTokenHash: true,
      expiresAt: true,
      revokedAt: true,
      revocationReason: true,
    },
  });
}

export async function revokeFamilyOnTheft(familyId: string): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.userSession.updateMany({
    where: { familyId, revokedAt: null },
    data: {
      revokedAt: new Date(),
      revocationReason: "rotation_theft_detected" satisfies RevocationReason,
    },
  });
}

export async function revokeSession(
  tokenHash: string,
  reason: RevocationReason = "logout",
): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.userSession.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date(), revocationReason: reason },
  });
}

export async function revokeAllUserSessions(
  userId: string,
  reason: RevocationReason = "password_change",
): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.userSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date(), revocationReason: reason },
  });
}

export async function deleteExpiredSessions(): Promise<number> {
  const prisma = getPrismaClient();
  const result = await prisma.userSession.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
