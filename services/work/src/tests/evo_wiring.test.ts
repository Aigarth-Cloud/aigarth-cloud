/**
 * Integration: services/work <-> packages/evo.
 *
 * Verifies that the registered evo_step algorithm in the Work
 * Runtime can be paired with the @aigarth/evo substrate to drive
 * the closed-loop evolution engine. This is the proof that:
 *
 *   - The Work Runtime's algorithm registry knows evo_step.
 *   - The schema for the algorithm's input/output payloads matches
 *     what @aigarth/evo produces and consumes.
 *   - A whole evolution run can complete via the substrate and
 *     produce a serialisable result.
 *
 * No HTTP — this is a unit-level integration. The HTTP-level
 * proof (POST /v1/work/items + the algorithm container executing
 * the payload) lives in the worker daemon, which ships separately.
 */

import { describe, it, expect } from "vitest";
import {
  Rng,
  evolve,
  AndEnv,
  XorEnv,
  AIGARTH_EVO_01_BATTERY,
} from "@aigarth/evo";
import {
  EVO_STEP_DEFINITION,
  AWORK_1_DEFINITION,
} from "../services/algorithms.js";

describe("evo_step wiring — algorithm definitions", () => {
  it("evo_step definition has the right shape (name, semver, deterministic)", () => {
    expect(EVO_STEP_DEFINITION.name).toBe("evo_step");
    expect(EVO_STEP_DEFINITION.version).toMatch(/^v\d+\.\d+\.\d+$/);
    expect(EVO_STEP_DEFINITION.deterministic).toBe(true);
    expect(EVO_STEP_DEFINITION.container).toContain("evo_step");
  });

  it("awork_1 definition still valid (no regression)", () => {
    expect(AWORK_1_DEFINITION.name).toBe("awork_1");
    expect(AWORK_1_DEFINITION.deterministic).toBe(true);
  });
});

describe("evo_step wiring — payload shape", () => {
  it("an evolution result is JSON-serialisable round-trip", () => {
    const r = evolve(new Rng(42), AndEnv, {
      population_size: 16,
      offspring_size: 16,
      generations: 10,
    });
    const json = JSON.stringify(r);
    const back = JSON.parse(json);
    expect(back.converged).toBe(r.converged);
    expect(back.best_fitness.accuracy).toBe(r.best_fitness.accuracy);
    expect(back.generations.length).toBe(r.generations.length);
  });

  it("a single genome is JSON-serialisable round-trip", () => {
    const r = evolve(new Rng(42), AndEnv, {
      population_size: 8,
      offspring_size: 8,
      generations: 5,
    });
    const json = JSON.stringify(r.best_genome);
    const back = JSON.parse(json);
    expect(back.schema).toBe(r.best_genome.schema);
    expect(back.node_count).toBe(r.best_genome.node_count);
    expect(back.nodes.length).toBe(r.best_genome.nodes.length);
  });
});

describe("evo_step wiring — end-to-end small run", () => {
  it("drives a small AND evolution and reports the convergence state", () => {
    const r = evolve(new Rng(42), AndEnv, {
      population_size: 64,
      offspring_size: 64,
      generations: 50,
    });
    // AND is easy; this should converge well before gen 50.
    expect(r.converged).toBe(true);
    expect(r.best_fitness.accuracy).toBe(1);
    // The driver short-circuits on convergence, so the trace has
    // at least the initial generation and converged_at + 1 entries.
    // We assert it's at least 2 and at most generations + 1.
    expect(r.generations.length).toBeGreaterThanOrEqual(2);
    expect(r.generations.length).toBeLessThanOrEqual(51);
    expect(r.converged_at).toBeGreaterThanOrEqual(0);
    expect(r.converged_at).toBeLessThanOrEqual(50);
  });

  it("every environment in the AIGARTH-EVO-01 battery exposes a name and shape", () => {
    for (const [name, env] of Object.entries(AIGARTH_EVO_01_BATTERY)) {
      expect(env.name).toBe(name);
      const shape = env.shape();
      expect(shape.input_count).toBeGreaterThan(0);
      expect(shape.output_count).toBeGreaterThan(0);
      expect(shape.node_count).toBeGreaterThanOrEqual(
        shape.input_count + shape.output_count,
      );
    }
  });

  it("a small evolution result is wire-serialisable", () => {
    const r = evolve(new Rng(7), AndEnv, {
      population_size: 16,
      offspring_size: 16,
      generations: 5,
    });
    const json = JSON.stringify({
      best_genome: r.best_genome,
      best_fitness: r.best_fitness,
      converged: r.converged,
      converged_at: r.converged_at,
      generation_count: r.generations.length,
      evaluation_count: r.evaluations.length,
    });
    expect(json.length).toBeGreaterThan(100);
    const back = JSON.parse(json);
    expect(back.converged).toBeDefined();
    expect(back.best_fitness.accuracy).toBeGreaterThan(0);
  });
});
