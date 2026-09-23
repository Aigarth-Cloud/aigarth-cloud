/**
 * Rng — Mulberry32 deterministic PRNG.
 *
 * Covers:
 *   - determinism: same seed → same stream
 *   - bounds: next()/int()/intRange() stay in range over 1000 draws
 *   - pick/shuffle correctness on small arrays
 *   - input validation (negative/zero/non-integer seeds, empty arrays)
 */

import { describe, it, expect } from "vitest";
import { Rng, mulberry32 } from "../rng.js";

describe("mulberry32", () => {
  it("is deterministic: same seed → identical stream", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it("produces different streams for different seeds", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    let diffs = 0;
    for (let i = 0; i < 100; i++) {
      if (a() !== b()) diffs += 1;
    }
    expect(diffs).toBeGreaterThan(50);
  });

  it("returns values in [0, 1) over a long run", () => {
    const r = mulberry32(99);
    for (let i = 0; i < 10_000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("Rng", () => {
  it("rejects non-finite seeds", () => {
    expect(() => new Rng(Number.NaN)).toThrow(/finite number/);
    expect(() => new Rng(Number.POSITIVE_INFINITY)).toThrow(/finite number/);
  });

  it("int(max) returns integers in [0, max) over 1000 draws", () => {
    const r = new Rng(7);
    const max = 5;
    for (let i = 0; i < 1000; i++) {
      const v = r.int(max);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(max);
    }
  });

  it("int(max) rejects non-positive or non-integer max", () => {
    const r = new Rng(7);
    expect(() => r.int(0)).toThrow();
    expect(() => r.int(-1)).toThrow();
    expect(() => r.int(1.5)).toThrow();
  });

  it("intRange(min, max) returns integers in [min, max] inclusive", () => {
    const r = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.intRange(2, 5);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
    }
  });

  it("intRange rejects inverted or non-integer ranges", () => {
    const r = new Rng(7);
    expect(() => r.intRange(5, 2)).toThrow();
    expect(() => r.intRange(1.5, 3)).toThrow();
  });

  it("pick returns one of the elements", () => {
    const r = new Rng(7);
    const arr = [10, 20, 30, 40];
    for (let i = 0; i < 100; i++) {
      expect(arr).toContain(r.pick(arr));
    }
  });

  it("pick throws on empty array", () => {
    const r = new Rng(7);
    expect(() => r.pick([])).toThrow();
  });

  it("shuffle is a permutation (same elements, same length)", () => {
    const r = new Rng(7);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const before = [...arr];
    const out = r.shuffle(arr);
    expect(out).toBe(arr); // in place
    expect([...out].sort()).toEqual([...before].sort());
    expect(out.length).toBe(before.length);
  });

  it("shuffle on a 1-element array is a no-op", () => {
    const r = new Rng(7);
    const arr = [42];
    const out = r.shuffle(arr);
    expect(out).toEqual([42]);
  });
});
