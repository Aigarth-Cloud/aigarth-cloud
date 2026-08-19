/**
 * Training recipes (Phase 19C.2).
 *
 * The recipe catalog is a small, closed set of built-in kinds.
 * `resolveRecipe` merges default hyperparams with user-supplied
 * overrides; `validateRecipeForDataset` is a guard against
 * mismatched recipe/dataset pairings.
 *
 * Per-recipe hyperparam schemas are defined inline because the
 * set is small and the surfaces are stable. A future v2 with
 * user-authored recipes will move these to a per-recipe lookup
 * table on disk.
 */

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { trainingRecipes, type TrainingRecipe, type TrainingRecipeKind } from "../db/schema.js";
import { TrainingInvalidRecipeError, TrainingNotFoundError } from "../lib/errors.js";

// ---------- Hyperparam schemas (one per recipe kind) ----------

const MlpHyperparamsSchema = z
  .object({
    lr: z.number().positive().optional(),
    batch_size: z.number().int().positive().optional(),
    epochs: z.number().int().positive().optional(),
    optimizer: z.enum(["adam", "sgd", "rmsprop"]).optional(),
    loss: z.string().min(1).optional(),
    hidden_units: z.array(z.number().int().positive()).optional(),
    dropout: z.number().min(0).max(1).optional(),
    metrics: z.array(z.string()).optional(),
  })
  .strict();

const CnnHyperparamsSchema = z
  .object({
    lr: z.number().positive().optional(),
    batch_size: z.number().int().positive().optional(),
    epochs: z.number().int().positive().optional(),
    optimizer: z.enum(["adam", "sgd", "rmsprop"]).optional(),
    loss: z.string().min(1).optional(),
    backbone: z.enum(["resnet50", "resnet18", "efficientnet_b0", "mobilenet_v2"]).optional(),
    image_size: z.number().int().positive().optional(),
    augmentation: z.boolean().optional(),
    metrics: z.array(z.string()).optional(),
  })
  .strict();

const TextHyperparamsSchema = z
  .object({
    lr: z.number().positive().optional(),
    batch_size: z.number().int().positive().optional(),
    epochs: z.number().int().positive().optional(),
    optimizer: z.enum(["adamw", "adam", "sgd"]).optional(),
    loss: z.string().min(1).optional(),
    backbone: z.string().min(1).optional(),
    max_seq_length: z.number().int().positive().optional(),
    warmup_steps: z.number().int().nonnegative().optional(),
    metrics: z.array(z.string()).optional(),
  })
  .strict();

const GradientBoostHyperparamsSchema = z
  .object({
    n_estimators: z.number().int().positive().optional(),
    learning_rate: z.number().positive().optional(),
    max_depth: z.number().int().positive().optional(),
    min_child_weight: z.number().nonnegative().optional(),
    subsample: z.number().min(0).max(1).optional(),
    colsample_bytree: z.number().min(0).max(1).optional(),
    objective: z.string().min(1).optional(),
    metrics: z.array(z.string()).optional(),
  })
  .strict();

const TrinaryHyperparamsSchema = z
  .object({
    lr: z.number().positive().optional(),
    batch_size: z.number().int().positive().optional(),
    epochs: z.number().int().positive().optional(),
    optimizer: z.enum(["adam", "sgd", "rmsprop"]).optional(),
    loss: z.string().min(1).optional(),
    states: z.array(z.union([z.literal(-1), z.literal(0), z.literal(1)])).optional(),
    authority_weight: z.number().min(0).max(1).optional(),
    confidence_threshold: z.number().min(0).max(1).optional(),
    metrics: z.array(z.string()).optional(),
  })
  .strict();

/** Per-kind schema lookup. Unknown kinds are rejected at resolve time. */
const HYPERPARAM_SCHEMAS: Record<TrainingRecipeKind, z.ZodTypeAny> = {
  mlp_classifier: MlpHyperparamsSchema,
  cnn_classifier: CnnHyperparamsSchema,
  text_classifier: TextHyperparamsSchema,
  gradient_boost_tabular: GradientBoostHyperparamsSchema,
  trinary_classifier: TrinaryHyperparamsSchema,
};

/**
 * Public override schema. This is what users POST to
 * `POST /v1/training/jobs`. We accept any subset of any recipe's
 * hyperparam keys — the actual per-kind validation runs in
 * `resolveRecipe` once the recipe kind is known.
 */
export const RecipeOverrideSchema = z.record(z.unknown());

export type RecipeOverride = z.infer<typeof RecipeOverrideSchema>;

// ---------- Reads ----------

export async function listRecipes(opts: { includeInactive?: boolean } = {}): Promise<TrainingRecipe[]> {
  const db = getDb();
  const base = db.select().from(trainingRecipes);
  const rows = opts.includeInactive
    ? await base
    : await base.where(eq(trainingRecipes.isActive, true));
  return rows;
}

export async function getRecipe(slugOrId: string): Promise<TrainingRecipe> {
  const db = getDb();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
  const [row] = isUuid
    ? await db.select().from(trainingRecipes).where(eq(trainingRecipes.id, slugOrId)).limit(1)
    : await db.select().from(trainingRecipes).where(eq(trainingRecipes.slug, slugOrId)).limit(1);
  if (!row) throw new TrainingNotFoundError(`Recipe '${slugOrId}'`);
  return row;
}

// ---------- Resolution + validation ----------

/**
 * Merge `defaultHyperparams` with `overrides`, returning a
 * fresh object. Throws TrainingInvalidRecipeError if the merged
 * result fails the recipe kind's hyperparam schema.
 *
 * The merge is shallow: each override key replaces the default
 * value outright. This is intentional — recipes expose a flat
 * hyperparam surface for v1.
 */
export function resolveRecipe(
  recipe: TrainingRecipe,
  overrides: RecipeOverride = {},
): Record<string, unknown> {
  const schema = HYPERPARAM_SCHEMAS[recipe.kind];
  if (!schema) {
    throw new TrainingInvalidRecipeError(`Unknown recipe kind '${recipe.kind}'.`);
  }
  // Allow callers to pass nothing, an empty object, or a partial.
  const parsedOverrides = RecipeOverrideSchema.safeParse(overrides);
  if (!parsedOverrides.success) {
    throw new TrainingInvalidRecipeError(
      `Invalid override payload: ${parsedOverrides.error.issues.map((i) => i.message).join("; ")}`,
    );
  }
  // Reject any override key that isn't a known hyperparam key.
  // Use the shape of the *schema* (not the defaults) so we
  // catch typos regardless of what defaults happen to look like.
  const allowedKeys = new Set(Object.keys((schema as z.ZodObject<z.ZodRawShape>).shape ?? {}));
  const unknownKeys = Object.keys(parsedOverrides.data).filter((k) => !allowedKeys.has(k));
  if (unknownKeys.length > 0) {
    throw new TrainingInvalidRecipeError(
      `Unknown hyperparam key(s) for recipe '${recipe.slug}': ${unknownKeys.join(", ")}`,
    );
  }
  const merged: Record<string, unknown> = {
    ...(recipe.defaultHyperparams as Record<string, unknown>),
    ...parsedOverrides.data,
  };
  // Final validation: the merged result must parse cleanly.
  const validated = schema.safeParse(merged);
  if (!validated.success) {
    throw new TrainingInvalidRecipeError(
      `Resolved hyperparams for recipe '${recipe.slug}' are invalid: ${validated.error.issues
        .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return validated.data as Record<string, unknown>;
}

/**
 * Guard against pairing a recipe with a dataset whose kind
 * isn't in the recipe's `supported_dataset_kinds` list.
 *
 * `datasetSchema` is the inferred schema from services/dataset.
 * We only need its `kind` field; pass any object that exposes it.
 */
export function validateRecipeForDataset(
  recipe: TrainingRecipe,
  datasetSchema: { kind: string } | null | undefined,
): void {
  if (!datasetSchema) {
    throw new TrainingInvalidRecipeError(
      `Dataset version has no inferred schema; cannot pair with recipe '${recipe.slug}'.`,
    );
  }
  const supported = recipe.supportedDatasetKinds ?? [];
  if (!supported.includes(datasetSchema.kind)) {
    throw new TrainingInvalidRecipeError(
      `Recipe '${recipe.slug}' does not support dataset kind '${datasetSchema.kind}' (supports: ${supported.join(", ")}).`,
    );
  }
}

// ---------- Type exports ----------

export type { TrainingRecipe };

/**
 * Re-export for the route layer to narrow the input shape when
 * callers post overrides without knowing the recipe kind.
 */
export { and, eq };
