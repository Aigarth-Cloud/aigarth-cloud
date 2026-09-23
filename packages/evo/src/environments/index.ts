/**
 * Fitness environment catalog — public exports.
 *
 * Re-exports the typed shapes plus the canonical suite of environments.
 * Add a new environment by (1) defining a `FooEnv: BooleanEnvironment`
 * constant in a sibling file, (2) adding it to the catalog below.
 */

export type { BooleanEnvironment, BooleanExample, FitnessScore } from "./types.js";
export type { RegressionEnvironment, RegressionExample } from "./types.js";
export {
  AndEnv,
  OrEnv,
  NandEnv,
  XorEnv,
  Maj3Env,
  Parity3Env,
  ALL_BOOLEAN_ENVIRONMENTS,
  type BooleanEnvironmentName,
} from "./boolean.js";
export {
  CopyKEnv,
  NotKEnv,
  XorKEnv,
  ALL_SEQUENCE_ENVIRONMENTS,
  type SequenceEnvironmentName,
} from "./sequence.js";
export { makeBtcEnvironment, BtcEnv } from "./btc.js";

import { AndEnv, OrEnv, NandEnv, XorEnv, Maj3Env, Parity3Env } from "./boolean.js";
import { CopyKEnv, NotKEnv, XorKEnv } from "./sequence.js";
import { BtcEnv } from "./btc.js";
import type { BooleanEnvironment } from "./types.js";

/**
 * BooleanEnvironment shim over the BTC regression environment.
 *
 * Regression envs expose `error()` in [0, 1]. We expose `score()`
 * whose accuracy is `1 - error` so the evolution driver treats
 * BTC the same as every other environment in the catalog.
 *
 * This is the proof that "Bitcoin is just one fitness function" —
 * the engine doesn't care whether it's a boolean classification or a
 * regression on price windows.
 */
export const BtcBoolEnv: BooleanEnvironment = {
  name: BtcEnv.name,
  shape: () => BtcEnv.shape(),
  examples: () =>
    BtcEnv.examples().map((ex) => ({
      input: ex.input.map((v) => (v > 0 ? 1 : 0) as 0 | 1),
      target: ex.target.map((v) => (v > 0 ? 1 : 0) as 0 | 1),
    })),
  score(g) {
    const e = BtcEnv.error(g);
    return {
      accuracy: 1 - e,
      per_output_match: 1 - e,
      examples_evaluated: BtcEnv.examples().length,
      extra: { btc_error: e },
    };
  },
};

/**
 * The full AIGARTH-EVO-01 battery. Used by the demo script and the
 * evolution-driver tests.
 */
export const AIGARTH_EVO_01_BATTERY = {
  and: AndEnv,
  or: OrEnv,
  nand: NandEnv,
  xor: XorEnv,
  maj3: Maj3Env,
  parity3: Parity3Env,
  copy_k: CopyKEnv,
  not_k: NotKEnv,
  xor_k: XorKEnv,
  btc_direction: BtcBoolEnv,
} as const;

export type Evo01BatteryName = keyof typeof AIGARTH_EVO_01_BATTERY;
