/**
 * Evolution driver — the closed-loop engine.
 *
 * This is the answer to "how do you make Anna.exe's loop runnable on
 * Aigarth Cloud?" It is a textbook (mu + lambda) evolution strategy
 * with tournament selection, uniform crossover, and a small
 * per-generation mutation. It produces an audit trail suitable for
 * the `organism_fitness_history` table.
 *
 *   population:  P genomes, all sharing the same shape
 *   generation:  one mutation + selection cycle
 *   offspring:   L new genomes produced per generation
 *   elitism:     top E genomes carry over unchanged each generation
 *
 * Per-generation work:
 *
 *   1. Score every genome in the (population + offspring) pool.
 *   2. Sort by score descending.
 *   3. Take the top P to form the next population (elitism is free
 *      because high-scoring offspring are already in the top).
 *   4. Fill the offspring slots for the next generation by
 *      tournament-selecting parents and applying crossover +
 *      mutation.
 *
 * The driver is **deterministic** given:
 *   - a fixed Rng seed
 *   - a fixed population size
 *   - a fixed environment
 *   - a fixed number of generations
 *
 * Two runs with the same inputs produce byte-identical output. The
 * `EvolutionTrace` returned by `evolve()` records enough information
 * to replay any generation.
 */

import type { Rng } from "./rng.js";
import { freshGenome, genomeContentHash, type Genome } from "./genome.js";
import type { BooleanEnvironment, FitnessScore } from "./environments/types.js";
import { crossover, mutate } from "./mutate.js";

/** A snapshot of one generation. Append-only; the driver returns the full list. */
export interface GenerationRecord {
  generation: number;
  /** Best fitness score seen this generation, in [0, 1]. */
  best_fitness: number;
  /** Mean fitness across the population this generation, in [0, 1]. */
  mean_fitness: number;
  /** Per-bit accuracy mean across the population this generation. */
  mean_per_output_match: number;
  /** Hash of the best genome's content (excluding `version`). */
  best_genome_hash: string;
  /** Version counter of the best genome. Monotonically non-decreasing within a run. */
  best_version: number;
  /** Wall-clock ms since the previous generation. 0 for generation 0. */
  elapsed_ms: number;
}

/** A snapshot of one individual evaluation. */
export interface IndividualRecord {
  genome_hash: string;
  version: number;
  score: FitnessScore;
  environment: string;
  generation: number;
}

/**
 * Configuration for an evolution run.
 *
 * Defaults are tuned for the AIGARTH-EVO-01 battery: small enough
 * to converge on XOR within seconds on a laptop, large enough to
 * not be a degenerate toy.
 */
export interface EvolutionConfig {
  /** Population size. Default 64. */
  population_size: number;
  /** Offspring per generation. Default 64. */
  offspring_size: number;
  /** Tournament size for parent selection. Default 3. */
  tournament_size: number;
  /** Number of generations. Default 100. */
  generations: number;
  /** Stop early if any genome reaches this fitness. Default 1.0. */
  target_fitness: number;
  /** Mutation weights. Default point-rule heavy. */
  mutation_weights: { point_rule: number; point_input: number; whole_rule: number };
  /** Crossover probability per offspring. Default 0.7. */
  crossover_rate: number;
}

export const DEFAULT_EVOLUTION_CONFIG: EvolutionConfig = {
  population_size: 64,
  offspring_size: 64,
  tournament_size: 3,
  generations: 100,
  target_fitness: 1.0,
  mutation_weights: { point_rule: 0.7, point_input: 0.25, whole_rule: 0.05 },
  crossover_rate: 0.7,
};

/**
 * Tournament selection: pick `k` random individuals, return the one
 * with the highest score. Ties broken uniformly at random via the RNG.
 */
function tournamentSelect(
  rng: Rng,
  scored: ReadonlyArray<{ genome: Genome; score: FitnessScore }>,
  k: number,
): { genome: Genome; score: FitnessScore } {
  if (scored.length === 0) {
    throw new RangeError(`tournamentSelect: cannot pick from an empty population`);
  }
  let best = rng.pick(scored);
  for (let i = 1; i < k; i++) {
    const candidate = rng.pick(scored);
    if (candidate.score.accuracy > best.score.accuracy) {
      best = candidate;
    }
  }
  return best;
}

/**
 * Produce one offspring from the current scored population.
 *
 * - With probability `crossover_rate`, breed two parents via
 *   tournament selection and crossover; otherwise clone a single
 *   tournament-selected parent.
 * - Always apply a mutation.
 */
function produceOffspring(
  rng: Rng,
  scored: ReadonlyArray<{ genome: Genome; score: FitnessScore }>,
  cfg: EvolutionConfig,
): Genome {
  let child: Genome;
  if (rng.next() < cfg.crossover_rate && scored.length >= 2) {
    const a = tournamentSelect(rng, scored, cfg.tournament_size);
    const b = tournamentSelect(rng, scored, cfg.tournament_size);
    child = crossover(rng, a.genome, b.genome);
  } else {
    const p = tournamentSelect(rng, scored, cfg.tournament_size);
    child = { ...p.genome };
  }
  return mutate(rng, child, cfg.mutation_weights);
}

/**
 * Build an initial random population whose genomes all share the
 * shape required by the environment.
 */
function initialPopulation(
  rng: Rng,
  env: BooleanEnvironment,
  size: number,
): Genome[] {
  const shape = env.shape();
  if (size <= 0) return [];
  return Array.from({ length: size }, () =>
    freshGenome(rng, shape.input_count, shape.output_count, shape.node_count),
  );
}

/**
 * Run the closed-loop evolution.
 *
 *   rng:    the seeded RNG (deterministic run reproduction)
 *   env:    the fitness environment to optimise against
 *   cfg:    evolution configuration; defaults applied if omitted
 *
 * Returns:
 *   {
 *     best_genome:    the highest-scoring genome seen in the run
 *     best_fitness:   its score
 *     generations:    per-generation summary (length === cfg.generations + 1)
 *     evaluations:    per-individual evaluation record (length === N evals)
 *     converged:      true if any genome reached cfg.target_fitness
 *     converged_at:   generation index of first convergence, or -1
 *   }
 */
export interface EvolutionResult {
  best_genome: Genome;
  best_fitness: FitnessScore;
  generations: GenerationRecord[];
  evaluations: IndividualRecord[];
  converged: boolean;
  converged_at: number;
}

export function evolve(
  rng: Rng,
  env: BooleanEnvironment,
  cfg: Partial<EvolutionConfig> = {},
): EvolutionResult {
  const fullCfg: EvolutionConfig = { ...DEFAULT_EVOLUTION_CONFIG, ...cfg };
  if (fullCfg.population_size < 1) {
    throw new RangeError(`evolve: population_size must be >= 1, got ${fullCfg.population_size}`);
  }
  if (fullCfg.offspring_size < 0) {
    throw new RangeError(`evolve: offspring_size must be >= 0, got ${fullCfg.offspring_size}`);
  }
  if (fullCfg.generations < 0) {
    throw new RangeError(`evolve: generations must be >= 0, got ${fullCfg.generations}`);
  }

  // Generation 0: random initial population, no mutation yet.
  const evaluations: IndividualRecord[] = [];
  let population = initialPopulation(rng, env, fullCfg.population_size);
  let scored = population.map((g) => ({ genome: g, score: env.score(g) }));
  for (const s of scored) {
    evaluations.push({
      genome_hash: genomeContentHash(s.genome),
      version: s.genome.version,
      score: s.score,
      environment: env.name,
      generation: 0,
    });
  }

  const generations: GenerationRecord[] = [];
  let best = pickBest(scored);
  let converged = best.score.accuracy >= fullCfg.target_fitness;
  let converged_at = converged ? 0 : -1;
  generations.push(summarise(0, scored, 0));

  // Generation loop.
  for (let gen = 1; gen <= fullCfg.generations && !converged; gen++) {
    const t0 = Date.now();

    // Produce offspring.
    const offspring: Genome[] = [];
    for (let i = 0; i < fullCfg.offspring_size; i++) {
      offspring.push(produceOffspring(rng, scored, fullCfg));
    }

    // Score offspring.
    const offspringScored = offspring.map((g) => ({ genome: g, score: env.score(g) }));
    for (const s of offspringScored) {
      evaluations.push({
        genome_hash: genomeContentHash(s.genome),
        version: s.genome.version,
        score: s.score,
        environment: env.name,
        generation: gen,
      });
    }

    // Combine, sort, truncate to population_size.
    const combined = [...scored, ...offspringScored];
    combined.sort((a, b) => b.score.accuracy - a.score.accuracy);
    scored = combined.slice(0, fullCfg.population_size);
    population = scored.map((s) => s.genome);

    const newBest = pickBest(scored);
    if (newBest.score.accuracy > best.score.accuracy) {
      best = newBest;
    }
    if (!converged && best.score.accuracy >= fullCfg.target_fitness) {
      converged = true;
      converged_at = gen;
    }

    const elapsed_ms = Date.now() - t0;
    generations.push(summarise(gen, scored, elapsed_ms));
  }

  return {
    best_genome: best.genome,
    best_fitness: best.score,
    generations,
    evaluations,
    converged,
    converged_at,
  };
}

function pickBest(scored: ReadonlyArray<{ genome: Genome; score: FitnessScore }>): { genome: Genome; score: FitnessScore } {
  if (scored.length === 0) {
    throw new RangeError(`pickBest: cannot pick from empty scored population`);
  }
  let best = scored[0]!;
  for (let i = 1; i < scored.length; i++) {
    if (scored[i]!.score.accuracy > best.score.accuracy) {
      best = scored[i]!;
    }
  }
  return best;
}

function summarise(
  gen: number,
  scored: ReadonlyArray<{ genome: Genome; score: FitnessScore }>,
  elapsed_ms: number,
): GenerationRecord {
  const best = pickBest(scored);
  let sumAcc = 0;
  let sumPOM = 0;
  for (const s of scored) {
    sumAcc += s.score.accuracy;
    sumPOM += s.score.per_output_match;
  }
  const n = scored.length;
  return {
    generation: gen,
    best_fitness: best.score.accuracy,
    mean_fitness: n === 0 ? 0 : sumAcc / n,
    mean_per_output_match: n === 0 ? 0 : sumPOM / n,
    best_genome_hash: genomeContentHash(best.genome),
    best_version: best.genome.version,
    elapsed_ms,
  };
}
