/**
 * Training service — Drizzle schema (Phase 19C).
 *
 *   training_recipes          — built-in recipe catalog (mlp, cnn, transformer, etc.)
 *   training_jobs             — user-submitted training runs
 *   training_audit_logs       — service-local audit log
 *
 * Design notes:
 *   - All bigint columns omit defaults (drizzle-kit can't serialize BigInt literals).
 *   - All enum columns are prefixed with `training_` to avoid collision with
 *     other services' enums in the shared `public` schema.
 *   - Cross-service refs (ann_id, dataset_id, dataset_version_id, compute_job_id)
 *     are stored as uuid without FK to other services to avoid coupling schema
 *     across services.
 *   - The recipe catalog is closed (a few well-known kinds), so we use an enum
 *     for `kind` rather than free text. Custom recipes would land in a separate
 *     table in a v2.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  bigint,
  integer,
  boolean,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ---------- Enums ----------

/**
 * Built-in recipe kinds. Each kind pins a particular architecture
 * (MLP, CNN, transformer, gradient-boosted trees, Aigarth-native
 * trinary envelope) and a default hyperparam set.
 */
export const trainingRecipeKind = pgEnum("training_recipe_kind", [
  "mlp_classifier",
  "cnn_classifier",
  "text_classifier",
  "gradient_boost_tabular",
  "trinary_classifier",
]);

/**
 * State machine for a training job.
 *
 *   queued    -> preparing -> running -> succeeded | failed
 *                                    \\-> cancelled
 *
 * Only `queued` and `preparing` are user-cancellable; once a job
 * is `running` it has to finish or fail.
 */
export const trainingJobStatus = pgEnum("training_job_status", [
  "queued",
  "preparing",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

// ---------- training_recipes ----------

export const trainingRecipes = pgTable(
  "training_recipes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** URL-friendly identifier. Unique. */
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    /** The kind enum. Mirrors the table name in spirit. */
    kind: trainingRecipeKind("kind").notNull(),
    description: text("description"),
    /** Architecture family — e.g. "mlp", "cnn", "transformer", "gradient_boost". */
    architecture: text("architecture").notNull(),
    /**
     * Default hyperparameter set. The shape is recipe-kind-specific
     * (each kind's defaults live in a different zod schema). Stored
     * as jsonb so recipes can evolve without a migration.
     *
     * Example: `{ lr: 0.001, batch_size: 32, epochs: 10,
     *             optimizer: "adam", loss: "binary_crossentropy",
     *             metrics: ["accuracy"] }`
     */
    defaultHyperparams: jsonb("default_hyperparams")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    /**
     * Dataset kinds this recipe can train on. Free-form string
     * array (matches services/dataset.dataset_kind values:
     * "tabular", "text", "image", "audio", "time_series",
     * "multimodal", "other").
     */
    supportedDatasetKinds: jsonb("supported_dataset_kinds")
      .$type<string[]>()
      .notNull()
      .default([]),
    /**
     * What the produced artifact is. Examples:
     *   "ann_weights_v1"        — standard weight dump for anns/ann_versions
     *   "ann_trinary_envelope"  — Aigarth-native 3-state envelope
     *   "tabular_regressor"     — gradient-boosted trees pickle
     */
    outputArtifactKind: text("output_artifact_kind").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex("training_recipes_slug_idx").on(t.slug),
    kindIdx: index("training_recipes_kind_idx").on(t.kind),
    activeIdx: index("training_recipes_active_idx").on(t.isActive),
  }),
);

// ---------- training_jobs ----------

export const trainingJobs = pgTable(
  "training_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Target ANN id (cross-service ref to services/ann). */
    annId: uuid("ann_id").notNull(),
    /** Dataset id (cross-service ref to services/dataset). */
    datasetId: uuid("dataset_id").notNull(),
    /** Specific dataset version id (cross-service ref). */
    datasetVersionId: uuid("dataset_version_id").notNull(),
    /** Recipe used (FK within this service). */
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => trainingRecipes.id, { onDelete: "restrict" }),
    /**
     * Frozen snapshot of the recipe's identity at submit time.
     * Lets the job display a stable name even if the recipe is
     * later renamed or deactivated.
     */
    recipeJson: jsonb("recipe_json")
      .$type<{ slug: string; name: string; kind: string; architecture: string }>()
      .notNull(),
    /**
     * Resolved hyperparams (defaults + user overrides merged).
     * Source of truth for the actual training run config.
     */
    hyperparams: jsonb("hyperparams")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    status: trainingJobStatus("status").notNull().default("queued"),
    /** Cross-service ref to services/compute. Set after the worker calls allocate(). */
    computeJobId: uuid("compute_job_id"),
    /**
     * Latest progress snapshot, shaped:
     *   { epoch, total_epochs, loss, val_loss, accuracy, val_accuracy, eta_seconds }
     * Updated by the worker on each tick. Also published to NATS.
     */
    progressJson: jsonb("progress_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    /** Final metrics on success. Same shape as progress.metrics but frozen. */
    metricsJson: jsonb("metrics_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    errorMessage: text("error_message"),
    /** S3 path of the trained artifact. v1 stores synthetic metrics JSON here. */
    artifactUrl: text("artifact_url"),
    artifactSizeBytes: bigint("artifact_size_bytes", { mode: "number" }),
    /** sha256 of the artifact for integrity verification. */
    artifactHash: text("artifact_hash"),
    /**
     * If true, on success the worker calls
     * `annClient.createVersion` (and `promoteVersion` if isLatest
     * isn't already set). Defaults to false so callers opt in.
     */
    autoPublish: boolean("auto_publish").notNull().default(false),
    /** User who submitted the job. */
    submittedBy: uuid("submitted_by").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    annIdx: index("training_jobs_ann_idx").on(t.annId),
    userIdx: index("training_jobs_user_idx").on(t.submittedBy),
    statusIdx: index("training_jobs_status_idx").on(t.status),
    recipeIdx: index("training_jobs_recipe_idx").on(t.recipeId),
    submittedIdx: index("training_jobs_submitted_idx").on(t.submittedAt),
    computeJobIdx: index("training_jobs_compute_job_idx").on(t.computeJobId),
  }),
);

// ---------- training_audit_logs ----------

export const trainingAuditLogs = pgTable("training_audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  action: text("action").notNull(),
  actorUserId: uuid("actor_user_id"),
  orgId: uuid("org_id"),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Types ----------

export type TrainingRecipe = typeof trainingRecipes.$inferSelect;
export type NewTrainingRecipe = typeof trainingRecipes.$inferInsert;
export type TrainingJob = typeof trainingJobs.$inferSelect;
export type NewTrainingJob = typeof trainingJobs.$inferInsert;
export type TrainingAuditLog = typeof trainingAuditLogs.$inferSelect;
export type NewTrainingAuditLog = typeof trainingAuditLogs.$inferInsert;

export type TrainingRecipeKind = (typeof trainingRecipeKind.enumValues)[number];
export type TrainingJobStatus = (typeof trainingJobStatus.enumValues)[number];

/** Type of the progress snapshot stored in training_jobs.progressJson. */
export interface TrainingProgressSnapshot {
  epoch?: number;
  total_epochs?: number;
  loss?: number;
  val_loss?: number;
  accuracy?: number;
  val_accuracy?: number;
  eta_seconds?: number;
  [k: string]: unknown;
}

/** Type of the metrics stored in training_jobs.metricsJson. */
export interface TrainingMetrics {
  loss?: number;
  val_loss?: number;
  accuracy?: number;
  val_accuracy?: number;
  [k: string]: unknown;
}

/** SSE progress event payload (also published to NATS). */
export interface TrainingProgress {
  jobId: string;
  status: TrainingJobStatus;
  progress: TrainingProgressSnapshot;
  metrics: TrainingMetrics;
  ts: Date;
}
