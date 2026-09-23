/**
 * Genome — wire format + constructors + indexing.
 *
 * Covers:
 *   - makeShape: input/output slot convention
 *   - randomGenome: validity against the Zod schema
 *   - encode/decode rule index: round-trip and bounds
 *   - genomeContentHash: same seed → same hash, different seed → different hash
 *   - freshGenome convenience
 */

import { describe, it, expect } from "vitest";
import { Rng } from "../rng.js";
import {
  GENOME_SCHEMA,
  RULE_TABLE_SIZE,
  decodeRuleIndex,
  encodeRuleIndex,
  freshGenome,
  genomeContentHash,
  makeShape,
  randomGenome,
  GenomeSchema,
} from "../genome.js";

describe("encode/decode rule index", () => {
  it("round-trips all 27 combinations of {-1, 0, 1}^3", () => {
    for (let a = -1; a <= 1; a++) {
      for (let b = -1; b <= 1; b++) {
        for (let c = -1; c <= 1; c++) {
          const idx = encodeRuleIndex(a, b, c);
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(RULE_TABLE_SIZE);
          const back = decodeRuleIndex(idx);
          expect(back).toEqual({ a, b, c });
        }
      }
    }
  });

  it("encodeRuleIndex rejects non-trinary inputs", () => {
    expect(() => encodeRuleIndex(2, 0, 0)).toThrow();
    expect(() => encodeRuleIndex(0, 0, -2)).toThrow();
  });

  it("decodeRuleIndex rejects out-of-range", () => {
    expect(() => decodeRuleIndex(-1)).toThrow();
    expect(() => decodeRuleIndex(RULE_TABLE_SIZE)).toThrow();
    expect(() => decodeRuleIndex(1.5)).toThrow();
  });
});

describe("makeShape", () => {
  it("puts input slots at [0, K) and output slots at [N-M, N)", () => {
    const s = makeShape(2, 1, 8);
    expect(s.node_count).toBe(8);
    expect(s.input_count).toBe(2);
    expect(s.output_count).toBe(1);
    expect(s.input_indices).toEqual([0, 1]);
    expect(s.output_indices).toEqual([7]);
  });

  it("rejects node_count < input_count + output_count", () => {
    expect(() => makeShape(2, 1, 2)).toThrow();
  });

  it("rejects non-positive output_count", () => {
    expect(() => makeShape(2, 0, 8)).toThrow();
  });

  it("rejects non-integer input_count", () => {
    expect(() => makeShape(2.5, 1, 8)).toThrow();
  });
});

describe("randomGenome", () => {
  it("is deterministic for a fixed seed", () => {
    const g1 = randomGenome(new Rng(123), makeShape(2, 1, 8));
    const g2 = randomGenome(new Rng(123), makeShape(2, 1, 8));
    expect(genomeContentHash(g1)).toBe(genomeContentHash(g2));
  });

  it("produces different genomes for different seeds", () => {
    const g1 = randomGenome(new Rng(1), makeShape(2, 1, 8));
    const g2 = randomGenome(new Rng(2), makeShape(2, 1, 8));
    expect(genomeContentHash(g1)).not.toBe(genomeContentHash(g2));
  });

  it("validates against the Zod schema", () => {
    const g = randomGenome(new Rng(7), makeShape(3, 1, 12));
    const r = GenomeSchema.safeParse(g);
    expect(r.success).toBe(true);
  });

  it("input slot nodes are pinned to external inputs", () => {
    // With 2 inputs, nodes 0 and 1 must reference {kind: input, ...}
    const g = randomGenome(new Rng(7), makeShape(2, 1, 8));
    expect(g.nodes[0]!.inputs.every((r) => r.kind === "input")).toBe(true);
    expect(g.nodes[1]!.inputs.every((r) => r.kind === "input")).toBe(true);
  });

  it("rule tables have exactly 27 entries each, all in {-1, 0, 1}", () => {
    const g = randomGenome(new Rng(7), makeShape(2, 1, 8));
    for (const node of g.nodes) {
      expect(node.rule.length).toBe(RULE_TABLE_SIZE);
      for (const v of node.rule) {
        expect([-1, 0, 1]).toContain(v);
      }
    }
  });

  it("starts at version 0", () => {
    const g = randomGenome(new Rng(7), makeShape(2, 1, 8));
    expect(g.version).toBe(0);
  });

  it("schema field equals GENOME_SCHEMA", () => {
    const g = randomGenome(new Rng(7), makeShape(2, 1, 8));
    expect(g.schema).toBe(GENOME_SCHEMA);
  });
});

describe("freshGenome", () => {
  it("matches the schema of the equivalent randomGenome + makeShape pair", () => {
    const a = freshGenome(new Rng(7), 2, 1, 8);
    const b = randomGenome(new Rng(7), makeShape(2, 1, 8));
    expect(a.node_count).toBe(b.node_count);
    expect(a.input_count).toBe(b.input_count);
    expect(a.output_count).toBe(b.output_count);
    expect(a.input_indices).toEqual(b.input_indices);
    expect(a.output_indices).toEqual(b.output_indices);
  });
});
