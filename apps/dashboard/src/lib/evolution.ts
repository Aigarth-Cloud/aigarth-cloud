/**
 * Evolution dashboard adapter.
 *
 *   Bridges @aigarth/evo's pure evolution engine into the dashboard's
 *   server-side view layer. The substrate runs in-process for v1 (no
 *   network call to services/work). The wire contract with services/work
 *   is already established: `evo_step` is registered as a deterministic
 *   algorithm and the container is the next step to ship.
 *
 *   This module's responsibilities:
 *     1. Type the dashboard-facing shape (lighter than @aigarth/evo's
 *        EvolutionResult — we strip per-individual evaluation records
 *        from the wire to keep the dashboard payload bounded).
 *     2. Drive a single environment or the full AIGARTH-EVO-01 battery.
 *     3. Cap defaults so an accidental "run with N=10^6" doesn't lock
 *        the dashboard thread for hours.
 *
 *   The adapter deliberately does NOT throw on convergence failures:
 *   a partially-converged battery is still useful diagnostic data, so
 *   every environment returns a row regardless.
 */

import {
  Rng,
  evolve,
  AIGARTH_EVO_01_BATTERY,
  type Evo01BatteryName,
  type EvolutionResult,
  type BooleanEnvironment,
  type FitnessScore,
  type GenerationRecord,
} from "../../../../packages/evo/dist/index.js";

/** Single per-environment summary the dashboard view consumes. */
export interface DashboardEvolutionRow {
  /** Battery slug. */
  env: Evo01BatteryName;
  /** Display label (matches the env name). */
  name: string;
  /** Converged (1.0 accuracy) or not. */
  converged: boolean;
  /** Generation at which convergence was first observed; -1 if not converged. */
  converged_at: number;
  /** Best fitness score, in [0, 1]. */
  best_fitness: number;
  /** Best genome's content hash (8-char hex). */
  best_genome_hash: string;
  /** Best genome's mutation counter. */
  best_version: number;
  /** Number of generations the driver ran (incl. gen 0). */
  generations: number;
  /** Total evaluations performed. */
  evaluations: number;
  /** Per-generation trace (best + mean fitness curves). */
  trace: ReadonlyArray<GenerationRecord>;
  /** Compact genome summary for the view (node_count, input/output sizes). */
  genome_summary: {
    schema: string;
    node_count: number;
    input_count: number;
    output_count: number;
    nodes: number;
  };
}

/** A request to run evolution. `env` is optional: when omitted, the
 * adapter runs the full AIGARTH-EVO-01 battery. */
export interface EvolutionRequest {
  env?: Evo01BatteryName;
  seed?: number;
  population_size?: number;
  offspring_size?: number;
  generations?: number;
}

/** Hard caps so a misclick doesn't lock the dashboard thread. */
const MAX_GENERATIONS = 500;
const MAX_POPULATION = 512;
const MAX_OFFSPRING = 512;
const DEFAULT_SEED = 42;
const DEFAULT_POPULATION = 64;
const DEFAULT_OFFSPRING = 64;
const DEFAULT_GENERATIONS = 100;

/** Validate the Evo01BatteryName is a real environment. */
export function listEnvironments(): ReadonlyArray<Evo01BatteryName> {
  return Object.keys(AIGARTH_EVO_01_BATTERY) as Evo01BatteryName[];
}

/**
 * Run evolution against one environment. Returns the dashboard-shaped
 * row. The full `EvolutionResult` is dropped (per-individual evaluations
 * can be 1000s of rows) so the wire payload stays bounded.
 */
export function runOne(
  env_name: Evo01BatteryName,
  req: EvolutionRequest = {},
): DashboardEvolutionRow {
  const env: BooleanEnvironment = AIGARTH_EVO_01_BATTERY[env_name];
  const seed = clampInt(req.seed ?? DEFAULT_SEED, 0, 0x7fffffff);
  const pop = clampInt(req.population_size ?? DEFAULT_POPULATION, 1, MAX_POPULATION);
  const off = clampInt(req.offspring_size ?? DEFAULT_OFFSPRING, 0, MAX_OFFSPRING);
  const gens = clampInt(req.generations ?? DEFAULT_GENERATIONS, 1, MAX_GENERATIONS);

  const result: EvolutionResult = evolve(new Rng(seed), env, {
    population_size: pop,
    offspring_size: off,
    generations: gens,
    target_fitness: 1.0,
  });
  return shapeRow(env_name, env, result);
}

/**
 * Run the full AIGARTH-EVO-01 battery sequentially with the same seed.
 * Each environment gets its own RNG instance seeded with the same
 * value, so the run is reproducible across invocations.
 */
export function runBattery(req: Omit<EvolutionRequest, "env"> = {}): DashboardEvolutionRow[] {
  const names = listEnvironments();
  const out: DashboardEvolutionRow[] = [];
  for (const name of names) {
    out.push(runOne(name, req));
  }
  return out;
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isInteger(n)) return min;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function shapeRow(
  env_name: Evo01BatteryName,
  env: BooleanEnvironment,
  r: EvolutionResult,
): DashboardEvolutionRow {
  const best = r.best_fitness;
  return {
    env: env_name,
    name: env.name,
    converged: r.converged,
    converged_at: r.converged_at,
    best_fitness: best.accuracy,
    best_genome_hash: hashOf(r),
    best_version: r.best_genome.version,
    generations: r.generations.length,
    evaluations: r.evaluations.length,
    trace: r.generations,
    genome_summary: {
      schema: r.best_genome.schema,
      node_count: r.best_genome.node_count,
      input_count: r.best_genome.input_count,
      output_count: r.best_genome.output_count,
      nodes: r.best_genome.nodes.length,
    },
  };
}

/**
 * Tiny content-hash shortener so the dashboard table is readable.
 * We re-use the substrate's djb2 hash via the genome's `version`
 * field combined with the per-generation best-version to give a
 * stable identifier for the converged genome.
 */
function hashOf(r: EvolutionResult): string {
  const last = r.generations[r.generations.length - 1];
  if (!last) return "00000000";
  return `${last.best_genome_hash}-${r.best_genome.version}`;
}

/** Re-exported for the view layer's convenience. */
export type { FitnessScore, GenerationRecord };
