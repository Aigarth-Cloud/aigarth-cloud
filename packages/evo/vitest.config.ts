import { defineConfig } from "vitest/config";

/**
 * Vitest config for @aigarth/evo.
 *
 * Mirrors packages/trinary/vitest.config.ts:
 * - node environment, no DOM
 * - tests colocated under src/tests/
 * - coverage thresholds at 95% (slightly relaxed from trinary's 100% because
 *   the evolution driver has many stochastic branches that are tested via
 *   convergence fixtures, not line coverage)
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/tests/**",
        "src/**/*.test.ts",
      ],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 85,
        statements: 95,
      },
    },
  },
});
