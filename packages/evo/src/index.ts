/**
 * @aigarth/evo — Ternary Rule-Table Evolutionary Substrate
 *
 * Public surface for the Aigarth evolution engine. The package
 * re-exports the canonical genome format, mutation operators,
 * forward-pass evaluator, RNG, fitness environments, and the
 * closed-loop evolution driver.
 *
 * The split between modules is intentional:
 *
 *   - genome.ts        : wire format + constructors (no randomness here)
 *   - mutate.ts        : stochastic operators (require an Rng)
 *   - eval.ts          : deterministic forward pass
 *   - rng.ts           : seeded PRNG (Mulberry32)
 *   - environments/    : swappable fitness wrappers
 *   - evolve.ts        : population-based loop driver
 *
 * Add a new environment by defining a sibling file under
 * environments/ that exports a `BooleanEnvironment` or
 * `RegressionEnvironment` constant and adding it to the catalog
 * in environments/index.ts.
 */

export * from "./genome.js";
export * from "./eval.js";
export * from "./mutate.js";
export * from "./rng.js";
export * as Environments from "./environments/index.js";
export type {
  BooleanEnvironment,
  BooleanExample,
  FitnessScore,
  RegressionEnvironment,
  RegressionExample,
} from "./environments/types.js";
export {
  AndEnv,
  OrEnv,
  NandEnv,
  XorEnv,
  Maj3Env,
  Parity3Env,
  CopyKEnv,
  NotKEnv,
  XorKEnv,
  BtcEnv,
  makeBtcEnvironment,
  AIGARTH_EVO_01_BATTERY,
  type Evo01BatteryName,
  type BooleanEnvironmentName,
  type SequenceEnvironmentName,
} from "./environments/index.js";
export {
  evolve,
  DEFAULT_EVOLUTION_CONFIG,
  type EvolutionConfig,
  type EvolutionResult,
  type GenerationRecord,
  type IndividualRecord,
} from "./evolve.js";
