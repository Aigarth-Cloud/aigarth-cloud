/**
 * Evolution adapter test — proves the dashboard-side glue layer
 * compiles, validates, and produces well-formed rows. This is a
 * pure Node test (no Next.js runtime), so it stays fast.
 *
 * Covers:
 *   - listEnvironments() exposes every AIGARTH-EVO-01 env
 *   - runOne() returns a well-formed DashboardEvolutionRow
 *   - runBattery() returns rows in deterministic order (matches
 *     Object.keys(AIGARTH_EVO_01_BATTERY))
 *   - request validation: clamping on bad seeds, oversized populations
 *   - wire shape: every row has the contract surface the view expects
 *   - determinism: same seed → same best_fitness across calls
 */

import { describe, it, expect } from "vitest";
import { runOne, runBattery, listEnvironments } from "../evolution.js";
import { AIGARTH_EVO_01_BATTERY } from "../../../../../packages/evo/dist/index.js";
import {
  classifyWorkers,
  shareOfPool,
  syntheticPoolStats,
  type PoolWorkerCount,
} from "../pool.js";

describe("listEnvironments", () => {
  it("returns every AIGARTH-EVO-01 environment", () => {
    const names = listEnvironments();
    expect(names.length).toBe(Object.keys(AIGARTH_EVO_01_BATTERY).length);
    for (const k of Object.keys(AIGARTH_EVO_01_BATTERY)) {
      expect(names).toContain(k);
    }
  });
});

describe("runOne", () => {
  it("returns a well-formed row for an easy environment (AND)", () => {
    const row = runOne("and", { seed: 42, population_size: 32, offspring_size: 32, generations: 50 });
    expect(row.env).toBe("and");
    expect(row.name).toBe(AIGARTH_EVO_01_BATTERY.and.name);
    expect(row.best_fitness).toBeGreaterThanOrEqual(0);
    expect(row.best_fitness).toBeLessThanOrEqual(1);
    expect(row.generations).toBeGreaterThanOrEqual(1);
    expect(row.evaluations).toBeGreaterThan(0);
    expect(row.trace.length).toBe(row.generations);
    expect(row.genome_summary.schema).toMatch(/^trinary-rule-table@/);
    expect(row.genome_summary.node_count).toBeGreaterThanOrEqual(
      row.genome_summary.input_count + row.genome_summary.output_count,
    );
  });

  it("converges on AND with the default config + seed 42", () => {
    const row = runOne("and");
    expect(row.converged).toBe(true);
    expect(row.best_fitness).toBe(1);
  });

  it("does not throw on deceptive problems with a tight budget", () => {
    // PARITY3 is the hardest in the battery; with a tight budget it
    // should still return a valid (non-converged) row rather than throw.
    const row = runOne("parity3", { seed: 7, population_size: 16, offspring_size: 16, generations: 5 });
    expect(row.env).toBe("parity3");
    expect(row.converged).toBe(false);
    expect(row.best_fitness).toBeGreaterThan(0);
  });

  it("clamps oversized generation requests to the dashboard cap", () => {
    // If a user POSTs generations=10000 the adapter caps at 500. We
    // check that the row is well-formed (not crashed) and that the
    // trace length matches the cap behaviour.
    const row = runOne("xor", { generations: 100000 });
    expect(row.trace.length).toBeLessThanOrEqual(501); // 500 ticks + gen 0
  });

  it("is deterministic for a fixed seed (same best_fitness across calls)", () => {
    const a = runOne("xor", { seed: 12345, population_size: 32, offspring_size: 32, generations: 30 });
    const b = runOne("xor", { seed: 12345, population_size: 32, offspring_size: 32, generations: 30 });
    expect(a.best_fitness).toBe(b.best_fitness);
    expect(a.converged).toBe(b.converged);
    expect(a.converged_at).toBe(b.converged_at);
  });
});

describe("runBattery", () => {
  it("returns one row per environment in the battery", () => {
    const rows = runBattery({ seed: 42, population_size: 32, offspring_size: 32, generations: 30 });
    const names = listEnvironments();
    expect(rows.length).toBe(names.length);
    for (let i = 0; i < names.length; i++) {
      expect(rows[i]!.env).toBe(names[i]!);
    }
  });

  it("is deterministic for a fixed seed", () => {
    const a = runBattery({ seed: 99, population_size: 16, offspring_size: 16, generations: 10 });
    const b = runBattery({ seed: 99, population_size: 16, offspring_size: 16, generations: 10 });
    for (let i = 0; i < a.length; i++) {
      expect(a[i]!.best_fitness).toBe(b[i]!.best_fitness);
    }
  });

  it("every row exposes the contract surface the view consumes", () => {
    const rows = runBattery({ seed: 42, population_size: 16, offspring_size: 16, generations: 10 });
    for (const r of rows) {
      expect(typeof r.env).toBe("string");
      expect(typeof r.name).toBe("string");
      expect(typeof r.converged).toBe("boolean");
      expect(typeof r.converged_at).toBe("number");
      expect(typeof r.best_fitness).toBe("number");
      expect(typeof r.best_genome_hash).toBe("string");
      expect(typeof r.best_version).toBe("number");
      expect(typeof r.generations).toBe("number");
      expect(typeof r.evaluations).toBe("number");
      expect(Array.isArray(r.trace)).toBe(true);
      expect(typeof r.genome_summary).toBe("object");
    }
  });
});

// ----------------------------------------------------------------------
// AIGARTH-EVO-02 — pool stats adapter tests
// ----------------------------------------------------------------------

describe("syntheticPoolStats", () => {
  it("returns a well-formed pool stats object", () => {
    const stats = syntheticPoolStats();
    expect(typeof stats.computed_at).toBe("string");
    expect(Array.isArray(stats.workers_by_kind)).toBe(true);
    expect(typeof stats.evals_last_hour).toBe("number");
    expect(typeof stats.evals_last_day).toBe("number");
    expect(typeof stats.running_items).toBe("number");
    expect(typeof stats.queued_items).toBe("number");
    expect(Array.isArray(stats.per_environment)).toBe(true);
    expect(Array.isArray(stats.top_workers)).toBe(true);
  });

  it("includes a browser row in workers_by_kind (for the pool widget)", () => {
    const stats = syntheticPoolStats();
    const kinds = stats.workers_by_kind.map((w) => w.kind);
    expect(kinds).toContain("browser");
  });

  it("includes evo_step in per_environment (so the widget shows the substrate)", () => {
    const stats = syntheticPoolStats();
    const envs = stats.per_environment.map((e) => e.environment);
    expect(envs).toContain("evo_step");
  });
});

describe("classifyWorkers (light vs dedicated)", () => {
  it("sums browser workers as light and everything else as dedicated", () => {
    const counts: PoolWorkerCount[] = [
      { kind: "local", total: 4, active: 2 },
      { kind: "remote", total: 2, active: 1 },
      { kind: "browser", total: 12, active: 7 },
      { kind: "oc-processor", total: 1, active: 0 },
    ];
    const r = classifyWorkers(counts);
    expect(r.light).toBe(7);
    expect(r.dedicated).toBe(3);
  });

  it("returns 0 / 0 on an empty input", () => {
    const r = classifyWorkers([]);
    expect(r.light).toBe(0);
    expect(r.dedicated).toBe(0);
  });
});

describe("shareOfPool", () => {
  it("computes local_evals / global_evals", () => {
    expect(shareOfPool(500, 50_000)).toBeCloseTo(0.01, 4);
  });

  it("returns 0 when global is 0 (avoids divide-by-zero)", () => {
    expect(shareOfPool(500, 0)).toBe(0);
  });

  it("clamps to 1 when local exceeds global", () => {
    expect(shareOfPool(2_000, 1_000)).toBe(1);
  });
});
