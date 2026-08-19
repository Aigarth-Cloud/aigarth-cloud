import { defineConfig } from "vitest/config";

// Vitest config for the ANN service.
//
// - Uses node environment (no DOM)
// - Tests live under src/tests/ and any *.test.ts files in src/
// - Coverage reports to ./coverage to match the root turbo `test`
//   task's `outputs: ["coverage"]` contract
// - hookTimeout: 20s (default 10s) — the routes.test.ts beforeAll
//   imports the entire server (Fastify + all 13 route files), which
//   can exceed 10s when a service-layer test file (with a heavy
//   vi.mock setup) is also being collected. The wider timeout is
//   defensive and matches the time we observed under load.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/tests/**/*.test.ts", "src/**/*.test.ts"],
    hookTimeout: 20_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/tests/**",
        "src/**/*.test.ts",
        // The route file is exercised via fastify integration tests;
        // its branch coverage depends on the DB, which we don't
        // mock here. The unit tests cover the service layer.
        "src/index.ts",
        "src/server.ts",
        "src/db/migrate.ts",
      ],
    },
  },
});
