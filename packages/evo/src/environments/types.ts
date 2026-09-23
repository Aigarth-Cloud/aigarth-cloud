/**
 * Fitness environment — the contract a swappable fitness wrapper
 * must satisfy.
 *
 * This is the answer to "what if we replace Bitcoin accuracy with
 * arbitrary fitness functions?" Each environment owns its own
 * (input, target) test set and its own scoring rule. The substrate
 * is the same; only the environment changes.
 */

import type { Genome, GenomeShape } from "../genome.js";

/**
 * A single labelled training/test example for a boolean environment.
 * `input` is in {0, 1}^K; `target` is in {0, 1}^M (or {-1, +1}^M for
 * signed-target environments).
 */
export interface BooleanExample {
  /** External input vector; each entry must be 0 or 1. */
  input: ReadonlyArray<0 | 1>;
  /** Expected output vector; each entry must be 0 or 1. */
  target: ReadonlyArray<0 | 1>;
}

/**
 * The score a single (genome, environment) evaluation produces.
 *
 *   accuracy: fraction of examples where every output bit matched the
 *     target, in [0, 1].
 *
 *   per_output_match: per-bit accuracy averaged across all examples and
 *     outputs, in [0, 1]. Lets the driver distinguish "all correct"
 *     from "some correct" on multi-output environments.
 *
 *   examples_evaluated: how many examples contributed to the score.
 *     Used to detect empty environments.
 *
 *   extra: opaque environment-specific metadata. XOR uses {}; the BTC
 *     environment can put per-window statistics here for downstream
 *     visualisation.
 */
export interface FitnessScore {
  accuracy: number;
  per_output_match: number;
  examples_evaluated: number;
  extra?: Record<string, unknown>;
}

/**
 * A boolean-input, boolean-output fitness environment.
 *
 * The shape returned by `shape()` constrains the genomes the
 * environment accepts: input_count and output_count must match.
 * The evolution driver checks this when constructing the initial
 * population and when admitting foreign genomes (e.g. forked cells).
 */
export interface BooleanEnvironment {
  /** Slug; used in logs and as the `extra.environment` field on the score. */
  readonly name: string;
  /** The shape this environment requires. */
  shape(): GenomeShape;
  /** Ordered list of examples (training set). */
  examples(): ReadonlyArray<BooleanExample>;
  /**
   * Score a genome against the example set. Implementations must
   * call `evaluate()` from `@aigarth/evo/eval` themselves so the
   * step count is environment-specific.
   */
  score(genome: Genome): FitnessScore;
}

/**
 * A regression-style environment: inputs are real-valued (clamped to
 * trinary by the evaluator), targets are real-valued, the score is
 * an error metric (lower is better; the driver flips to fitness via
 * `1 - normalised_error`).
 *
 * Not used by AIGARTH-EVO-01 (which is all boolean) but available for
 * the BTC direction predictor and any future continuous environment.
 */
export interface RegressionExample {
  input: ReadonlyArray<number>;
  target: ReadonlyArray<number>;
}

export interface RegressionEnvironment {
  readonly name: string;
  shape(): GenomeShape;
  examples(): ReadonlyArray<RegressionExample>;
  /** Returns an error in [0, 1]; 0 = perfect. */
  error(genome: Genome): number;
}
