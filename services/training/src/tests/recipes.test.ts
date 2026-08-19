/**
 * Tests for the recipe service (Phase 19C.2).
 *
 * Pure unit tests — no DB, no I/O. The functions under test
 * (`resolveRecipe`, `validateRecipeForDataset`) take a
 * `TrainingRecipe` value object and return merged/validated
 * data. We build a synthetic recipe in-memory and exercise
 * the surfaces.
 */

import { describe, it, expect } from "vitest";
import {
  resolveRecipe,
  validateRecipeForDataset,
  RecipeOverrideSchema,
} from "../services/recipes.js";
import { TrainingInvalidRecipeError } from "../lib/errors.js";
import type { TrainingRecipe } from "../db/schema.js";

function makeRecipe(overrides: Partial<TrainingRecipe> = {}): TrainingRecipe {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    slug: "mlp_classifier",
    name: "MLP Classifier",
    kind: "mlp_classifier",
    description: "Test MLP",
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
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as TrainingRecipe;
}

describe("resolveRecipe", () => {
  it("merges defaults with overrides", () => {
    const recipe = makeRecipe();
    const merged = resolveRecipe(recipe, { lr: 0.01, epochs: 25 });
    expect(merged.lr).toBe(0.01);
    expect(merged.epochs).toBe(25);
    // Untouched defaults should remain.
    expect(merged.batch_size).toBe(32);
    expect(merged.optimizer).toBe("adam");
  });

  it("returns defaults when no overrides are provided", () => {
    const recipe = makeRecipe();
    const merged = resolveRecipe(recipe);
    expect(merged.lr).toBe(0.001);
    expect(merged.batch_size).toBe(32);
    expect(merged.epochs).toBe(10);
  });

  it("returns defaults when overrides is an empty object", () => {
    const recipe = makeRecipe();
    const merged = resolveRecipe(recipe, {});
    expect(merged.lr).toBe(0.001);
  });

  it("rejects overrides with unknown hyperparam keys", () => {
    const recipe = makeRecipe();
    expect(() => resolveRecipe(recipe, { n_epochs: 50 })).toThrow(TrainingInvalidRecipeError);
    expect(() => resolveRecipe(recipe, { n_epochs: 50 })).toThrow(/n_epochs/);
  });

  it("rejects overrides that produce invalid values", () => {
    const recipe = makeRecipe();
    // lr must be positive per the schema.
    expect(() => resolveRecipe(recipe, { lr: -1 })).toThrow(TrainingInvalidRecipeError);
  });

  it("handles a different recipe kind (trinary_classifier) with its own schema", () => {
    const recipe = makeRecipe({
      slug: "trinary_classifier",
      kind: "trinary_classifier",
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
        metrics: ["accuracy"],
      },
      supportedDatasetKinds: ["tabular", "text"],
      outputArtifactKind: "ann_trinary_envelope",
    });
    const merged = resolveRecipe(recipe, { authority_weight: 0.8 });
    expect(merged.authority_weight).toBe(0.8);
    expect(merged.states).toEqual([-1, 0, 1]);
    // MLP-only keys should be rejected for trinary.
    expect(() => resolveRecipe(recipe, { hidden_units: [64] })).toThrow(TrainingInvalidRecipeError);
  });
});

describe("validateRecipeForDataset", () => {
  it("accepts a matching dataset kind", () => {
    const recipe = makeRecipe(); // supports "tabular"
    expect(() => validateRecipeForDataset(recipe, { kind: "tabular" })).not.toThrow();
  });

  it("rejects a mismatched dataset kind", () => {
    const recipe = makeRecipe(); // supports "tabular"
    expect(() => validateRecipeForDataset(recipe, { kind: "image" })).toThrow(
      TrainingInvalidRecipeError,
    );
    expect(() => validateRecipeForDataset(recipe, { kind: "image" })).toThrow(/image/);
  });

  it("rejects when the dataset schema is missing", () => {
    const recipe = makeRecipe();
    expect(() => validateRecipeForDataset(recipe, null)).toThrow(TrainingInvalidRecipeError);
    expect(() => validateRecipeForDataset(recipe, undefined)).toThrow(TrainingInvalidRecipeError);
  });

  it("accepts any of multiple supported dataset kinds", () => {
    const recipe = makeRecipe({
      supportedDatasetKinds: ["tabular", "text"],
    });
    expect(() => validateRecipeForDataset(recipe, { kind: "tabular" })).not.toThrow();
    expect(() => validateRecipeForDataset(recipe, { kind: "text" })).not.toThrow();
    expect(() => validateRecipeForDataset(recipe, { kind: "image" })).toThrow(
      TrainingInvalidRecipeError,
    );
  });
});

describe("RecipeOverrideSchema", () => {
  it("accepts any plain object", () => {
    const parsed = RecipeOverrideSchema.parse({ lr: 0.01, foo: "bar" });
    expect(parsed).toEqual({ lr: 0.01, foo: "bar" });
  });

  it("rejects arrays at the top level", () => {
    expect(() => RecipeOverrideSchema.parse([1, 2, 3])).toThrow();
  });
});
