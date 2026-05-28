import { PrismaClient } from "@prisma/client";
import { logger } from "../logging/logger.js";
import { encryptPhiFields, decryptPhiFields } from "./encryption-middleware.js";
import type { PlainRecord } from "./encryption-middleware.js";

// ─── Circuit Breaker ────────────────────────────────────────────────────────
// Prevents cascading failures when the database is unreachable.
type CircuitState = "closed" | "open" | "half-open";

const circuit = {
  state: "closed" as CircuitState,
  failures: 0,
  lastFailure: 0,
  FAILURE_THRESHOLD: 5,
  RECOVERY_TIMEOUT_MS: 30_000,
};

function recordSuccess() {
  circuit.failures = 0;
  circuit.state = "closed";
}

function recordFailure() {
  circuit.failures += 1;
  circuit.lastFailure = Date.now();
  if (circuit.failures >= circuit.FAILURE_THRESHOLD) {
    circuit.state = "open";
    logger.error({ failures: circuit.failures }, "DB circuit breaker opened");
  }
}

export function isCircuitOpen(): boolean {
  if (circuit.state === "open") {
    const elapsed = Date.now() - circuit.lastFailure;
    if (elapsed >= circuit.RECOVERY_TIMEOUT_MS) {
      circuit.state = "half-open";
      logger.info("DB circuit breaker half-opening for probe");
      return false;
    }
    return true;
  }
  return false;
}

// ─── PHI-aware Prisma Extension ────────────────────────────────────────────
// Encrypts PHI fields on write, decrypts on read transparently.

function createEncryptingPrisma(base: PrismaClient) {
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const modelKey = model
            ? (model as string).charAt(0).toLowerCase() + (model as string).slice(1)
            : "";

          // Encrypt before write
          if (["create", "update", "upsert"].includes(operation) && args.data) {
            (args as { data: PlainRecord }).data = encryptPhiFields(
              modelKey,
              (args as { data: PlainRecord }).data,
            );
          }
          if (operation === "createMany" && args.data) {
            const rows = args.data as PlainRecord[];
            (args as { data: PlainRecord[] }).data = rows.map((row) =>
              encryptPhiFields(modelKey, row),
            );
          }

          let result: unknown;
          try {
            result = await query(args);
            recordSuccess();
          } catch (err) {
            recordFailure();
            throw err;
          }

          // Decrypt after read
          if (Array.isArray(result)) {
            return result.map((row) => decryptPhiFields(modelKey, row as PlainRecord));
          }
          if (result && typeof result === "object") {
            return decryptPhiFields(modelKey, result as PlainRecord);
          }
          return result;
        },
      },
    },
  });
}

// ─── Singleton ───────────────────────────────────────────────────────────────
let _base: PrismaClient | null = null;
let _client: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!_client) {
    _base = new PrismaClient({
      log: [
        { level: "error", emit: "event" },
        { level: "warn", emit: "event" },
      ],
      errorFormat: "minimal",
    });

    _base.$on("error", (e) => {
      logger.error({ target: e.target, message: e.message }, "DB error");
    });

    _client = createEncryptingPrisma(_base);
  }
  return _client;
}

export async function disconnectPrisma(): Promise<void> {
  if (_base) {
    await _base.$disconnect();
    _base = null;
    _client = null;
  }
}

// Sets the current user ID for RLS policy evaluation.
// Must be called at the start of every request that touches RLS-protected tables.
export async function setCurrentUserId(prisma: PrismaClient, userId: string): Promise<void> {
  await prisma.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${userId}'`);
}
