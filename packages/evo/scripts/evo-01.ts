#!/usr/bin/env -S npx tsx
/**
 * AIGARTH-EVO-01 — the first public demonstration of the ternary
 * rule-table substrate.
 *
 * Runs the full battery of fitness environments end-to-end and
 * prints a convergence table to stdout. This is the script the
 * build stream uses to prove the substrate actually learns
 * non-trivial functions.
 *
 * Usage:
 *
 *   pnpm --filter @aigarth/evo demo:evo01                       # all envs, default seed
 *   pnpm --filter @aigarth/evo demo:evo01 -- --env=xor          # single env
 *   pnpm --filter @aigarth/evo demo:evo01 -- --env=xor --seed=7
 *   pnpm --filter @aigarth/evo demo:evo01 -- --env=xor --gens=200 --pop=128
 *
 * Exit code:
 *   0  — every requested environment reached 1.0 accuracy (or was skipped)
 *   1  — at least one environment failed to converge
 *   2  — bad CLI args
 */

import { Rng } from "../src/rng.js";
import { evolve, DEFAULT_EVOLUTION_CONFIG, type EvolutionResult } from "../src/evolve.js";
import {
  AIGARTH_EVO_01_BATTERY,
  type Evo01BatteryName,
} from "../src/environments/index.js";

interface CliArgs {
  env?: Evo01BatteryName;
  seed: number;
  generations: number;
  population: number;
  offspring: number;
  json: boolean;
  quiet: boolean;
}

function parseArgs(argv: ReadonlyArray<string>): CliArgs {
  const args: CliArgs = {
    seed: 42,
    generations: DEFAULT_EVOLUTION_CONFIG.generations,
    population: DEFAULT_EVOLUTION_CONFIG.population_size,
    offspring: DEFAULT_EVOLUTION_CONFIG.offspring_size,
    json: false,
    quiet: false,
  };
  for (const a of argv) {
    if (a.startsWith("--env=")) {
      const v = a.slice("--env=".length) as Evo01BatteryName;
      if (!(v in AIGARTH_EVO_01_BATTERY)) {
        const known = Object.keys(AIGARTH_EVO_01_BATTERY).join(", ");
        throw new Error(`Unknown environment '${v}'. Known: ${known}`);
      }
      args.env = v;
    } else if (a.startsWith("--seed=")) {
      args.seed = Number(a.slice("--seed=".length));
    } else if (a.startsWith("--gens=")) {
      args.generations = Number(a.slice("--gens=".length));
    } else if (a.startsWith("--pop=")) {
      args.population = Number(a.slice("--pop=".length));
    } else if (a.startsWith("--off=")) {
      args.offspring = Number(a.slice("--off=".length));
    } else if (a === "--json") {
      args.json = true;
    } else if (a === "--quiet") {
      args.quiet = true;
    }
  }
  return args;
}

function runOne(
  name: Evo01BatteryName,
  args: CliArgs,
): EvolutionResult {
  const env = AIGARTH_EVO_01_BATTERY[name];
  const rng = new Rng(args.seed);
  return evolve(rng, env, {
    population_size: args.population,
    offspring_size: args.offspring,
    generations: args.generations,
    target_fitness: 1.0,
  });
}

function printHuman(
  name: Evo01BatteryName,
  result: EvolutionResult,
  args: CliArgs,
): void {
  const last = result.generations[result.generations.length - 1]!;
  const status = result.converged ? "CONVERGED" : "did not converge";
  const at = result.converged ? ` @ gen ${result.converged_at}` : "";
  const totalEvals = result.evaluations.length;
  // eslint-disable-next-line no-console
  console.log(
    `[${name.padEnd(12)}] ${status}${at}  ` +
      `best=${result.best_fitness.accuracy.toFixed(4)}  ` +
      `mean(last)=${last.mean_fitness.toFixed(4)}  ` +
      `gens=${result.generations.length}  ` +
      `evals=${totalEvals}  ` +
      `seed=${args.seed}`,
  );
  if (!args.quiet && result.generations.length > 0) {
    // Print a compact fitness curve: every 10th generation, best + mean.
    const step = Math.max(1, Math.floor(result.generations.length / 10));
    const lines: string[] = [];
    for (let i = 0; i < result.generations.length; i += step) {
      const g = result.generations[i]!;
      lines.push(
        `  gen ${String(g.generation).padStart(3)}  ` +
          `best=${g.best_fitness.toFixed(3)}  ` +
          `mean=${g.mean_fitness.toFixed(3)}  ` +
          `v=${g.best_version}`,
      );
    }
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
  }
}

function main(): number {
  let args: CliArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[evo-01] arg error: ${(err as Error).message}`);
    return 2;
  }

  const requested: Evo01BatteryName[] = args.env ? [args.env] : (Object.keys(AIGARTH_EVO_01_BATTERY) as Evo01BatteryName[]);

  if (args.json) {
    const out: Record<string, unknown> = {};
    for (const name of requested) {
      const r = runOne(name, args);
      out[name] = {
        converged: r.converged,
        converged_at: r.converged_at,
        best_fitness: r.best_fitness.accuracy,
        generations: r.generations.length,
        evaluations: r.evaluations.length,
        final_generation: r.generations[r.generations.length - 1] ?? null,
      };
    }
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(out, null, 2));
    return requested.every((n) => (out[n] as { converged: boolean }).converged) ? 0 : 1;
  }

  // eslint-disable-next-line no-console
  console.log(
    `AIGARTH-EVO-01 — ternary rule-table substrate demonstration\n` +
      `seed=${args.seed}  pop=${args.population}  off=${args.offspring}  gens=${args.generations}\n`,
  );

  let allConverged = true;
  for (const name of requested) {
    const r = runOne(name, args);
    printHuman(name, r, args);
    if (!r.converged) allConverged = false;
  }
  return allConverged ? 0 : 1;
}

process.exit(main());
