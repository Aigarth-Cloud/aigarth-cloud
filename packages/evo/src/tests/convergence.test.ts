/**
 * Convergence fixtures — the AIGARTH-EVO-01 battery, full battery run.
 *
 * These tests assert that the substrate converges on every boolean
 * environment in the AIGARTH-EVO-01 battery within a generous
 * budget. They are SLOW (a few seconds each on a laptop) so they
 * live in their own file and are skipped in `vitest run` default
 * mode by the standard "fast unit tests" expectation.
 *
 * Run with:  pnpm --filter @aigarth/evo test convergence
 */

import { describe, it, expect } from "vitest";
import { Rng } from "../rng.js";
import { evolve } from "../evolve.js";
import {
  AndEnv,
  OrEnv,
  NandEnv,
  XorEnv,
  Maj3Env,
  Parity3Env,
  CopyKEnv,
  NotKEnv,
  XorKEnv,
} from "../environments/index.js";

describe("AIGARTH-EVO-01 battery — convergence", () => {
  it("AND converges", () => {
    const r = evolve(new Rng(42), AndEnv, {
      population_size: 64,
      offspring_size: 64,
      generations: 80,
    });
    expect(r.converged).toBe(true);
  }, 30_000);

  it("OR converges", () => {
    const r = evolve(new Rng(42), OrEnv, {
      population_size: 64,
      offspring_size: 64,
      generations: 80,
    });
    expect(r.converged).toBe(true);
  }, 30_000);

  it("NAND converges", () => {
    const r = evolve(new Rng(42), NandEnv, {
      population_size: 64,
      offspring_size: 64,
      generations: 80,
    });
    expect(r.converged).toBe(true);
  }, 30_000);

  it("XOR converges (deceptive — needs hidden-layer compute)", () => {
    const r = evolve(new Rng(42), XorEnv, {
      population_size: 96,
      offspring_size: 96,
      generations: 150,
    });
    expect(r.converged).toBe(true);
  }, 60_000);

  it("MAJ3 converges (3-input majority)", () => {
    const r = evolve(new Rng(42), Maj3Env, {
      population_size: 96,
      offspring_size: 96,
      generations: 150,
    });
    expect(r.converged).toBe(true);
  }, 60_000);

  it("PARITY3 converges (very deceptive)", () => {
    const r = evolve(new Rng(42), Parity3Env, {
      population_size: 96,
      offspring_size: 96,
      generations: 200,
    });
    expect(r.converged).toBe(true);
  }, 90_000);

  it("COPY_K sequence prediction converges", () => {
    const r = evolve(new Rng(42), CopyKEnv, {
      population_size: 96,
      offspring_size: 96,
      generations: 150,
    });
    expect(r.converged).toBe(true);
  }, 60_000);

  it("NOT_K sequence prediction converges", () => {
    const r = evolve(new Rng(42), NotKEnv, {
      population_size: 96,
      offspring_size: 96,
      generations: 150,
    });
    expect(r.converged).toBe(true);
  }, 60_000);

  it("XOR_K sequence prediction converges", () => {
    const r = evolve(new Rng(42), XorKEnv, {
      population_size: 96,
      offspring_size: 96,
      generations: 150,
    });
    expect(r.converged).toBe(true);
  }, 60_000);
});
