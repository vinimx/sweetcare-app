import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@sweetcare/shared-types": path.resolve(
        __dirname,
        "../../packages/shared-types/src/index.ts",
      ),
      "@sweetcare/shared-validation": path.resolve(
        __dirname,
        "../../packages/shared-validation/src/index.ts",
      ),
      "@sweetcare/shared-config": path.resolve(
        __dirname,
        "../../packages/shared-config/src/index.ts",
      ),
    },
  },
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      exclude: ["dist/**", "src/server.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
      },
    },
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
  },
});
