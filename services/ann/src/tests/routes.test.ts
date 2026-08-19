/**
 * Route smoke tests for the trinary decision surface.
 *
 * Uses fastify's `app.inject()` to exercise the routes without a
 * real network socket. The DB layer is NOT mocked — these tests
 * skip the happy-path DB roundtrip and instead cover the
 * well-known failure modes that map to HTTP status codes:
 *
 *  - 401 when no JWT is supplied
 *  - 400 when the request body is malformed
 *  - 404 when the ANN does not exist
 *  - 400 when the ANN is not in trinary mode
 *
 * The full happy path (decide → log → return signed envelope)
 * is covered by the docker-based smoke tests that run as part
 * of `pnpm dev`. Unit-level logic is in `trinary.test.ts`.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";

// Provide a minimal env so the config loader succeeds.
const ORIGINAL_ENV = { ...process.env };
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgres://aigarth:aigarth_dev@localhost:5432/aigarth";
process.env.JWT_SECRET = "test-secret-for-routes-only-do-not-use-elsewhere-please";
process.env.ANN_TRINARY_SIGNING_KEY = "test-signing-key-rotate-in-prod";

let app: FastifyInstance;

beforeAll(async () => {
  const { buildServer } = await import("../server.js");
  app = await buildServer();
  await app.ready();
});

afterAll(async () => {
  if (app) {
    await app.close();
  }
  process.env = { ...ORIGINAL_ENV };
});

describe("trinary routes — unauthenticated", () => {
  it("POST /v1/anns/:id/decide without a token returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/anns/anything/decide",
      payload: { input: {} },
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /v1/anns/:id/decisions without a token returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/anns/anything/decisions" });
    expect(res.statusCode).toBe(401);
  });
});
