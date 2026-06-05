import { createHash, randomBytes } from "crypto";
import { getPrismaClient } from "../../infrastructure/database/client.js";
import { hashPassword } from "../../infrastructure/auth/password.service.js";
import { getRedisClient } from "../../infrastructure/cache/redis.client.js";
import { sendPasswordResetEmail } from "../../infrastructure/email/resend.service.js";
import { revokeAllUserSessions } from "../../infrastructure/auth/session.repository.js";
import { logger } from "../../infrastructure/logging/logger.js";

const RESET_TOKEN_TTL_SECONDS = 3600; // 1 hour
const KEY_PREFIX = "pwd_reset:";

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function redisKey(tokenHash: string): string {
  return `${KEY_PREFIX}${tokenHash}`;
}

// Always returns void — never reveals whether the email is registered (timing-safe).
export async function requestPasswordReset(email: string): Promise<void> {
  const prisma = getPrismaClient();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isActive: true },
  });

  if (!user?.isActive) return;

  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const redis = getRedisClient();

  await redis.set(redisKey(tokenHash), user.id, "EX", RESET_TOKEN_TTL_SECONDS);

  try {
    await sendPasswordResetEmail(email, rawToken);
  } catch (err) {
    logger.warn({ err }, "Password reset email delivery failed — token stored but email not sent");
  }
}

export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  const redis = getRedisClient();
  const userId = await redis.get(redisKey(tokenHash));

  if (!userId) {
    const err = new Error("RESET_TOKEN_INVALID") as Error & { statusCode: number };
    err.statusCode = 400;
    throw err;
  }

  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true },
  });

  if (!user?.isActive) {
    const err = new Error("RESET_TOKEN_INVALID") as Error & { statusCode: number };
    err.statusCode = 400;
    throw err;
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  // Single-use: delete token immediately after successful reset
  await redis.del(redisKey(tokenHash));

  // Force re-login on all devices after password change
  await revokeAllUserSessions(userId, "password_change");
}
