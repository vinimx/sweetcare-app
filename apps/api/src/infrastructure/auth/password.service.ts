import argon2 from "argon2";

// argon2id — OWASP primary recommendation for password hashing.
// Memory: 64 MB, iterations: 3, parallelism: 1.
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65_536, // 64 MB
  timeCost: 3,
  parallelism: 1,
};

export async function hashPassword(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, plaintext: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    // argon2.verify throws on malformed hash — treat as mismatch
    return false;
  }
}
