/**
 * Sequence-prediction fitness environments.
 *
 * "Given the last K bits, predict the next bit." This is a harder
 * class of problem than the static boolean environments because the
 * target depends on a non-trivial rule. We include:
 *
 *   - COPY_K   : the next bit is a copy of bit K-1 (the most recent)
 *   - NOT_K    : the next bit is the negation of bit K-1
 *   - XOR_K    : the next bit is XOR of bits K-1 and K-2
 *
 * Each environment generates its training set deterministically from
 * a seeded sequence. The default is the alternating sequence
 * 0,1,0,1,0,1,... which makes the NOT_K and XOR_K problems tractable
 * for the ternary rule-table substrate (the period-2 structure
 * matches well with 3-state logic).
 */

import { evaluate, trinaryToBoolean } from "../eval.js";
import type { Genome, GenomeShape } from "../genome.js";
import { makeShape } from "../genome.js";
import type { BooleanEnvironment, FitnessScore } from "./types.js";

/**
 * Build a sequence-prediction environment.
 *
 *   window: how many past bits the genome sees as input
 *   target_fn(prev_bits): function mapping the past window to the
 *     next bit
 *   steps: how many synchronous ticks the evaluator runs before
 *     reading the output slot. Default 3 — long enough to let
 *     information propagate through a 16-node network.
 */
function makeSequenceEnvironment(
  name: string,
  window: number,
  target_fn: (prev: ReadonlyArray<0 | 1>) => 0 | 1,
  sequence: ReadonlyArray<0 | 1>,
  node_count: number = 16,
  steps: number = 3,
): BooleanEnvironment {
  // Build the (input, target) examples: for every position in the
  // sequence where we have window past bits, the target is the next.
  const examples: Array<{ input: Array<0 | 1>; target: Array<0 | 1> }> = [];
  for (let t = window; t < sequence.length; t++) {
    const input: Array<0 | 1> = [];
    for (let k = 1; k <= window; k++) {
      input.push(sequence[t - k]!);
    }
    examples.push({ input, target: [target_fn(input)] });
  }

  const shape: GenomeShape = makeShape(window, 1, node_count);

  return {
    name,
    shape: () => shape,
    examples: () => examples,
    score(genome: Genome): FitnessScore {
      let fullyCorrect = 0;
      let bitMatches = 0;
      let totalBits = 0;
      for (const ex of examples) {
        const output = evaluate(genome, ex.input, steps);
        const observedBool = trinaryToBoolean(output[0] ?? 0);
        const targetBool = ex.target[0] === 1;
        if (observedBool === targetBool) {
          bitMatches += 1;
          fullyCorrect += 1;
        }
        totalBits += 1;
      }
      const accuracy = examples.length === 0 ? 0 : fullyCorrect / examples.length;
      const per_output_match = totalBits === 0 ? 0 : bitMatches / totalBits;
      return {
        accuracy,
        per_output_match,
        examples_evaluated: examples.length,
        extra: { steps, node_count, window },
      };
    },
  };
}

/** The default 32-bit alternating sequence used by the demos. */
const ALT_32: ReadonlyArray<0 | 1> = (() => {
  const out: Array<0 | 1> = [];
  for (let i = 0; i < 32; i++) out.push((i % 2) as 0 | 1);
  return out;
})();

/** COPY_K: predict the most recent bit. On the alternating sequence this is the negation of the previous input slot, so easy. */
export const CopyKEnv = makeSequenceEnvironment(
  "copy_k",
  4,
  (prev) => prev[0]!,
  ALT_32,
);

/** NOT_K: predict the negation of the most recent bit. On alternating seq: same as bit-2. */
export const NotKEnv = makeSequenceEnvironment(
  "not_k",
  4,
  (prev) => (prev[0]! === 1 ? 0 : 1) as 0 | 1,
  ALT_32,
);

/** XOR_K: predict XOR of the two most recent bits. On alternating seq: always 1. */
export const XorKEnv = makeSequenceEnvironment(
  "xor_k",
  4,
  (prev) => ((prev[0]! + prev[1]!) % 2) as 0 | 1,
  ALT_32,
);

export const ALL_SEQUENCE_ENVIRONMENTS = {
  copy_k: CopyKEnv,
  not_k: NotKEnv,
  xor_k: XorKEnv,
} as const;

export type SequenceEnvironmentName = keyof typeof ALL_SEQUENCE_ENVIRONMENTS;
