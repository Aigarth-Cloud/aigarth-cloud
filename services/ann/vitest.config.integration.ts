/**
 * Vitest config for the ANN service — INTEGRATION tests.
 *
 *   - ADR 008 F1 follow-up: real-DB integration test harness.
 *   - Runs only the schema-level + route-level integration tests under
 *     src/tests/integration/. The in-memory mock tests in src/tests/
 *     are excluded by the narrow include glob.
 *   - Two modes (selected via process.env.INTEGRATION_DB_MODE):
 *       "pg-mem"     — default; in-process Postgres emulator, no Docker.
 *       "postgres"   — connect to a real Postgres at $DATABASE_URL
 *                      (defaults to localhost:5432, the
 *                      infrastructure/docker-compose.yml Postgres).
 *   - Each test file runs in its own forked process so the pg-mem
 *     in-memory state is isolated. The setup() global hook calls
 *     setupTestDb() once per file, populating the harness client.
 *
 *   Note: this file lives at the service root (services/ann/) so the
 *   `pnpm --filter @aigarth/ann test:integration` command resolves the
 *   path correctly. The migration folder is resolved relative to the
 *   test files via Node import.meta.url (see src/tests/integration/setup.ts).
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Narrow include: ONLY pick up the integration tests. The
    // in-memory mock tests in src/tests/ are not matched here, so
    // they do not run twice.
    include: ["src/tests/integration/**/*.test.ts"],
    // Integration tests do more real work per test (db setup, real
    // CTEs, FK checks) — give the hooks + tests more time than the
    // in-memory suite.
    hookTimeout: 30_000,
    testTimeout: 20_000,
    // Run each test file in its own forked process. This isolates
    // pg-mem's in-memory state across files (otherwise one file's
    // schema would leak into the next).
    pool: "forks",
    poolOptions: {
      forks: { singleFork: false },
    },
  },
});
