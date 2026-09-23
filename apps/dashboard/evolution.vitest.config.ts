import { defineConfig } from "vitest/config";

/**
 * Vitest config scoped to the evolution adapter test only.
 *
 * We deliberately do NOT run a global vitest for the dashboard —
 * Next.js 14's app-router + RSC is heavy and the rest of the
 * dashboard is exercised by integration tests. This minimal config
 * lets us cover the pure-TS adapter that the dashboard consumes.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/lib/__tests__/evolution.test.ts"],
  },
});
