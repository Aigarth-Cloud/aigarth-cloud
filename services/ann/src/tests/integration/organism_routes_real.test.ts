/**
 * Route-level integration tests for the Organism primitive.
 *
 *   ADR 008 F1 follow-up; 5 baseline CRUD cases that exercise the
 *   real route layer against a real database (pg-mem by default,
 *   real Postgres in dev mode).
 *
 *   The in-memory mock tests in services/ann/src/tests/organism_routes.test.ts
 *   cover the same surface at the *unit* level (a JS Map pretending
 *   to be Postgres). The 5 cases here confirm the same behaviour
 *   fires when the route handlers hit an actual database:
 *     - Drizzle's query builder produces the SQL we expect.
 *     - Postgres's UNIQUE constraint on `slug` surfaces as a 409
 *       (not a 500).
 *     - The route's ownership check fires before any DB write.
 *     - The activation/pause state machine is enforced by the
 *       service layer + the DB, not by the mock.
 *     - Auth headers propagate to the service layer and the
 *       `req.user.sub` is honoured.
 *
 *   The mock scope is narrow: only `db/index.js` is redirected to
 *   return the harness's Drizzle client. Every other module (the
 *   service layer, the route layer, the audit log, the rate
 *   limiter, the JWT verifier) is the real production code.
 *
 *   Why not also mock the auth helper? The route layer uses
 *   `app.authenticate` (a Fastify decorator) plus the in-memory
 *   `app.jwt.sign()` to mint tokens. We use the real
 *   `app.inject({ headers: { authorization: 'Bearer ...' } })`
 *   path — that's the production path.
 *
 *   Cases (5 total):
 *     1. POST + GET round trip: create then read; the read returns
 *        what the create wrote.
 *     2. PATCH own organism: name + visibility updated; new values
 *        appear on the next GET.
 *     3. PATCH another user's organism: 403 (ownership check fires
 *        before the DB write).
 *     4. Activate + pause lifecycle: status transitions draft ->
 *        active -> paused; birth_at is set on first activation.
 *     5. Slug collision: POST with a slug that already exists
 *        returns 409, not 500. (The schema's UNIQUE index on
 *        `slug` is the source of truth; the route catches the
 *        error and maps it.)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";

// ---------- Env setup ----------
//
// The config loader (`src/config/index.ts`) requires DATABASE_URL,
// JWT_SECRET, etc. before buildServer() can run. We set the
// minimum at module load. The actual DATABASE_URL is unused by
// the harness (the harness's pg-mem pool has no connection
// string) but the Zod schema demands a syntactically valid URL.
//
// IMPORTANT: do NOT remove these. buildServer() exits the process
// if any required env var is missing.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgres://aigarth:aigarth_dev@localhost:5432/aigarth";
process.env.JWT_SECRET = "test-secret-for-routes-only-do-not-use-elsewhere-please";
process.env.ANN_TRINARY_SIGNING_KEY = "test-signing-key-rotate-in-prod-please";
process.env.HOST = "127.0.0.1";
process.env.PORT = "17006";
process.env.LOG_LEVEL = "fatal";
process.env.CORS_ORIGINS = "*";
process.env.IDENTITY_SERVICE_URL = "http://localhost:7001";
process.env.QUBIC_SERVICE_URL = "http://localhost:7002";
process.env.COMPUTE_SERVICE_URL = "http://localhost:7003";
process.env.GATEWAY_SERVICE_URL = "http://localhost:7004";
process.env.BILLING_SERVICE_URL = "http://localhost:7005";
process.env.TRAINING_SERVICE_URL = "http://localhost:7011";
process.env.TRAINING_INTERNAL_TOKEN = "test-training-internal-token";
process.env.AIGARTHPOOL_MODE = "simulator";
process.env.ANN_LLM_BACKEND = "stub";
process.env.ANN_LLM_BASE_URL = "http://localhost:11434/v1";
process.env.ANN_LLM_MODEL = "test-model";
process.env.ANN_LLM_API_KEY = "";
process.env.ANN_ADMIN_USER_IDS = "";

// ---------- DB mock ----------
//
// The service layer's `getDb()` returns a singleton built from
// `process.env.DATABASE_URL`. For the integration tests we don't
// want that singleton (it would point at a Postgres we may or may
// not have running) — we want the harness's Drizzle client backed
// by pg-mem or the ephemeral dev database.
//
// The mock factory is intentionally tiny: it returns the harness
// client. The service code does not depend on any other export
// from `db/index.js` for the routes we exercise; `closeDb` is a
// no-op because the harness manages teardown.
vi.mock("../../db/index.js", async () => {
  const { getTestDb } = await import("./setup.js");
  return {
    getDb: () => getTestDb(),
    closeDb: async () => {
      // Harness teardown is owned by the test file's afterAll.
    },
    getPool: () => null,
  };
});

// ---------- Harness + server lifecycle ----------

import {
  setupTestDb,
  resetTestDb,
  getTestDb,
  type TestHandle,
} from "./setup.js";
import { organisms } from "../../db/schema.js";

let app: FastifyInstance;
let handle: TestHandle;
let teardownFn: (() => Promise<void>) | null = null;

beforeAll(async () => {
  // 1. Build the test database (pg-mem or real Postgres).
  handle = await setupTestDb();
  teardownFn = handle.teardown;
  // 2. Build the Fastify server. The route + service layers are
  //    the real production code; only the DB connection is
  //    redirected (see vi.mock above).
  const { buildServer } = await import("../../server.js");
  app = await buildServer();
  await app.ready();
});

afterAll(async () => {
  if (app) await app.close();
  if (teardownFn) await teardownFn();
});

beforeEach(async () => {
  await resetTestDb();
});

// ---------- Test helpers ----------

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

function jwtFor(userId: string): string {
  // app.jwt is decorated by @fastify/jwt after the plugin registers.
  return (app.jwt as { sign: (payload: object) => string }).sign({ sub: userId });
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";
function req(
  method: Method,
  url: string,
  opts: { userId?: string; payload?: unknown; headers?: Record<string, string> } = {},
): Promise<{ statusCode: number; body: string }> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.userId) headers.authorization = `Bearer ${jwtFor(opts.userId)}`;
  return (
    app.inject as unknown as (opts: unknown) => Promise<{ statusCode: number; body: string }>
  )({
    method,
    url,
    headers,
    payload: opts.payload,
  });
}

const baseCreatePayload = (slug: string) => ({
  slug,
  name: "Route Integration Test",
  kind: "researcher",
  visibility: "private",
  genome: { version: 1, mutation: { rate: 0.05, operators: ["gaussian"] }, recombination: { enabled: false, strategy: "uniform" } },
  environment: { type: "test-env", config: {} },
  objective: {
    fitnessFunction: "test.v1",
    weights: { wet: 0.5 },
    thresholds: { minFitness: 0.6, maxStallGenerations: 10 },
  },
});

// ============================================================================
// 5 baseline CRUD cases
// ============================================================================

describe("Route integration — Organism baseline CRUD", () => {
  // -----------------------------------------------------------------
  // 1. POST + GET round trip
  // -----------------------------------------------------------------
  it("1. POST creates an organism; GET returns the same row (round trip)", async () => {
    const createRes = await req("POST", "/v1/organisms", {
      userId: USER_A,
      payload: baseCreatePayload("round-trip"),
    });
    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.body);
    expect(created.slug).toBe("round-trip");
    expect(created.status).toBe("draft");
    expect(created.creator_id).toBe(USER_A);
    expect(created.id).toBeTruthy();

    // Read back via the public GET. The route applies the
    // `deleted_at IS NULL` filter + the visibility rules.
    const getRes = await req("GET", "/v1/organisms/round-trip");
    expect(getRes.statusCode).toBe(200);
    const read = JSON.parse(getRes.body);
    expect(read.id).toBe(created.id);
    expect(read.slug).toBe("round-trip");
    expect(read.name).toBe("Route Integration Test");
    expect(read.kind).toBe("researcher");
    // Genome / environment / objective are JSONB columns; the
    // service serialises them as-is.
    expect(read.genome).toBeDefined();
    expect(read.environment).toBeDefined();
    expect(read.objective).toBeDefined();

    // Belt + suspenders: the row is in the DB. We don't usually
    // query the DB directly from a route-level test, but the
    // round-trip is incomplete without confirming the *write*
    // landed — the GET could be reading from a cache.
    const dbRows = await getTestDb()
      .select()
      .from(organisms);
    expect(dbRows).toHaveLength(1);
    expect(dbRows[0]!.id).toBe(created.id);
  });

  // -----------------------------------------------------------------
  // 2. PATCH own organism
  // -----------------------------------------------------------------
  it("2. PATCH own organism updates name + visibility and the change is visible on GET", async () => {
    const createRes = await req("POST", "/v1/organisms", {
      userId: USER_A,
      payload: baseCreatePayload("patch-host"),
    });
    expect(createRes.statusCode).toBe(201);

    const patchRes = await req("PATCH", "/v1/organisms/patch-host", {
      userId: USER_A,
      payload: { name: "Renamed", visibility: "public" },
    });
    expect(patchRes.statusCode).toBe(200);
    const patched = JSON.parse(patchRes.body);
    expect(patched.name).toBe("Renamed");
    expect(patched.visibility).toBe("public");

    // The change is visible on the next GET.
    const getRes = await req("GET", "/v1/organisms/patch-host");
    expect(getRes.statusCode).toBe(200);
    const read = JSON.parse(getRes.body);
    expect(read.name).toBe("Renamed");
    expect(read.visibility).toBe("public");
  });

  // -----------------------------------------------------------------
  // 3. PATCH another user's organism — 403
  // -----------------------------------------------------------------
  it("3. PATCH another user's organism returns 403 (ownership check fires before the DB write)", async () => {
    // USER_A creates the organism.
    const createRes = await req("POST", "/v1/organisms", {
      userId: USER_A,
      payload: baseCreatePayload("user-a-only"),
    });
    expect(createRes.statusCode).toBe(201);

    // USER_B tries to PATCH it. The service layer's ownership
    // check must reject the call before any UPDATE statement
    // reaches the DB.
    const patchRes = await req("PATCH", "/v1/organisms/user-a-only", {
      userId: USER_B,
      payload: { name: "Hijacked" },
    });
    expect(patchRes.statusCode).toBe(403);

    // The DB row is untouched.
    const dbRows = await getTestDb()
      .select()
      .from(organisms);
    expect(dbRows).toHaveLength(1);
    expect(dbRows[0]!.name).toBe("Route Integration Test");
  });

  // -----------------------------------------------------------------
  // 4. Activate + pause lifecycle
  // -----------------------------------------------------------------
  it("4. activate + pause: draft -> active -> paused; birth_at is set on first activation", async () => {
    const createRes = await req("POST", "/v1/organisms", {
      userId: USER_A,
      payload: baseCreatePayload("lifecycle"),
    });
    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.body);
    expect(created.status).toBe("draft");
    expect(created.birth_at).toBeNull();

    // Activate.
    const actRes = await req("POST", "/v1/organisms/lifecycle/activate", {
      userId: USER_A,
    });
    expect(actRes.statusCode).toBe(200);
    const activated = JSON.parse(actRes.body);
    expect(activated.status).toBe("active");
    expect(activated.birth_at).toBeTruthy();

    // Pause.
    const pauseRes = await req("POST", "/v1/organisms/lifecycle/pause", {
      userId: USER_A,
    });
    expect(pauseRes.statusCode).toBe(200);
    const paused = JSON.parse(pauseRes.body);
    expect(paused.status).toBe("paused");

    // A second pause attempt is a 409 (state machine violation).
    const secondPause = await req("POST", "/v1/organisms/lifecycle/pause", {
      userId: USER_A,
    });
    expect(secondPause.statusCode).toBe(409);
  });

  // -----------------------------------------------------------------
  // 5. Slug collision
  // -----------------------------------------------------------------
  it("5. POST with a duplicate slug returns 409 (Postgres UNIQUE surfaced through the route)", async () => {
    // First insert succeeds.
    const first = await req("POST", "/v1/organisms", {
      userId: USER_A,
      payload: baseCreatePayload("collision-test"),
    });
    expect(first.statusCode).toBe(201);

    // Second insert with the same slug must return 409. The
    // schema's UNIQUE index `organisms_slug_unique` (in
    // 0006_calm_cerebro.sql) is the source of truth. The route
    // catches the integrity error and maps it.
    const second = await req("POST", "/v1/organisms", {
      userId: USER_A,
      payload: baseCreatePayload("collision-test"),
    });
    expect(second.statusCode).toBe(409);
    const body = JSON.parse(second.body);
    expect(body.error?.message).toMatch(/taken|duplicate|exists/i);

    // Exactly one row in the DB.
    const dbRows = await getTestDb()
      .select()
      .from(organisms);
    expect(dbRows).toHaveLength(1);
  });
});
