export type UserRole = "guardian" | "caregiver" | "healthcare_professional" | "admin";

export type AssignmentRole = "primary_guardian" | "secondary_guardian" | "caregiver" | "read_only";

export type ConsentType = "data_processing" | "ai_analysis" | "data_sharing";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  displayName: string;
  isActive: boolean;
  mfaEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConsentRecord {
  id: string;
  guardianUserId: string;
  patientProfileId: string;
  consentType: ConsentType;
  grantedAt: string;
  revokedAt: string | null;
  consentTextVersion: string;
}

export interface JwtAccessTokenPayload {
  sub: string;
  jti: string;
  role: UserRole;
  aud: "sweetcare-api";
  iat: number;
  exp: number;
}

export interface AuthTokens {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
}
