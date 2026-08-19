/**
 * Seed script — Phase 19C.2.
 *
 * Upserts the 5 built-in recipes:
 *   - mlp_classifier
 *   - cnn_classifier
 *   - text_classifier
 *   - gradient_boost_tabular
 *   - trinary_classifier
 *
 * Idempotent: safe to run multiple times. Updates name/description
 * in place but never deletes user-customized recipes (this script
 * only touches the 5 slugs above).
 */

import { eq, inArray } from "drizzle-orm";
import { closeDb, getDb } from "./index.js";
import { trainingRecipes } from "./schema.js";

interface SeedRecipe {
  slug: string;
  name: string;
  kind: "mlp_classifier" | "cnn_classifier" | "text_classifier" | "gradient_boost_tabular" | "trinary_classifier";
  description: string;
  architecture: string;
  defaultHyperparams: Record<string, unknown>;
  supportedDatasetKinds: string[];
  outputArtifactKind: string;
}

const BUILTIN_RECIPES: SeedRecipe[] = [
  {
    slug: "mlp_classifier",
    name: "MLP Classifier",
    kind: "mlp_classifier",
    description:
      "Multi-layer perceptron for tabular classification. Good baseline for small-to-medium feature sets.",
    architecture: "mlp",
    defaultHyperparams: {
      lr: 0.001,
      batch_size: 32,
      epochs: 10,
      optimizer: "adam",
      loss: "binary_crossentropy",
      hidden_units: [128, 64],
      dropout: 0.2,
      metrics: ["accuracy"],
    },
    supportedDatasetKinds: ["tabular"],
    outputArtifactKind: "ann_weights_v1",
  },
  {
    slug: "cnn_classifier",
    name: "CNN Image Classifier",
    kind: "cnn_classifier",
    description:
      "Convolutional neural network for image classification. Pretrained backbone fine-tuned on the dataset.",
    architecture: "cnn",
    defaultHyperparams: {
      lr: 0.0001,
      batch_size: 16,
      epochs: 20,
      optimizer: "adam",
      loss: "categorical_crossentropy",
      backbone: "resnet50",
      image_size: 224,
      augmentation: true,
      metrics: ["accuracy", "top_k_categorical_accuracy"],
    },
    supportedDatasetKinds: ["image"],
    outputArtifactKind: "ann_weights_v1",
  },
  {
    slug: "text_classifier",
    name: "Transformer Text Classifier",
    kind: "text_classifier",
    description:
      "Transformer-based text classifier. Default backbone is a small encoder pretrained on a multilingual corpus.",
    architecture: "transformer",
    defaultHyperparams: {
      lr: 2e-5,
      batch_size: 16,
      epochs: 5,
      optimizer: "adamw",
      loss: "sparse_categorical_crossentropy",
      backbone: "bert-base-multilingual",
      max_seq_length: 256,
      warmup_steps: 500,
      metrics: ["accuracy"],
    },
    supportedDatasetKinds: ["text"],
    outputArtifactKind: "ann_weights_v1",
  },
  {
    slug: "gradient_boost_tabular",
    name: "Gradient Boosted Trees (Tabular)",
    kind: "gradient_boost_tabular",
    description:
      "Gradient-boosted trees for tabular regression and classification. Fast to train, strong on small datasets.",
    architecture: "gradient_boost",
    defaultHyperparams: {
      n_estimators: 500,
      learning_rate: 0.05,
      max_depth: 6,
      min_child_weight: 1,
      subsample: 0.8,
      colsample_bytree: 0.8,
      objective: "binary:logistic",
      metrics: ["accuracy", "auc"],
    },
    supportedDatasetKinds: ["tabular"],
    outputArtifactKind: "tabular_regressor",
  },
  {
    slug: "trinary_classifier",
    name: "Aigarth Trinary Envelope Classifier",
    kind: "trinary_classifier",
    description:
      "Aigarth-native 3-state envelope classifier. Outputs -1, 0, or +1 with confidence, authority, and reasoning. "
      + "Aligns with the @aigarth/trinary IntentEnvelope format used across the platform.",
    architecture: "trinary",
    defaultHyperparams: {
      lr: 0.0005,
      batch_size: 32,
      epochs: 15,
      optimizer: "adam",
      loss: "trinary_categorical_crossentropy",
      states: [-1, 0, 1],
      authority_weight: 0.5,
      confidence_threshold: 0.6,
      metrics: ["accuracy", "trinary_state_accuracy"],
    },
    supportedDatasetKinds: ["tabular", "text"],
    outputArtifactKind: "ann_trinary_envelope",
  },
];

async function main() {
  const db = getDb();
  // eslint-disable-next-line no-console
  console.log(`[training] seeding ${BUILTIN_RECIPES.length} built-in recipes`);

  // Fetch any existing rows for these slugs in one query so we can
  // decide insert vs. update per recipe.
  const slugs = BUILTIN_RECIPES.map((r) => r.slug);
  const existing = await db
    .select({ id: trainingRecipes.id, slug: trainingRecipes.slug })
    .from(trainingRecipes)
    .where(inArray(trainingRecipes.slug, slugs));
  const existingBySlug = new Map(existing.map((r) => [r.slug, r.id]));

  let inserted = 0;
  let updated = 0;
  for (const r of BUILTIN_RECIPES) {
    const now = new Date();
    const existingId = existingBySlug.get(r.slug);
    if (existingId) {
      await db
        .update(trainingRecipes)
        .set({
          name: r.name,
          kind: r.kind,
          description: r.description,
          architecture: r.architecture,
          defaultHyperparams: r.defaultHyperparams,
          supportedDatasetKinds: r.supportedDatasetKinds,
          outputArtifactKind: r.outputArtifactKind,
          isActive: true,
          updatedAt: now,
        })
        .where(eq(trainingRecipes.id, existingId));
      updated += 1;
    } else {
      await db.insert(trainingRecipes).values({
        slug: r.slug,
        name: r.name,
        kind: r.kind,
        description: r.description,
        architecture: r.architecture,
        defaultHyperparams: r.defaultHyperparams,
        supportedDatasetKinds: r.supportedDatasetKinds,
        outputArtifactKind: r.outputArtifactKind,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      inserted += 1;
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `[training] seed complete: ${inserted} inserted, ${updated} updated, ${BUILTIN_RECIPES.length - inserted - updated} unchanged`,
  );
  await closeDb();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[training] seed FAILED:", err);
  closeDb().finally(() => process.exit(1));
});
