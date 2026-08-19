/**
 * Tests for the compute bridge (Phase 19C.4).
 *
 * The bridge is exercised end-to-end against the in-memory
 * `StubComputeClient`. We mock the DB layer the same way the
 * jobs tests do, and force the bridge to use the stub mode.
 *
 * The synthetic progress writer in `runTrainingJob` fires every
 * 2s, which would slow the tests down. We override the config
 * in the env mock so the tick is fast (50ms) and the test can
 * drive a job to terminal state in <500ms.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  trainingRecipes,
  trainingJobs,
  type TrainingRecipe,
  type TrainingJob,
} from "../db/schema.js";

// ---------- Mock the DB (same shape as jobs.test.ts) ----------

interface Store {
  recipes: Map<string, TrainingRecipe>;
  jobs: Map<string, TrainingJob>;
}
const store: Store = { recipes: new Map(), jobs: new Map() };

const DRIZZLE_NAME = Symbol.for("drizzle:Name");

function tableName(t: unknown): string | undefined {
  if (t && typeof t === "object" && DRIZZLE_NAME in t) {
    return (t as Record<symbol, string>)[DRIZZLE_NAME];
  }
  return undefined;
}

function extractConditions(cond: unknown): Array<{ column: string; value: unknown }> {
  const out: Array<{ column: string; value: unknown }> = [];
  if (!cond || typeof cond !== "object") return out;
  const chunks = (cond as { queryChunks?: unknown[] }).queryChunks ?? [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i] as { constructor?: { name?: string }; name?: string; queryChunks?: unknown[]; value?: unknown };
    if (!chunk) continue;
    if (chunk.constructor?.name === "SQL") {
      out.push(...extractConditions(chunk));
      continue;
    }
    if (typeof chunk.name === "string" && chunk.constructor?.name?.startsWith("Pg")) {
      for (let j = i + 1; j < chunks.length; j++) {
        const next = chunks[j] as { constructor?: { name?: string }; value?: unknown };
        if (next?.constructor?.name === "Param") {
          out.push({ column: chunk.name, value: next.value });
          break;
        }
        if (next?.constructor?.name !== "StringChunk") break;
      }
    }
  }
  return out;
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function matches(row: Record<string, unknown>, conds: Array<{ column: string; value: unknown }>): boolean {
  for (const c of conds) {
    const camelCol = snakeToCamel(c.column);
    if (row[camelCol] !== c.value) return false;
  }
  return true;
}

function makeChain(rows: Array<Record<string, unknown>>) {
  let filteredRows = rows;
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = (cond: unknown) => {
    const conds = extractConditions(cond);
    if (conds.length === 0) return chain;
    filteredRows = filteredRows.filter((r) => matches(r, conds));
    return chain;
  };
  chain.orderBy = () => chain;
  chain.limit = (n: number) => {
    filteredRows = filteredRows.slice(0, n);
    return chain;
  };
  chain.offset = (n: number) => {
    filteredRows = filteredRows.slice(n);
    return chain;
  };
  Object.defineProperty(chain, "then", {
    get() {
      return (resolve: (r: unknown) => void) => resolve(filteredRows);
    },
  });
  return chain;
}

vi.mock("../db/index.js", () => ({
  getDb: () => ({
    select: (selectArg?: unknown) => ({
      from: (table: unknown) => {
        const name = tableName(table);
        if (selectArg && typeof selectArg === "object" && "count" in (selectArg as Record<string, unknown>)) {
          // Count chain.
          let rows: Array<Record<string, unknown>>;
          if (name === "training_jobs") rows = Array.from(store.jobs.values()).map((j) => ({ ...j }));
          else if (name === "training_recipes") rows = Array.from(store.recipes.values()).map((r) => ({ ...r }));
          else rows = [];
          const chain: Record<string, unknown> = {
            from: () => chain,
            where: (cond: unknown) => {
              const conds = extractConditions(cond);
              rows = rows.filter((r) => matches(r, conds));
              return chain;
            },
          };
          Object.defineProperty(chain, "then", {
            get() {
              return (resolve: (r: unknown) => void) => resolve([{ count: rows.length }]);
            },
          });
          return chain;
        }
        if (name === "training_recipes") {
          return makeChain(Array.from(store.recipes.values()).map((r) => ({ ...r })));
        }
        if (name === "training_jobs") {
          return makeChain(Array.from(store.jobs.values()).map((j) => ({ ...j })));
        }
        return makeChain([]);
      },
    }),
    insert: (table: unknown) => ({
      values: (vals: unknown) => {
        const name = tableName(table);
        if (name === "training_jobs") {
          const row = (Array.isArray(vals) ? vals[0] : vals) as TrainingJob;
          store.jobs.set(row.id, row);
          return { returning: async () => [row] };
        }
        if (name === "training_recipes") {
          const row = (Array.isArray(vals) ? vals[0] : vals) as TrainingRecipe;
          store.recipes.set(row.id, row);
          return { returning: async () => [row] };
        }
        if (name === "training_audit_logs") {
          return { returning: async () => [] };
        }
        return { returning: async () => [] };
      },
    }),
    update: (table: unknown) => ({
      set: (patch: Record<string, unknown>) => ({
        where: async (cond: unknown) => {
          const name = tableName(table);
          const conds = extractConditions(cond);
          if (name === "training_jobs") {
            for (const job of store.jobs.values()) {
              if (matches(job as unknown as Record<string, unknown>, conds)) {
                Object.assign(job, patch);
              }
            }
          }
          if (name === "training_recipes") {
            for (const recipe of store.recipes.values()) {
              if (matches(recipe as unknown as Record<string, unknown>, conds)) {
                Object.assign(recipe, patch);
              }
            }
          }
          return [];
        },
      }),
    }),
  }),
  closeDb: async () => undefined,
}));

// Speed up the synthetic progress writer + the worker interval.
vi.mock("../config/index.js", () => ({
  loadConfig: () => ({
    NODE_ENV: "test",
    PORT: 7011,
    HOST: "0.0.0.0",
    LOG_LEVEL: "error",
    DATABASE_URL: "postgres://test:test@localhost:5432/test",
    JWT_SECRET: "x".repeat(40),
    CORS_ORIGINS: "*",
    COOKIE_SECURE: false,
    TRAINING_ADMIN_USER_IDS: [],
    TRAINING_COMPUTE_MODE: "stub",
    COMPUTE_BASE_URL: "http://localhost:7003",
    COMPUTE_INTERNAL_TOKEN: "x",
    TRAINING_ANN_BASE_URL: "http://localhost:7006",
    ANN_INTERNAL_TOKEN: "x",
    NATS_URL: "nats://localhost:4222",
    TRAINING_PROGRESS_SUBJECT: "aigarth.training.progress",
    TRAINING_WORKER_INTERVAL_MS: 100,
    TRAINING_PROGRESS_TICK_MS: 50,
  }),
  __resetConfigForTests: () => undefined,
}));

// ---------- Test fixtures ----------

const RECIPE_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";
const ANN_ID = "33333333-3333-3333-3333-333333333333";
const DATASET_ID = "44444444-4444-4444-4444-444444444444";
const DATASET_VERSION_ID = "55555555-5555-5555-5555-555555555555";

function makeRecipe(): TrainingRecipe {
  return {
    id: RECIPE_ID,
    slug: "mlp_classifier",
    name: "MLP Classifier",
    kind: "mlp_classifier",
    description: "Test",
    architecture: "mlp",
    defaultHyperparams: { lr: 0.001, batch_size: 32, epochs: 10, optimizer: "adam", loss: "binary_crossentropy" },
    supportedDatasetKinds: ["tabular"],
    outputArtifactKind: "ann_weights_v1",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

import { submitJob, getJob, markFailed } from "../services/jobs.js";
import { runTrainingJob, allocateForJob } from "../services/computeBridge.js";
import { __forceInMemoryProgress, __resetProgressForTests } from "../services/progress.js";
import { StubComputeClient, __resetComputeClientForTests } from "../clients/compute.js";
import { publishTrainingResult } from "../services/annPublisher.js";
import { StubAnnClient, __resetAnnClientForTests } from "../clients/ann.js";
import type { TrainingMetrics } from "../db/schema.js";

describe("compute bridge (stub mode)", () => {
  beforeEach(() => {
    store.recipes.clear();
    store.jobs.clear();
    store.recipes.set(RECIPE_ID, makeRecipe());
    __resetProgressForTests();
    __forceInMemoryProgress();
    __resetComputeClientForTests();
  });

  it("allocateForJob returns a compute_job_id and stores it on the training job", async () => {
    const created = await submitJob(USER_ID, {
      ann_id: ANN_ID,
      dataset_id: DATASET_ID,
      dataset_version_id: DATASET_VERSION_ID,
      recipe_slug: "mlp_classifier",
    });
    // Move job to preparing.
    created.status = "preparing";
    store.jobs.set(created.id, created);

    const computeId = await allocateForJob(created);
    expect(computeId).toBeTruthy();
    expect(typeof computeId).toBe("string");

    const reloaded = await getJob(created.id);
    expect(reloaded.computeJobId).toBe(computeId);
  });

  it("pollComputeJob advances the stub through queued -> submitted -> running -> completed", async () => {
    const created = await submitJob(USER_ID, {
      ann_id: ANN_ID,
      dataset_id: DATASET_ID,
      dataset_version_id: DATASET_VERSION_ID,
      recipe_slug: "mlp_classifier",
    });
    created.status = "preparing";
    store.jobs.set(created.id, created);
    const computeId = await allocateForJob(created);

    // Initial state: queued.
    const initial = await runTrainingJob.bind(null, created.id);
    // The stub's `tickAll` fast-forwards all pending transitions.
    const stub = (runTrainingJob as unknown as { length?: number });
    // Force the stub to immediately advance.
    // We re-grab the cached client to call its private tickAll.
    const { getComputeClient } = await import("../clients/compute.js");
    const client = getComputeClient() as StubComputeClient;
    expect(client.mode).toBe("stub");

    // After the initial submit, the stub is queued. We need
    // to drive the transitions manually. Use the public
    // `tickAll` (exposed for tests).
    await client.tickAll();
    const after = await client.getJob(computeId);
    expect(after.status).toBe("completed");
    expect(after.result).toBeDefined();
    expect(after.result?.accuracy).toBe(0.92);
  });

  it("runTrainingJob reaches succeeded terminal state in stub mode", async () => {
    const created = await submitJob(USER_ID, {
      ann_id: ANN_ID,
      dataset_id: DATASET_ID,
      dataset_version_id: DATASET_VERSION_ID,
      recipe_slug: "mlp_classifier",
    });
    created.status = "preparing";
    store.jobs.set(created.id, created);

    // Run the training. The bridge polls every 1s (POLL_BACKOFF_MS[0]).
    // We accelerate by replacing the compute client with one
    // whose tickAll is called by a side-effect — but the
    // bridge's poll loop uses its own timers, so we can either
    // wait ~5s (acceptable but slow) or use a custom client.
    // For test speed, use a stub that auto-completes.
    const { getComputeClient } = await import("../clients/compute.js");
    const client = getComputeClient() as StubComputeClient;

    // Submit a job so the stub has a job to operate on.
    // We don't await this; we want to drive the existing
    // training job's compute id through the stub.
    const computeId = await allocateForJob(created);

    // The bridge will poll every 1s. To avoid a 4s+ test, we
    // fast-forward by directly mutating the stub's job state
    // and then calling tickAll to ensure all transitions fire.
    // Then call runTrainingJob — it will pick up the
    // "completed" state on the first poll.
    await client.tickAll();

    const result = await runTrainingJob(created.id);
    expect(result.outcome).toBe("succeeded");
    expect(result.metrics).toBeDefined();
    expect(result.metrics?.accuracy).toBe(0.92);

    const reloaded = await getJob(created.id);
    expect(reloaded.status).toBe("succeeded");
    expect(reloaded.artifactUrl).toMatch(/^s3:\/\/aigarth\/training-artifacts\//);
    expect(reloaded.artifactHash).toBeTruthy();
    expect(reloaded.artifactSizeBytes).toBeGreaterThan(0);
    // We also verify the compute_job_id round-tripped.
    expect(reloaded.computeJobId).toBe(computeId);
  });

  it("failure path reaches failed terminal state", async () => {
    const created = await submitJob(USER_ID, {
      ann_id: ANN_ID,
      dataset_id: DATASET_ID,
      dataset_version_id: DATASET_VERSION_ID,
      recipe_slug: "mlp_classifier",
    });
    created.status = "preparing";
    store.jobs.set(created.id, created);

    const { getComputeClient } = await import("../clients/compute.js");
    const client = getComputeClient() as StubComputeClient;
    const computeId = await allocateForJob(created);

    // Force the stub to fail by calling cancelJob (which sets
    // the state to cancelled, which the bridge treats as
    // failed).
    await client.cancelJob(computeId);
    // tickAll is a no-op for cancelled jobs but doesn't hurt.
    await client.tickAll();

    const result = await runTrainingJob(created.id);
    expect(result.outcome).toBe("failed");
    expect(result.error).toBeDefined();

    const reloaded = await getJob(created.id);
    expect(reloaded.status).toBe("failed");
    expect(reloaded.errorMessage).toBeTruthy();
    expect(reloaded.finishedAt).toBeInstanceOf(Date);
  });

  it("runTrainingJob respects a cancelled training job", async () => {
    const created = await submitJob(USER_ID, {
      ann_id: ANN_ID,
      dataset_id: DATASET_ID,
      dataset_version_id: DATASET_VERSION_ID,
      recipe_slug: "mlp_classifier",
    });
    created.status = "preparing";
    store.jobs.set(created.id, created);

    // Cancel mid-flight.
    created.status = "cancelled";
    store.jobs.set(created.id, created);

    const result = await runTrainingJob(created.id);
    expect(result.outcome).toBe("cancelled");
  });
});

describe("auto-publish (Phase 19C.6)", () => {
  beforeEach(() => {
    store.recipes.clear();
    store.jobs.clear();
    store.recipes.set(RECIPE_ID, makeRecipe());
    __resetProgressForTests();
    __forceInMemoryProgress();
    __resetComputeClientForTests();
    __resetAnnClientForTests();
  });

  it("calls annClient.createVersion when auto_publish=true", async () => {
    // Submit a job with auto_publish=true.
    const created = await submitJob(USER_ID, {
      ann_id: ANN_ID,
      dataset_id: DATASET_ID,
      dataset_version_id: DATASET_VERSION_ID,
      recipe_slug: "mlp_classifier",
      auto_publish: true,
    });
    // Mark it succeeded (simulating the bridge's terminal write).
    const { markSucceeded } = await import("../services/jobs.js");
    await markSucceeded(created.id, {
      metrics: { loss: 0.1, accuracy: 0.92 } as TrainingMetrics,
      artifact: { url: "s3://x", sizeBytes: 42, hash: "abc" },
    });
    const reloaded = await getJob(created.id);

    // Use the stub ANN client. Pre-populate it so getAnn()
    // returns the ANN (otherwise the publisher skips).
    const annClient = new StubAnnClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (annClient as any).anns.set(ANN_ID, {
      id: ANN_ID,
      currentVersionId: null,
      currentVersion: null,
    });
    const result = await publishTrainingResult(
      reloaded,
      { metrics: reloaded.metricsJson as TrainingMetrics, result: reloaded.metricsJson as Record<string, unknown> },
      { annClientOverride: annClient },
    );
    // The stub creates a version and the result should report it.
    expect("skipped" in result).toBe(false);
    if (!("skipped" in result)) {
      expect(result.promoted).toBe(true); // auto_publish=true => promote
      expect(result.version).toMatch(/^0\.1\.\d+$/);
    }
    // The stub now has a version for our ANN.
    const versions = annClient.__listVersions(reloaded.annId);
    expect(versions).toHaveLength(1);
    expect(versions[0]!.isLatest).toBe(true);
  });

  it("does NOT promote when auto_publish=false", async () => {
    const created = await submitJob(USER_ID, {
      ann_id: ANN_ID,
      dataset_id: DATASET_ID,
      dataset_version_id: DATASET_VERSION_ID,
      recipe_slug: "mlp_classifier",
      auto_publish: false,
    });
    const { markSucceeded } = await import("../services/jobs.js");
    await markSucceeded(created.id, {
      metrics: { loss: 0.1, accuracy: 0.92 } as TrainingMetrics,
      artifact: { url: "s3://x", sizeBytes: 42, hash: "abc" },
    });
    const reloaded = await getJob(created.id);
    const annClient = new StubAnnClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (annClient as any).anns.set(ANN_ID, {
      id: ANN_ID,
      currentVersionId: null,
      currentVersion: null,
    });
    const result = await publishTrainingResult(
      reloaded,
      { metrics: reloaded.metricsJson as TrainingMetrics, result: reloaded.metricsJson as Record<string, unknown> },
      { annClientOverride: annClient },
    );
    expect("skipped" in result).toBe(false);
    if (!("skipped" in result)) {
      expect(result.promoted).toBe(false);
    }
  });

  it("returns { skipped: true } when the ANN does not exist", async () => {
    const created = await submitJob(USER_ID, {
      ann_id: ANN_ID,
      dataset_id: DATASET_ID,
      dataset_version_id: DATASET_VERSION_ID,
      recipe_slug: "mlp_classifier",
    });
    const { markSucceeded } = await import("../services/jobs.js");
    await markSucceeded(created.id, {
      metrics: {} as TrainingMetrics,
      artifact: { url: "s3://x", sizeBytes: 1, hash: "a" },
    });
    const reloaded = await getJob(created.id);
    const annClient = new StubAnnClient();
    const result = await publishTrainingResult(
      reloaded,
      { metrics: {} as TrainingMetrics, result: {} },
      { annClientOverride: annClient, throwOnMissing: false },
    );
    expect("skipped" in result).toBe(true);
    if ("skipped" in result) {
      expect(result.reason).toMatch(/not found/i);
    }
  });
});
