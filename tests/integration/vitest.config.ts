import { defineConfig } from "vitest/config";

/**
 * Integration test config.
 *
 *   - serial: each test depends on state from the previous one
 *   - bail: stop on first failure (no point continuing if signup is broken)
 *   - testTimeout: 30s per test (HTTP round-trips + DB writes)
 *   - hookTimeout: 60s for the global "is the stack up?" check
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
