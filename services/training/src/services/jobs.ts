/**
 * Training jobs (Phase 19C.2).
 *
 * Public API:
 *   - submitJob(callerUserId, input)        — create a row, status=queued
 *   - getJob(idOrSlug)                      — fetch by id
 *   - listJobs(query)                       — paginated, filterable
 *   - cancelJob(callerUserId, idOrSlug)     — user-facing; queued/preparing only
 *   - updateProgress(id, progress)          — worker-only
 *   - markSucceeded(id, { metrics, artifact }) — worker-only
 *   - markFailed(id, errorMessage)          — worker-only
 *
 * State machine (caller-facing):
 *   queued   -> preparing -> running -> succeeded | failed
 *                                  \-> cancelled
 *
 * The worker is the only writer for `preparing`, `running`, and
 * the terminal states. The HTTP API writes `queued` and
 * `cancelled`; everything else goes through the worker.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import {
  trainingJobs,
  type TrainingJob,
  type NewTrainingJob,
  type TrainingJobStatus,
  type TrainingProgressSnapshot,
  type TrainingMetrics,
} from "../db/schema.js";
import { uid } from "../lib/ids.js";
import { logActivity, auditAction } from "../lib/audit.js";
import { TrainingConflictError, TrainingNotFoundError } from "../lib/errors.js";
import { getRecipe, resolveRecipe, validateRecipeForDataset, type RecipeOverride } from "./recipes.js";

// ---------- Schemas ----------

export const TrainingJobStatusSchema = z.enum([
  "queued",
  "preparing",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

export const SubmitJobSchema = z.object({
  ann_id: z.string().uuid(),
  dataset_id: z.string().uuid(),
  dataset_version_id: z.string().uuid(),
  recipe_slug: z.string().min(1).max(120),
  /** Partial hyperparam overrides; merged with the recipe's defaults. */
  recipe_overrides: z.record(z.unknown()).optional(),
  /** If true, the worker calls annClient.createVersion on success. */
  auto_publish: z.boolean().optional().default(false),
  /**
   * Optional pre-fetched dataset schema (the services/dataset
   * DatasetSchema type's `kind` field). If omitted, the
   * validateRecipeForDataset guard is skipped (a future v2 may
   * cross-fetch it). We accept it as an optional field to keep
   * the service self-contained for v1.
   */
  dataset_kind: z.string().min(1).optional(),
});
export type SubmitJobInput = z.infer<typeof SubmitJobSchema>;

export const ListJobsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  status: TrainingJobStatusSchema.optional(),
  ann_id: z.string().uuid().optional(),
  /** Restrict to jobs submitted by the given user. Optional. */
  user_id: z.string().uuid().optional(),
  sort: z.enum(["newest", "oldest"]).default("newest"),
});
export type ListJobsQuery = z.infer<typeof ListJobsQuerySchema>;

// ---------- Errors ----------

export class TrainingJobNotFoundError extends TrainingNotFoundError {
  constructor(idOrSlug: string) {
    super(`Training job '${idOrSlug}'`);
  }
}

export class TrainingJobConflictError extends TrainingConflictError {}

// ---------- Submission ----------

export async function submitJob(
  callerUserId: string,
  input: SubmitJobInput,
): Promise<TrainingJob> {
  const db = getDb();
  const recipe = await getRecipe(input.recipe_slug);
  if (!recipe.isActive) {
    throw new TrainingInvalidRecipeErrorLocal(`Recipe '${recipe.slug}' is not active.`);
  }

  // Resolve hyperparams (defaults + overrides) and validate the
  // recipe for the dataset kind, if provided.
  const hyperparams = resolveRecipe(recipe, (input.recipe_overrides ?? {}) as RecipeOverride);
  if (input.dataset_kind) {
    validateRecipeForDataset(recipe, { kind: input.dataset_kind });
  }

  const id = uid();
  const now = new Date();
  const row: NewTrainingJob = {
    id,
    annId: input.ann_id,
    datasetId: input.dataset_id,
    datasetVersionId: input.dataset_version_id,
    recipeId: recipe.id,
    recipeJson: {
      slug: recipe.slug,
      name: recipe.name,
      kind: recipe.kind,
      architecture: recipe.architecture,
    },
    hyperparams,
    status: "queued",
    progressJson: {},
    metricsJson: {},
    autoPublish: input.auto_publish,
    submittedBy: callerUserId,
    submittedAt: now,
  };

  await db.insert(trainingJobs).values(row);
  await logActivity(db, {
    action: auditAction.trainingJobSubmitted,
    actorUserId: callerUserId,
    targetType: "training_job",
    targetId: id,
    metadata: {
      ann_id: input.ann_id,
      dataset_id: input.dataset_id,
      dataset_version_id: input.dataset_version_id,
      recipe_slug: recipe.slug,
      auto_publish: input.auto_publish,
    },
  });

  const [created] = await db.select().from(trainingJobs).where(eq(trainingJobs.id, id)).limit(1);
  if (!created) throw new Error("Training job creation succeeded but row not found");
  return created;
}

// ---------- Reads ----------

export async function getJob(idOrSlug: string): Promise<TrainingJob> {
  const db = getDb();
  // Jobs are only addressable by id (no public slug in v1).
  const [row] = await db.select().from(trainingJobs).where(eq(trainingJobs.id, idOrSlug)).limit(1);
  if (!row) throw new TrainingJobNotFoundError(idOrSlug);
  return row;
}

export async function listJobs(query: ListJobsQuery): Promise<{
  data: TrainingJob[];
  total: number;
  limit: number;
  offset: number;
}> {
  const db = getDb();
  const conditions = [];
  if (query.status) conditions.push(eq(trainingJobs.status, query.status));
  if (query.ann_id) conditions.push(eq(trainingJobs.annId, query.ann_id));
  if (query.user_id) conditions.push(eq(trainingJobs.submittedBy, query.user_id));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const orderBy = query.sort === "oldest" ? trainingJobs.submittedAt : desc(trainingJobs.submittedAt);

  const rows = await db
    .select()
    .from(trainingJobs)
    .where(where)
    .orderBy(orderBy)
    .limit(query.limit)
    .offset(query.offset);

  const totalRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(trainingJobs)
    .where(where);
  const total = totalRow[0]?.count ?? 0;

  return { data: rows, total, limit: query.limit, offset: query.offset };
}

// ---------- User-facing mutations ----------

/**
 * User-initiated cancel. Allowed only while the job is still in
 * a pre-run state (queued or preparing). Once running, the
 * caller must wait for terminal state or the deadline.
 */
export async function cancelJob(callerUserId: string, idOrSlug: string): Promise<TrainingJob> {
  const db = getDb();
  const existing = await getJob(idOrSlug);

  if (existing.submittedBy !== callerUserId) {
    // Service-local rule: only the submitter can cancel. (Admins
    // could be added later via TRAINING_ADMIN_USER_IDS.)
    throw new TrainingJobConflictError("Only the submitter can cancel this training job.");
  }
  if (existing.status === "cancelled") {
    return existing;
  }
  if (!isCancellable(existing.status)) {
    throw new TrainingJobConflictError(
      `Cannot cancel a job in status '${existing.status}' (only queued/preparing are cancellable).`,
    );
  }

  const now = new Date();
  await db
    .update(trainingJobs)
    .set({ status: "cancelled", finishedAt: now, updatedAt: now })
    .where(eq(trainingJobs.id, existing.id));

  await logActivity(db, {
    action: auditAction.trainingJobCancelled,
    actorUserId: callerUserId,
    targetType: "training_job",
    targetId: existing.id,
    metadata: { from: existing.status },
  });

  const [updated] = await db.select().from(trainingJobs).where(eq(trainingJobs.id, existing.id)).limit(1);
  if (!updated) throw new TrainingJobNotFoundError(idOrSlug);
  return updated;
}

function isCancellable(status: TrainingJobStatus): boolean {
  return status === "queued" || status === "preparing";
}

// ---------- Worker-only mutations ----------

/**
 * Pick the oldest queued job and transition it to `preparing`.
 * Returns null if no job was claimed.
 *
 * v1 uses a single in-process worker, so a plain select-then-
 * update is sufficient to prevent double-claim within one
 * process. The v2 horizontal scale story adds `FOR UPDATE
 * SKIP LOCKED`; for now the comment is left in place to mark
 * the upgrade path.
 */
export async function claimNextQueuedJob(): Promise<TrainingJob | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(trainingJobs)
    .where(eq(trainingJobs.status, "queued"))
    .orderBy(trainingJobs.submittedAt)
    .limit(1);
  if (!row) return null;
  const now = new Date();
  await db
    .update(trainingJobs)
    .set({ status: "preparing", startedAt: now, updatedAt: now })
    .where(eq(trainingJobs.id, row.id));
  const [updated] = await db.select().from(trainingJobs).where(eq(trainingJobs.id, row.id)).limit(1);
  return updated ?? null;
}

export async function updateProgress(
  id: string,
  progress: TrainingProgressSnapshot,
): Promise<void> {
  const db = getDb();
  await db
    .update(trainingJobs)
    .set({ progressJson: progress as Record<string, unknown>, updatedAt: new Date() })
    .where(eq(trainingJobs.id, id));
}

export async function markRunning(id: string): Promise<void> {
  const db = getDb();
  await db
    .update(trainingJobs)
    .set({ status: "running", startedAt: new Date(), updatedAt: new Date() })
    .where(eq(trainingJobs.id, id));
}

export async function markSucceeded(
  id: string,
  args: {
    metrics: TrainingMetrics;
    artifact: { url: string; sizeBytes: number; hash: string };
  },
): Promise<TrainingJob> {
  const db = getDb();
  const now = new Date();
  await db
    .update(trainingJobs)
    .set({
      status: "succeeded",
      metricsJson: args.metrics as Record<string, unknown>,
      artifactUrl: args.artifact.url,
      artifactSizeBytes: args.artifact.sizeBytes,
      artifactHash: args.artifact.hash,
      progressJson: { ...(args.metrics as Record<string, unknown>) },
      finishedAt: now,
      updatedAt: now,
    })
    .where(eq(trainingJobs.id, id));
  await logActivity(db, {
    action: auditAction.trainingJobSucceeded,
    targetType: "training_job",
    targetId: id,
    metadata: { metrics: args.metrics, artifact_url: args.artifact.url },
  });
  const [updated] = await db.select().from(trainingJobs).where(eq(trainingJobs.id, id)).limit(1);
  if (!updated) throw new TrainingJobNotFoundError(id);
  return updated;
}

export async function markFailed(id: string, errorMessage: string): Promise<TrainingJob> {
  const db = getDb();
  const now = new Date();
  await db
    .update(trainingJobs)
    .set({ status: "failed", errorMessage, finishedAt: now, updatedAt: now })
    .where(eq(trainingJobs.id, id));
  await logActivity(db, {
    action: auditAction.trainingJobFailed,
    targetType: "training_job",
    targetId: id,
    metadata: { error_message: errorMessage },
  });
  const [updated] = await db.select().from(trainingJobs).where(eq(trainingJobs.id, id)).limit(1);
  if (!updated) throw new TrainingJobNotFoundError(id);
  return updated;
}

export async function setComputeJobId(id: string, computeJobId: string): Promise<void> {
  const db = getDb();
  await db
    .update(trainingJobs)
    .set({ computeJobId, updatedAt: new Date() })
    .where(eq(trainingJobs.id, id));
}

// ---------- Local error alias ----------

// We use the lib error class but export a local alias so route
// files can import a single name and not have to know about the
// `lib/errors.ts` re-export path.
import { TrainingInvalidRecipeError as TrainingInvalidRecipeErrorLocal } from "../lib/errors.js";
