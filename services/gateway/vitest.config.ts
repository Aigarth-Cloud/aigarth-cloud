import { defineConfig } from "vitest/config";

// Vitest config for the gateway service.
//
// - Uses node environment
// - Tests live under src/tests/ and *.test.ts files
// - Coverage reports to ./coverage
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/tests/**/*.test.ts", "src/**/*.test.ts"],
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
