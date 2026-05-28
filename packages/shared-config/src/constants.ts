export const API_VERSION = "v1" as const;
export const API_BASE_PATH = `/api/${API_VERSION}` as const;

// Dose safety bounds — validated on both client and server
export const INSULIN_DOSE_MAX_UNITS = 100;
export const INSULIN_DOSE_MIN_UNITS = 0.01;

// Glucose physiological bounds (mg/dL)
export const GLUCOSE_MIN_MGDL = 20;
export const GLUCOSE_MAX_MGDL = 600;

// Sync
export const SYNC_BATCH_MAX_RECORDS = 100;
export const SYNC_CONFLICT_WINDOW_MINUTES = 30; // bolus overlap detection window

// Tokens
export const ACCESS_TOKEN_EXPIRY_SECONDS = 900; // 15 minutes
export const REFRESH_TOKEN_EXPIRY_SECONDS = 604_800; // 7 days
export const MFA_SESSION_EXPIRY_SECONDS = 300; // 5 minutes

// Rate limits
export const RATE_LIMIT_AUTH_MAX = 10; // login attempts
export const RATE_LIMIT_AUTH_WINDOW_MS = 900_000; // 15 minutes
export const RATE_LIMIT_REGISTER_MAX = 5;
export const RATE_LIMIT_REGISTER_WINDOW_MS = 3_600_000; // 1 hour

// Insights
export const INSIGHTS_MAX_PERIOD_DAYS = 90;
export const INSIGHTS_MIN_RECORDS_REQUIRED = 3;
export const INSIGHTS_AI_TIMEOUT_MS = 30_000;

// LGPD
export const CONSENT_TEXT_VERSION = "1.0.0" as const;
export const AUDIT_RETENTION_DAYS = 2190; // 6 years (LGPD compliance)

// PHI field names — must match encryption-middleware configuration
export const PHI_ENCRYPTED_MARKER = "[PHI-ENCRYPTED]" as const;
