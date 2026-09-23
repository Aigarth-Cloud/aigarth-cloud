/**
 * Evaluation engine — forward pass over the ternary rule-table.
 *
 * Covers:
 *   - clampInput: 0 → 0, 1 → +1, -1 → -1, fractional → 0
 *   - evaluate: deterministic for a fixed (genome, inputs, steps)
 *   - evaluate: input slots are pinned (re-applied at end of each step)
 *   - evaluate: out-of-range node refs default to 0 (don't crash)
 *   - evaluate: returns outputs in the order of output_indices
 *   - evaluateTrace: full step trajectory length === steps + 1
 *   - trinaryToBoolean: 1 → true, -1 → false, 0 → undefined
 */

import { describe, it, expect } from "vitest";
import { Rng } from "../rng.js";
import { freshGenome, makeShape } from "../genome.js";
import {
  clampInput,
  evaluate,
  evaluateTrace,
  trinaryToBoolean,
} from "../eval.js";

describe("clampInput", () => {
  it("maps 0 → 0", () => expect(clampInput(0)).toBe(0));
  it("maps 1 → +1", () => expect(clampInput(1)).toBe(1));
  it("maps -1 → -1", () => expect(clampInput(-1)).toBe(-1));
  it("maps values >= 0.5 to +1", () => {
    expect(clampInput(0.5)).toBe(1);
    expect(clampInput(0.9)).toBe(1);
    expect(clampInput(100)).toBe(1);
  });
  it("maps values <= -0.5 to -1", () => {
    expect(clampInput(-0.5)).toBe(-1);
    expect(clampInput(-0.9)).toBe(-1);
    expect(clampInput(-100)).toBe(-1);
  });
  it("maps values in (-0.5, 0.5) to 0", () => {
    expect(clampInput(0.4)).toBe(0);
    expect(clampInput(-0.4)).toBe(0);
  });
});

describe("evaluate", () => {
  it("is deterministic for fixed (genome, inputs, steps)", () => {
    const g = freshGenome(new Rng(7), 2, 1, 8);
    const a = evaluate(g, [1, 0], 3);
    const b = evaluate(g, [1, 0], 3);
    expect(a).toEqual(b);
  });

  it("rejects non-positive steps", () => {
    const g = freshGenome(new Rng(7), 2, 1, 8);
    expect(() => evaluate(g, [0, 0], 0)).toThrow();
    expect(() => evaluate(g, [0, 0], -1)).toThrow();
    expect(() => evaluate(g, [0, 0], 1.5)).toThrow();
  });

  it("returns one entry per output slot", () => {
    const g = freshGenome(new Rng(7), 2, 1, 8);
    const out = evaluate(g, [1, 0], 3);
    expect(out.length).toBe(1);
    expect([-1, 0, 1]).toContain(out[0]!);
  });

  it("handles multi-output genomes (3 outputs)", () => {
    const g = freshGenome(new Rng(7), 2, 3, 12);
    const out = evaluate(g, [1, 0], 3);
    expect(out.length).toBe(3);
    for (const v of out) expect([-1, 0, 1]).toContain(v);
  });

  it("input slots stay pinned to the external input across steps", () => {
    // Construct a genome where output node 7 reads directly from
    // input slot 0 via a rule that maps (a, a, a) -> a.
    // After multiple steps, the output should still equal the input.
    const rng = new Rng(0);
    const g = freshGenome(rng, 2, 1, 8);
    // Force node 7 (output) to read from input[0] three times.
    g.nodes[7] = {
      inputs: [
        { kind: "input", index: 0 },
        { kind: "input", index: 0 },
        { kind: "input", index: 0 },
      ],
      rule: [
        -1, -1, -1,
         0,  0,  0,
         1,  1,  1,
        -1, -1, -1,
         0,  0,  0,
         1,  1,  1,
        -1, -1, -1,
         0,  0,  0,
         1,  1,  1,
      ],
    };
    // Feed (1, 0). With the rule above, output should be +1.
    expect(evaluate(g, [1, 0], 5)[0]).toBe(1);
    expect(evaluate(g, [0, 1], 5)[0]).toBe(0);
    expect(evaluate(g, [-1, -1], 5)[0]).toBe(-1);
  });

  it("out-of-range node ref defaults to 0 (no crash)", () => {
    const g = freshGenome(new Rng(7), 2, 1, 8);
    // Corrupt one input ref to point outside the node array.
    g.nodes[3]!.inputs = [
      { kind: "node", index: 9999 },
      { kind: "node", index: 0 },
      { kind: "node", index: 0 },
    ];
    expect(() => evaluate(g, [1, 0], 2)).not.toThrow();
  });
});

describe("evaluateTrace", () => {
  it("returns steps + 1 frames (initial state + one per tick)", () => {
    const g = freshGenome(new Rng(7), 2, 1, 8);
    const trace = evaluateTrace(g, [1, 0], 4);
    expect(trace.length).toBe(5);
    for (const frame of trace) {
      expect(frame.length).toBe(g.node_count);
      for (const v of frame) expect([-1, 0, 1]).toContain(v);
    }
  });
});

describe("trinaryToBoolean", () => {
  it("maps +1 → true", () => expect(trinaryToBoolean(1)).toBe(true));
  it("maps -1 → false", () => expect(trinaryToBoolean(-1)).toBe(false));
  it("maps 0 → undefined", () => expect(trinaryToBoolean(0)).toBeUndefined());
});
