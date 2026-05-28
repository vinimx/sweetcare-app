import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

// PHI fields encrypted with AES-256-GCM.
// Key: 32-byte Buffer derived from the 64-char hex env variable.
// Format stored in DB: <iv_hex>:<authTag_hex>:<ciphertext_hex>
const SEPARATOR = ":";
const IV_BYTES = 12; // 96-bit IV for GCM
const _TAG_BYTES = 16; // 128-bit auth tag — reserved for future explicit length verification

function deriveKey(): Buffer {
  const hex = process.env["PHI_ENCRYPTION_KEY"];
  if (!hex || hex.length !== 64) {
    throw new Error("PHI_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), ciphertext.toString("hex")].join(SEPARATOR);
}

export function decrypt(encrypted: string): string {
  const key = deriveKey();
  const parts = encrypted.split(SEPARATOR);
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new Error("Invalid encrypted PHI field format");
  }
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

// SHA-256 hash for non-reversible fields (IP, user-agent)
export function hashSensitive(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// PHI field map: model name (camelCase) → field names that must be encrypted
export const PHI_FIELDS: Record<string, string[]> = {
  user: ["displayName", "phoneE164", "mfaSecretEnc"],
  patientProfile: ["fullName", "insulinTypeBasal", "insulinTypeBolus"],
  insulinApplicationRecord: ["insulinType", "notes"],
  symptomRecord: ["notes"],
  insightReport: ["summaryText"],
};

// Integer PHI fields that are stored as encrypted strings (e.g., glucose values)
// We encode them as strings before encryption, decode after decryption.
export const PHI_INT_FIELDS: Record<string, string[]> = {
  insulinApplicationRecord: ["glucoseBeforeMgdl"],
  symptomRecord: ["glucoseReadingMgdl"],
};

export type PlainRecord = Record<string, unknown>;

export function encryptPhiFields(modelName: string, data: PlainRecord): PlainRecord {
  const result = { ...data };
  const stringFields = PHI_FIELDS[modelName] ?? [];
  const intFields = PHI_INT_FIELDS[modelName] ?? [];

  for (const field of stringFields) {
    if (result[field] != null && typeof result[field] === "string") {
      result[field] = encrypt(result[field]);
    }
  }
  for (const field of intFields) {
    if (result[field] != null && typeof result[field] === "number") {
      result[field] = encrypt(String(result[field]));
    }
  }
  return result;
}

export function decryptPhiFields(modelName: string, data: PlainRecord | null): PlainRecord | null {
  if (!data) return null;
  const result = { ...data };
  const stringFields = PHI_FIELDS[modelName] ?? [];
  const intFields = PHI_INT_FIELDS[modelName] ?? [];

  for (const field of stringFields) {
    if (result[field] != null && typeof result[field] === "string") {
      try {
        result[field] = decrypt(result[field]);
      } catch {
        // Field may not be encrypted (e.g., legacy record) — leave as-is
      }
    }
  }
  for (const field of intFields) {
    if (result[field] != null && typeof result[field] === "string") {
      try {
        result[field] = parseInt(decrypt(result[field]), 10);
      } catch {
        // Leave as string if decryption fails
      }
    }
  }
  return result;
}
