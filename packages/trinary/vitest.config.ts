import { defineConfig } from "vitest/config";

/**
 * Vitest config for @aigarth/trinary.
 *
 * - Uses node environment (no DOM, no fetch)
 * - Source files live under src/; tests are colocated under src/tests/*.test.ts
 * - Coverage reports to ./coverage to match the root turbo `test` task's
 *   `outputs: ["coverage/**"]` contract
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
        // Internal helpers are tested transitively via the public
        // surface. Their branch coverage is a nice-to-have, not a
        // contract; we keep the public API at 100%.
        "src/internal/**",
      ],
      thresholds: {
        // Trinary is a contract surface. Anything below 100% on a public
        // function is a protocol regression.
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
