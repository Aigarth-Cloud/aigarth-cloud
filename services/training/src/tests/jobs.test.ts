/**
 * Tests for the jobs service (Phase 19C.2).
 *
 * The DB is mocked at the drizzle layer. We use a Map-backed
 * fake that supports the small subset of operations the jobs
 * service performs. To make `where(eq(...))` actually filter,
 * we parse drizzle's SQL chunk tree to extract column+value
 * pairs. The chunk tree is the same shape for `eq`, `and`,
 * `or`, `ilike`, etc. — so this works for all the service's
 * queries without per-query hardcoding.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  trainingRecipes,
  trainingJobs,
  trainingAuditLogs,
  type TrainingRecipe,
  type TrainingJob,
} from "../db/schema.js";

// ---------- Mock the DB ----------

interface Store {
  recipes: Map<string, TrainingRecipe>;
  jobs: Map<string, TrainingJob>;
}

const store: Store = { recipes: new Map(), jobs: new Map() };

const DRIZZLE_NAME = Symbol.for("drizzle:Name");

/** Extract the table name from a pgTable object via the drizzle:Name symbol. */
function tableName(t: unknown): string | undefined {
  if (t && typeof t === "object" && DRIZZLE_NAME in t) {
    return (t as Record<symbol, string>)[DRIZZLE_NAME];
  }
  return undefined;
}

/**
 * Walk a drizzle SQL object's queryChunks and collect every
 * (columnName, value) pair. Drizzle's `eq` lays out chunks as:
 *   StringChunk, PgCol(name=...), StringChunk(" = "), Param(value), StringChunk
 * So after a column chunk we skip any string chunks and look
 * for the next `Param`.
 */
function extractConditions(cond: unknown): Array<{ column: string; value: unknown }> {
  const out: Array<{ column: string; value: unknown }> = [];
  if (!cond || typeof cond !== "object") return out;
  const sqlObj = cond as { queryChunks?: unknown[] };
  const chunks = sqlObj.queryChunks ?? [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i] as { constructor?: { name?: string }; name?: string; queryChunks?: unknown[]; value?: unknown };
    if (!chunk) continue;
    if (chunk.constructor?.name === "SQL") {
      out.push(...extractConditions(chunk));
      continue;
    }
    if (typeof chunk.name === "string" && chunk.constructor?.name?.startsWith("Pg")) {
      // Walk forward to find the next Param.
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

/** Translate a snake_case column name to its camelCase schema key. */
function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/** Apply a list of (column, value) conditions to a row, ANDing them.
 *  Drizzle's `eq()` uses the underlying snake_case column name from
 *  the DB, but our store uses the camelCase keys from the Drizzle
 *  inferred types. Translate the column before comparing. */
function matches(row: Record<string, unknown>, conds: Array<{ column: string; value: unknown }>): boolean {
  for (const c of conds) {
    const camelCol = snakeToCamel(c.column);
    if (row[camelCol] !== c.value) return false;
  }
  return true;
}

// Minimal drizzle-like chainable that knows how to filter.
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
  // Make awaitable: `await db.select()...`
  Object.defineProperty(chain, "then", {
    get() {
      return (resolve: (r: unknown) => void) => resolve(filteredRows);
    },
  });
  return chain;
}

/** Count query: returns `[{ count: N }]`. */
function makeCountChain(name: string | undefined, _table: unknown) {
  const sourceRows = name === "training_jobs"
    ? Array.from(store.jobs.values())
    : name === "training_recipes"
    ? Array.from(store.recipes.values())
    : [];
  let filteredRows = sourceRows;
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = (cond: unknown) => {
    const conds = extractConditions(cond);
    if (conds.length === 0) return chain;
    filteredRows = filteredRows.filter((r) => matches(r as unknown as Record<string, unknown>, conds));
    return chain;
  };
  Object.defineProperty(chain, "then", {
    get() {
      return (resolve: (r: unknown) => void) => resolve([{ count: filteredRows.length }]);
    },
  });
  return chain;
}

vi.mock("../db/index.js", () => {
  return {
    getDb: () => ({
      select: (selectArg?: unknown) => ({
        from: (table: unknown) => {
          const name = tableName(table);
          // Count query: `db.select({ count: sql<number>... })`.
          // The argument is an object with a `count` key.
          if (selectArg && typeof selectArg === "object" && "count" in (selectArg as Record<string, unknown>)) {
            return makeCountChain(name, table);
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
  };
});

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
    TRAINING_WORKER_INTERVAL_MS: 2000,
    TRAINING_PROGRESS_TICK_MS: 2000,
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

import {
  submitJob,
  getJob,
  listJobs,
  cancelJob,
  markSucceeded,
  markFailed,
  claimNextQueuedJob,
  TrainingJobNotFoundError,
  TrainingJobConflictError,
} from "../services/jobs.js";

describe("jobs service", () => {
  beforeEach(() => {
    store.recipes.clear();
    store.jobs.clear();
    store.recipes.set(RECIPE_ID, makeRecipe());
  });

  it("submitJob creates a row with status=queued", async () => {
    const created = await submitJob(USER_ID, {
      ann_id: ANN_ID,
      dataset_id: DATASET_ID,
      dataset_version_id: DATASET_VERSION_ID,
      recipe_slug: "mlp_classifier",
      auto_publish: false,
    });
    expect(created.status).toBe("queued");
    expect(created.submittedBy).toBe(USER_ID);
    expect(created.annId).toBe(ANN_ID);
    expect(created.datasetId).toBe(DATASET_ID);
    expect(created.datasetVersionId).toBe(DATASET_VERSION_ID);
    expect(created.recipeId).toBe(RECIPE_ID);
    expect(created.hyperparams).toMatchObject({ lr: 0.001, batch_size: 32 });
    expect(created.autoPublish).toBe(false);
    expect(created.recipeJson).toMatchObject({
      slug: "mlp_classifier",
      kind: "mlp_classifier",
    });
  });

  it("submitJob rejects an invalid recipe slug", async () => {
    await expect(
      submitJob(USER_ID, {
        ann_id: ANN_ID,
        dataset_id: DATASET_ID,
        dataset_version_id: DATASET_VERSION_ID,
        recipe_slug: "nonexistent_recipe",
        auto_publish: false,
      }),
    ).rejects.toThrow(/not found|recipe/i);
  });

  it("submitJob rejects overrides that produce invalid hyperparams", async () => {
    await expect(
      submitJob(USER_ID, {
        ann_id: ANN_ID,
        dataset_id: DATASET_ID,
        dataset_version_id: DATASET_VERSION_ID,
        recipe_slug: "mlp_classifier",
        recipe_overrides: { lr: -1 },
        auto_publish: false,
      }),
    ).rejects.toThrow();
  });

  it("getJob returns the job by id", async () => {
    const created = await submitJob(USER_ID, {
      ann_id: ANN_ID,
      dataset_id: DATASET_ID,
      dataset_version_id: DATASET_VERSION_ID,
      recipe_slug: "mlp_classifier",
    });
    const fetched = await getJob(created.id);
    expect(fetched.id).toBe(created.id);
  });

  it("getJob throws TrainingJobNotFoundError for unknown ids", async () => {
    await expect(getJob("00000000-0000-0000-0000-000000000000")).rejects.toBeInstanceOf(
      TrainingJobNotFoundError,
    );
  });

  it("cancelJob sets status=cancelled when queued", async () => {
    const created = await submitJob(USER_ID, {
      ann_id: ANN_ID,
      dataset_id: DATASET_ID,
      dataset_version_id: DATASET_VERSION_ID,
      recipe_slug: "mlp_classifier",
    });
    const cancelled = await cancelJob(USER_ID, created.id);
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.finishedAt).toBeInstanceOf(Date);
  });

  it("cancelJob is idempotent on already-cancelled jobs", async () => {
    const created = await submitJob(USER_ID, {
      ann_id: ANN_ID,
      dataset_id: DATASET_ID,
      dataset_version_id: DATASET_VERSION_ID,
      recipe_slug: "mlp_classifier",
    });
    await cancelJob(USER_ID, created.id);
    const again = await cancelJob(USER_ID, created.id);
    expect(again.status).toBe("cancelled");
  });

  it("cancelJob rejects jobs that are already running", async () => {
    const created = await submitJob(USER_ID, {
      ann_id: ANN_ID,
      dataset_id: DATASET_ID,
      dataset_version_id: DATASET_VERSION_ID,
      recipe_slug: "mlp_classifier",
    });
    const row = store.jobs.get(created.id);
    if (row) row.status = "running";
    await expect(cancelJob(USER_ID, created.id)).rejects.toBeInstanceOf(TrainingJobConflictError);
  });

  it("cancelJob rejects jobs from other users", async () => {
    const created = await submitJob(USER_ID, {
      ann_id: ANN_ID,
      dataset_id: DATASET_ID,
      dataset_version_id: DATASET_VERSION_ID,
      recipe_slug: "mlp_classifier",
    });
    const OTHER = "99999999-9999-9999-9999-999999999999";
    await expect(cancelJob(OTHER, created.id)).rejects.toBeInstanceOf(TrainingJobConflictError);
  });

  it("markSucceeded updates the row with metrics and artifact", async () => {
    const created = await submitJob(USER_ID, {
      ann_id: ANN_ID,
      dataset_id: DATASET_ID,
      dataset_version_id: DATASET_VERSION_ID,
      recipe_slug: "mlp_classifier",
    });
    const updated = await markSucceeded(created.id, {
      metrics: { loss: 0.1, accuracy: 0.92 },
      artifact: { url: "s3://x", sizeBytes: 42, hash: "abc" },
    });
    expect(updated.status).toBe("succeeded");
    expect(updated.metricsJson).toMatchObject({ loss: 0.1, accuracy: 0.92 });
    expect(updated.artifactUrl).toBe("s3://x");
    expect(updated.artifactSizeBytes).toBe(42);
    expect(updated.artifactHash).toBe("abc");
  });

  it("markFailed updates the row with the error message", async () => {
    const created = await submitJob(USER_ID, {
      ann_id: ANN_ID,
      dataset_id: DATASET_ID,
      dataset_version_id: DATASET_VERSION_ID,
      recipe_slug: "mlp_classifier",
    });
    const updated = await markFailed(created.id, "compute_oom");
    expect(updated.status).toBe("failed");
    expect(updated.errorMessage).toBe("compute_oom");
    expect(updated.finishedAt).toBeInstanceOf(Date);
  });

  it("claimNextQueuedJob picks the oldest queued job and transitions to preparing", async () => {
    const first = await submitJob(USER_ID, {
      ann_id: ANN_ID,
      dataset_id: DATASET_ID,
      dataset_version_id: DATASET_VERSION_ID,
      recipe_slug: "mlp_classifier",
    });
    await new Promise((r) => setTimeout(r, 5));
    const second = await submitJob(USER_ID, {
      ann_id: ANN_ID,
      dataset_id: DATASET_ID,
      dataset_version_id: DATASET_VERSION_ID,
      recipe_slug: "mlp_classifier",
    });
    const claimed = await claimNextQueuedJob();
    expect(claimed).not.toBeNull();
    expect(claimed?.id).toBe(first.id);
    expect(claimed?.status).toBe("preparing");
    expect(second.status).toBe("queued");
  });

  it("listJobs filters by user_id and paginates", async () => {
    await submitJob(USER_ID, {
      ann_id: ANN_ID,
      dataset_id: DATASET_ID,
      dataset_version_id: DATASET_VERSION_ID,
      recipe_slug: "mlp_classifier",
    });
    await submitJob(USER_ID, {
      ann_id: ANN_ID,
      dataset_id: DATASET_ID,
      dataset_version_id: DATASET_VERSION_ID,
      recipe_slug: "mlp_classifier",
    });
    const result = await listJobs({ user_id: USER_ID, limit: 10, offset: 0, sort: "newest" });
    expect(result.data.length).toBe(2);
    expect(result.total).toBe(2);
  });
});
