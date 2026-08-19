import { defineConfig } from "vitest/config";

// Vitest config for the tissue service.
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
        "src/db/seed.ts",
      ],
    },
  },
});
