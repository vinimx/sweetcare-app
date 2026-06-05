import { z } from "zod";

export const apiEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default("0.0.0.0"),

  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_MIN: z.coerce.number().int().min(1).default(2),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(10),

  // JWT — short-lived access, rotating refresh
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY_SECONDS: z.coerce.number().int().default(900), // 15 min
  JWT_REFRESH_EXPIRY_SECONDS: z.coerce.number().int().default(604800), // 7 days

  // Encryption — PHI column-level AES-256-GCM
  PHI_ENCRYPTION_KEY: z.string().length(64), // 32 bytes hex-encoded

  // Redis
  REDIS_URL: z.string().url().default("redis://localhost:6379"),

  // AI service (internal only)
  AI_SERVICE_URL: z.string().url().default("http://ai-service:8000"),
  AI_SERVICE_TIMEOUT_MS: z.coerce.number().int().default(30000),

  // Email (Resend) — password reset
  RESEND_API_KEY: z.string().min(1).optional(),

  // CORS
  CORS_ALLOWED_ORIGINS: z.string().default(""),

  // Logging
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
});

export const aiServiceEnvSchema = z.object({
  PORT: z.coerce.number().int().default(8000),
  ALLOWED_INTERNAL_HOST: z.string().default("api"),
  LOG_LEVEL: z.enum(["DEBUG", "INFO", "WARNING", "ERROR"]).default("INFO"),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type AiServiceEnv = z.infer<typeof aiServiceEnvSchema>;
