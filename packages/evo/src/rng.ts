/**
 * Seeded RNG — Mulberry32.
 *
 * Why Mulberry32 and not crypto.randomBytes?
 *
 *   The evolution engine needs *reproducibility for tests and audit trails*,
 *   not cryptographic unpredictability. crypto.randomBytes() gives us the
 *   latter but breaks reproducibility (every run is different, no
 *   convergent test is possible). Mulberry32 is a small, fast, well-known
 *   32-bit PRNG with reasonable statistical quality for population
 *   genetics; it produces an identical stream for an identical seed.
 *
 * The same RNG drives:
 *   - random initial genomes (genome.ts)
 *   - point mutations (mutate.ts)
 *   - tournament selection tie-breakers (evolve.ts)
 *   - crossover point picks (mutate.ts)
 *
 * The stream is created once per EvolutionDriver and threaded through every
 * stochastic call. The seed is logged at start so a run can be replayed
 * bit-for-bit by re-running with the same seed.
 */

/**
 * A deterministic 32-bit PRNG. Returns an unsigned 32-bit integer in [0, 2^32).
 *
 * Reference: https://gist.github.com/tommyettinger/46a3c4dadcf1aa9b2c8afe46ebedfb15
 * (Mulberry32, public domain).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function (): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A small, opinionated RNG wrapper around a uniform [0,1) source.
 *
 * - next(): uniform float in [0, 1)
 * - int(max): uniform integer in [0, max)
 * - intRange(min, max): uniform integer in [min, max]
 * - pick<T>(arr): uniform random element of a non-empty array
 * - shuffle<T>(arr): Fisher-Yates in place, returns the same array
 *
 * Methods are deterministic given the same underlying source.
 */
export class Rng {
  private readonly nextUniform: () => number;

  constructor(seed: number) {
    if (!Number.isFinite(seed)) {
      throw new RangeError(`Rng seed must be a finite number, got ${seed}`);
    }
    this.nextUniform = mulberry32(seed);
  }

  /** Uniform float in [0, 1). */
  next(): number {
    return this.nextUniform();
  }

  /** Uniform integer in [0, max). max must be a positive integer. */
  int(max: number): number {
    if (!Number.isInteger(max) || max <= 0) {
      throw new RangeError(`Rng.int(max): max must be a positive integer, got ${max}`);
    }
    return Math.floor(this.nextUniform() * max);
  }

  /** Uniform integer in [min, max] inclusive. Both must be integers and min <= max. */
  intRange(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
      throw new RangeError(
        `Rng.intRange(min, max): both must be integers with min <= max, got ${min}, ${max}`,
      );
    }
    return min + this.int(max - min + 1);
  }

  /** Pick a uniform random element from a non-empty array. */
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) {
      throw new RangeError(`Rng.pick: cannot pick from an empty array`);
    }
    return arr[this.int(arr.length)]!;
  }

  /** Fisher-Yates in-place shuffle. Returns the same array reference. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const tmp = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = tmp;
    }
    return arr;
  }
}
