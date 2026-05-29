// UUID v4 generator compatible with Hermes (React Native).
// globalThis.crypto is typed as always-present in DOM lib but is absent in
// some Hermes versions — access via Record cast to avoid runtime crashes.
export function generateUUID(): string {
  const bytes = new Uint8Array(16);

  const cryptoObj = (globalThis as Record<string, unknown>)["crypto"] as Crypto | undefined;

  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  // Set version 4 and RFC 4122 variant bits
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
