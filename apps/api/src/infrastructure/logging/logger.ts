import pino from "pino";

const PHI_REDACT_PATHS = [
  "*.full_name",
  "*.date_of_birth",
  "*.email",
  "*.password",
  "*.password_hash",
  "*.phone_e164",
  "*.notes",
  "*.insulin_type",
  "*.glucose_before_mgdl",
  "*.glucose_reading_mgdl",
  "*.mfa_secret_enc",
  "req.headers.authorization",
  "req.headers.cookie",
];

export const logger = pino({
  level: process.env["LOG_LEVEL"] ?? "info",
  redact: {
    paths: PHI_REDACT_PATHS,
    remove: true,
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    service: "sweetcare-api",
    version: process.env["npm_package_version"] ?? "unknown",
  },
});

export type Logger = typeof logger;
