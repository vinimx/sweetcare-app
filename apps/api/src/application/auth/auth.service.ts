import { randomUUID } from "crypto";
import type { FastifyInstance } from "fastify";
import type { UserRole } from "@prisma/client";
import { REFRESH_TOKEN_EXPIRY_SECONDS } from "@sweetcare/shared-config";
import type { RegisterInput, LoginInput, ConsentGrantInput } from "@sweetcare/shared-validation";
import { getPrismaClient } from "../../infrastructure/database/client.js";
import { hashPassword, verifyPassword } from "../../infrastructure/auth/password.service.js";
import {
  generateRefreshToken,
  hashToken,
  createSession,
  findSessionByTokenHash,
  revokeFamilyOnTheft,
  revokeSession,
} from "../../infrastructure/auth/session.repository.js";
import { signAccessToken } from "../../infrastructure/auth/jwt.plugin.js";
import { hashSensitive } from "../../infrastructure/database/encryption-middleware.js";
import { auditConsentGranted, auditConsentRevoked } from "../audit/audit.service.js";
import { logger } from "../../infrastructure/logging/logger.js";

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  userId: string;
  role: UserRole;
}

// ─── Register ──────────────────────────────────────────────────────────────

export async function register(input: RegisterInput): Promise<{ userId: string }> {
  const prisma = getPrismaClient();

  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existing) {
    const err = new Error("EMAIL_ALREADY_REGISTERED") as Error & { statusCode: number };
    err.statusCode = 409;
    throw err;
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      role: input.role as UserRole,
      displayName: input.display_name,
      phoneE164: input.phone_e164 ?? null,
    },
    select: { id: true },
  });

  return { userId: user.id };
}

// ─── Login ─────────────────────────────────────────────────────────────────

export async function login(
  app: FastifyInstance,
  input: LoginInput,
  deviceFingerprint?: string,
): Promise<AuthResult> {
  const prisma = getPrismaClient();

  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, passwordHash: true, role: true, isActive: true },
  });

  // Constant-time path: always verify password even on not-found to prevent timing attacks
  const passwordMatch = user
    ? await verifyPassword(user.passwordHash, input.password)
    : await verifyPassword("$argon2id$dummy", input.password).catch(() => false);

  if (!user || !passwordMatch) {
    const err = new Error("INVALID_CREDENTIALS") as Error & { statusCode: number };
    err.statusCode = 401;
    throw err;
  }

  if (!user.isActive) {
    const err = new Error("ACCOUNT_DISABLED") as Error & { statusCode: number };
    err.statusCode = 403;
    throw err;
  }

  return createTokenPair(app, user.id, user.role, deviceFingerprint);
}

// ─── Refresh ───────────────────────────────────────────────────────────────

export async function refresh(
  app: FastifyInstance,
  rawRefreshToken: string,
): Promise<Omit<AuthResult, "userId" | "role"> & { userId: string; role: UserRole }> {
  const tokenHash = hashToken(rawRefreshToken);
  const session = await findSessionByTokenHash(tokenHash);

  if (!session) {
    const err = new Error("REFRESH_TOKEN_INVALID") as Error & { statusCode: number };
    err.statusCode = 401;
    throw err;
  }

  if (session.revokedAt) {
    // Token already revoked — if parent token is being reused, that means theft
    if (session.parentTokenHash) {
      await revokeFamilyOnTheft(session.familyId);
      logger.warn(
        { familyId: session.familyId, correlationId: randomUUID() },
        "Refresh token reuse detected — session family revoked",
      );
    }
    const err = new Error(
      session.revocationReason === "rotation_theft_detected"
        ? "SESSION_FAMILY_REVOKED"
        : "REFRESH_TOKEN_INVALID",
    ) as Error & { statusCode: number };
    err.statusCode = 401;
    throw err;
  }

  if (new Date() > session.expiresAt) {
    const err = new Error("REFRESH_TOKEN_EXPIRED") as Error & { statusCode: number };
    err.statusCode = 401;
    throw err;
  }

  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true, isActive: true },
  });

  if (!user?.isActive) {
    const err = new Error("ACCOUNT_DISABLED") as Error & { statusCode: number };
    err.statusCode = 403;
    throw err;
  }

  // Rotate: revoke old token, issue new one in the same family
  await revokeSession(tokenHash, "logout");
  const newPair = await createTokenPair(app, user.id, user.role, undefined, {
    familyId: session.familyId,
    parentTokenHash: tokenHash,
  });

  return newPair;
}

// ─── Logout ────────────────────────────────────────────────────────────────

export async function logout(rawRefreshToken: string): Promise<void> {
  const tokenHash = hashToken(rawRefreshToken);
  await revokeSession(tokenHash, "logout");
}

// ─── Consent ───────────────────────────────────────────────────────────────

export async function grantConsent(
  userId: string,
  input: ConsentGrantInput,
  ipAddress: string,
  userAgent: string,
  correlationId: string,
): Promise<{ consentId: string; grantedAt: Date }> {
  const prisma = getPrismaClient();

  // Requires a valid patient profile if patientProfileId is provided
  if (input.patient_profile_id) {
    const profile = await prisma.patientProfile.findUnique({
      where: { id: input.patient_profile_id },
      select: { id: true, createdByUserId: true },
    });
    if (!profile || profile.createdByUserId !== userId) {
      const err = new Error("PATIENT_NOT_FOUND") as Error & { statusCode: number };
      err.statusCode = 404;
      throw err;
    }
  }

  const grantedAt = new Date();
  const consent = await prisma.consentRecord.create({
    data: {
      guardianUserId: userId,
      patientProfileId: input.patient_profile_id ?? userId, // fallback for pre-registration consent
      consentType: input.consent_type,
      grantedAt,
      consentTextVersion: input.consent_text_version,
      ipAddressHash: hashSensitive(ipAddress),
      userAgentHash: hashSensitive(userAgent),
    },
    select: { id: true, grantedAt: true },
  });

  void auditConsentGranted({
    actorUserId: userId,
    correlationId,
    targetTable: "consent_records",
    targetId: consent.id,
    diffSummary: { consentType: input.consent_type, version: input.consent_text_version },
    ipAddress,
    userAgent,
  });

  return { consentId: consent.id, grantedAt: consent.grantedAt };
}

export async function revokeConsent(
  consentId: string,
  userId: string,
  ipAddress: string,
  userAgent: string,
  correlationId: string,
): Promise<{ revokedAt: Date }> {
  const prisma = getPrismaClient();

  const consent = await prisma.consentRecord.findUnique({
    where: { id: consentId },
    select: { id: true, guardianUserId: true, revokedAt: true, patientProfileId: true },
  });

  if (!consent) {
    const err = new Error("CONSENT_NOT_FOUND") as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }
  if (consent.guardianUserId !== userId) {
    const err = new Error("FORBIDDEN") as Error & { statusCode: number };
    err.statusCode = 403;
    throw err;
  }
  if (consent.revokedAt) {
    const err = new Error("CONSENT_ALREADY_REVOKED") as Error & { statusCode: number };
    err.statusCode = 409;
    throw err;
  }

  const revokedAt = new Date();
  await prisma.consentRecord.update({
    where: { id: consentId },
    data: { revokedAt },
  });

  void auditConsentRevoked({
    actorUserId: userId,
    correlationId,
    targetTable: "consent_records",
    targetId: consentId,
    diffSummary: { patientProfileId: consent.patientProfileId },
    ipAddress,
    userAgent,
  });

  return { revokedAt };
}

// ─── Internal helpers ──────────────────────────────────────────────────────

async function createTokenPair(
  app: FastifyInstance,
  userId: string,
  role: UserRole,
  deviceFingerprint?: string,
  rotation?: { familyId: string; parentTokenHash: string },
): Promise<AuthResult> {
  const accessToken = signAccessToken(app, { sub: userId, role });
  const rawRefreshToken = generateRefreshToken();
  const tokenHash = hashToken(rawRefreshToken);
  const familyId = rotation?.familyId ?? randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000);

  await createSession({
    userId,
    familyId,
    tokenHash,
    parentTokenHash: rotation?.parentTokenHash,
    deviceFingerprint: deviceFingerprint ? hashToken(deviceFingerprint) : undefined,
    expiresAt,
  });

  return { accessToken, refreshToken: rawRefreshToken, userId, role };
}
