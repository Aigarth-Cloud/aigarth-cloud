/**
 * Boolean fitness environments.
 *
 * Six canonical problems from the AIGARTH-EVO-01 battery:
 *
 *   AND      2 -> 1   both inputs true
 *   OR       2 -> 1   at least one input true
 *   NAND     2 -> 1   not-and
 *   XOR      2 -> 1   exclusive or  (deceptive: requires a hidden layer)
 *   MAJ3     3 -> 1   majority of three  (deceptive)
 *   PARITY3  3 -> 1   parity (odd-count true)  (very deceptive)
 *
 * "Deceptive" here means: a greedy hill-climb that mutates one rule
 * cell at a time and accepts any improvement will plateau at 50%
 * accuracy on XOR. The full suite (XOR + MAJ3 + PARITY3) is the
 * standard benchmark for "can this substrate actually learn
 * non-trivial functions?" Anna.exe's BPP9000 BTC test is essentially
 * the same shape (linear separability on a window of prices is far
 * easier than XOR; the rule-table substrate is overkill for it).
 *
 * The 4-sample training sets are exhaustive for 2-bit / 3-bit
 * inputs; the environment scores against the full truth table.
 */

import { evaluate, trinaryToBoolean } from "../eval.js";
import type { Genome, GenomeShape } from "../genome.js";
import { makeShape } from "../genome.js";
import type {
  BooleanEnvironment,
  BooleanExample,
  FitnessScore,
} from "./types.js";

/** 2 -> 1 AND truth table. */
const AND_EXAMPLES: ReadonlyArray<BooleanExample> = [
  { input: [0, 0], target: [0] },
  { input: [0, 1], target: [0] },
  { input: [1, 0], target: [0] },
  { input: [1, 1], target: [1] },
];

/** 2 -> 1 OR truth table. */
const OR_EXAMPLES: ReadonlyArray<BooleanExample> = [
  { input: [0, 0], target: [0] },
  { input: [0, 1], target: [1] },
  { input: [1, 0], target: [1] },
  { input: [1, 1], target: [1] },
];

/** 2 -> 1 NAND truth table. */
const NAND_EXAMPLES: ReadonlyArray<BooleanExample> = [
  { input: [0, 0], target: [1] },
  { input: [0, 1], target: [1] },
  { input: [1, 0], target: [1] },
  { input: [1, 1], target: [0] },
];

/** 2 -> 1 XOR truth table. */
const XOR_EXAMPLES: ReadonlyArray<BooleanExample> = [
  { input: [0, 0], target: [0] },
  { input: [0, 1], target: [1] },
  { input: [1, 0], target: [1] },
  { input: [1, 1], target: [0] },
];

/**
 * Helper for the 3-input environments. Generates the 8 rows of the
 * truth table for a 3-bit function `fn`.
 */
function threeBitTruthTable(
  fn: (a: 0 | 1, b: 0 | 1, c: 0 | 1) => 0 | 1,
): ReadonlyArray<BooleanExample> {
  const rows: BooleanExample[] = [];
  for (let a = 0; a <= 1; a++) {
    for (let b = 0; b <= 1; b++) {
      for (let c = 0; c <= 1; c++) {
        rows.push({ input: [a as 0 | 1, b as 0 | 1, c as 0 | 1], target: [fn(a as 0 | 1, b as 0 | 1, c as 0 | 1)] });
      }
    }
  }
  return rows;
}

/** 3 -> 1 MAJ3 (at least two of three true). */
const MAJ3_EXAMPLES: ReadonlyArray<BooleanExample> = threeBitTruthTable((a, b, c) =>
  (a + b + c >= 2 ? 1 : 0) as 0 | 1,
);

/** 3 -> 1 PARITY3 (odd number of trues). */
const PARITY3_EXAMPLES: ReadonlyArray<BooleanExample> = threeBitTruthTable((a, b, c) =>
  ((a + b + c) % 2) as 0 | 1,
);

/**
 * Generic boolean environment factory.
 *
 * Each call returns a fresh environment bound to a specific truth
 * table. The default shape is 2-input / 1-output / 8 nodes (which
 * is enough for XOR — 2 input slots, 6 free nodes, 1 output slot).
 *
 * For 3-input problems the caller passes `node_count >= 5` so the
 * evaluator has at least 2 free nodes for the hidden layer.
 */
function makeBooleanEnvironment(
  name: string,
  examples: ReadonlyArray<BooleanExample>,
  node_count: number = 8,
  steps: number = 2,
): BooleanEnvironment {
  const shape: GenomeShape = makeShape(examples[0]!.input.length, examples[0]!.target.length, node_count);
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
        let rowCorrect = true;
        for (let i = 0; i < ex.target.length; i++) {
          const observedBool = trinaryToBoolean(output[i] ?? 0);
          const targetBool = ex.target[i] === 1;
          if (observedBool === targetBool) {
            bitMatches += 1;
          } else {
            rowCorrect = false;
          }
          totalBits += 1;
        }
        if (rowCorrect) fullyCorrect += 1;
      }
      const accuracy = examples.length === 0 ? 0 : fullyCorrect / examples.length;
      const per_output_match = totalBits === 0 ? 0 : bitMatches / totalBits;
      return {
        accuracy,
        per_output_match,
        examples_evaluated: examples.length,
        extra: { steps, node_count },
      };
    },
  };
}

export const AndEnv = makeBooleanEnvironment("and", AND_EXAMPLES, 8, 2);
export const OrEnv = makeBooleanEnvironment("or", OR_EXAMPLES, 8, 2);
export const NandEnv = makeBooleanEnvironment("nand", NAND_EXAMPLES, 8, 2);
export const XorEnv = makeBooleanEnvironment("xor", XOR_EXAMPLES, 8, 2);
export const Maj3Env = makeBooleanEnvironment("maj3", MAJ3_EXAMPLES, 8, 2);
export const Parity3Env = makeBooleanEnvironment("parity3", PARITY3_EXAMPLES, 12, 3);

export const ALL_BOOLEAN_ENVIRONMENTS = {
  and: AndEnv,
  or: OrEnv,
  nand: NandEnv,
  xor: XorEnv,
  maj3: Maj3Env,
  parity3: Parity3Env,
} as const;

export type BooleanEnvironmentName = keyof typeof ALL_BOOLEAN_ENVIRONMENTS;
