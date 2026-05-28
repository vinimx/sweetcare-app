import { z } from "zod";

export const userRoleSchema = z.enum(["guardian", "caregiver", "healthcare_professional", "admin"]);

export const consentTypeSchema = z.enum(["data_processing", "ai_analysis", "data_sharing"]);

export const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(128),
  role: userRoleSchema.exclude(["admin"]),
  display_name: z.string().min(1).max(100),
  phone_e164: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/)
    .optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  device_fingerprint: z.string().max(256).optional(),
});

export const consentGrantSchema = z.object({
  patient_profile_id: z.string().uuid().optional(),
  consent_type: consentTypeSchema,
  consent_text_version: z.string().regex(/^\d+\.\d+\.\d+$/, "Must be semantic version"),
});

export const mfaVerifySchema = z.object({
  totp_code: z
    .string()
    .length(6)
    .regex(/^\d{6}$/),
  session_token: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ConsentGrantInput = z.infer<typeof consentGrantSchema>;
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;
