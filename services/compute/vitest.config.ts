import { defineConfig } from "vitest/config";

// Vitest config for the Compute service.
//
// - node environment
// - tests live under src/tests/
// - coverage matches the rest of the workspace
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
        "src/index.ts",
        "src/server.ts",
        "src/db/migrate.ts",
      ],
    },
  },
});
