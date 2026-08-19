/**
 * Tests for the ADR 005 §10 / ADR 008 F3 guardrail in
 * `services/training/src/workers/retrain-cron.ts`.
 *
 * The guard prevents a future maintainer from mistakenly wiring the
 * training service's auto-retrain cron to also respond to Organism
 * events (e.g. `organism_fitness_history` row inserts, `organism_mutation`
 * events, `organism_memory_write` events). An organism mutation is a
 * *genome change*, not a model-weights retrain — enqueuing a retrain
 * job would burn compute with no semantically meaningful effect on
 * the organism.
 *
 * We mock `../services/retrainTrigger.js` so we can assert that
 * `runRetrainScan` is NOT called for organism events, and IS called
 * for the normal ANN path. No real DB, no real network — same
 * in-memory mock pattern as `computeBridge.test.ts`.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Hoist the mock so `vi.mock` (also hoisted) can reference it.
// `vi.hoisted` runs before all imports, including the cron module
// that consumes the mocked `runRetrainScan`.
const { runRetrainScan } = vi.hoisted(() => ({
  runRetrainScan: vi.fn(),
}));

vi.mock("../services/retrainTrigger.js", () => ({
  runRetrainScan,
}));

import { runRetrainScanForEvent } from "../workers/retrain-cron.js";

describe("retrain-cron organism-event guardrail (ADR 005 §10 / ADR 008 F3)", () => {
  beforeEach(() => {
    runRetrainScan.mockReset();
    runRetrainScan.mockResolvedValue({ scanned: 0, triggered: 0, skipped: 0, errors: 0 });
  });

  it("does NOT call runRetrainScan when kind === 'organism_fitness' (fitness history insert is not a weight retrain trigger)", async () => {
    const result = await runRetrainScanForEvent({
      id: "evt-organism-fitness-1",
      kind: "organism_fitness",
    });
    expect(runRetrainScan).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
    expect(result.triggered).toBe(0);
    expect(result.scanned).toBe(0);
    expect(result.errors).toBe(0);
  });

  it("does NOT call runRetrainScan when kind === 'organism_mutation' (genome change != weight retrain)", async () => {
    const result = await runRetrainScanForEvent({
      id: "evt-organism-mutation-1",
      kind: "organism_mutation",
    });
    expect(runRetrainScan).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
    expect(result.triggered).toBe(0);
  });

  it("does NOT call runRetrainScan for a hypothetical future 'organism_memory_write' kind (regex catches it without code change)", async () => {
    // The guard is anchored at ^organism_ so any *future* organism
    // event kind is caught without code changes — this test pins
    // that property.
    const result = await runRetrainScanForEvent({
      id: "evt-organism-future-1",
      kind: "organism_memory_write",
    });
    expect(runRetrainScan).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  it("calls runRetrainScan when kind === 'ann_decision_outcome' (regression check — the existing ANN path still works)", async () => {
    runRetrainScan.mockResolvedValueOnce({ scanned: 5, triggered: 2, skipped: 1, errors: 0 });
    const result = await runRetrainScanForEvent({
      id: "evt-ann-1",
      kind: "ann_decision_outcome",
    });
    expect(runRetrainScan).toHaveBeenCalledTimes(1);
    expect(result.scanned).toBe(5);
    expect(result.triggered).toBe(2);
  });

  it("logs a warning that includes the event id and kind when an organism event is skipped (so future maintainers see *why*)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await runRetrainScanForEvent({
        id: "evt-skip-with-id",
        kind: "organism_fitness_history",
      });
      expect(warnSpy).toHaveBeenCalled();
      // Flatten the mock call args to a single string for matching.
      const messages = warnSpy.mock.calls
        .map((c) => c.map((a) => (typeof a === "string" ? a : "")).join(" "))
        .join("\n");
      expect(messages).toMatch(/organism_fitness_history/);
      expect(messages).toMatch(/evt-skip-with-id/);
      // The warning should also explain WHY it was skipped so the
      // next maintainer doesn't have to dig through the ADRs.
      expect(messages).toMatch(/not trigger weight retrain|genome change|ADR 005/);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("delegates to runRetrainScan when kind is missing (backward compat with interval-style or unsourced callers)", async () => {
    runRetrainScan.mockResolvedValueOnce({ scanned: 3, triggered: 0, skipped: 0, errors: 0 });
    const result = await runRetrainScanForEvent({ id: "evt-unsourced" });
    expect(runRetrainScan).toHaveBeenCalledTimes(1);
    expect(result.scanned).toBe(3);
  });
});
