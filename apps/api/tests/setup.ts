// Global test setup — Phase 2 will add DB test container lifecycle here
import { vi } from "vitest";

// Prevent real env parsing from crashing test runner
process.env["NODE_ENV"] = "test";
process.env["DATABASE_URL"] = "postgresql://test:test@localhost:5432/sweetcare_test";
process.env["JWT_ACCESS_SECRET"] = "test-access-secret-must-be-at-least-32-chars";
process.env["JWT_REFRESH_SECRET"] = "test-refresh-secret-must-be-at-least-32-chars";
process.env["PHI_ENCRYPTION_KEY"] = "a".repeat(64);
process.env["REDIS_URL"] = "redis://localhost:6379";

vi.stubGlobal("crypto", {
  randomUUID: () => "00000000-0000-4000-a000-000000000000",
});
