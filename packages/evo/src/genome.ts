/**
 * Ternary rule-table genome.
 *
 * This is the substrate Anna.exe uses. Every adaptive cell on Aigarth
 * Cloud that wants to "evolve rules rather than weights" carries this
 * shape in its `organisms.genome` JSONB column.
 *
 * Design (mirroring Anna.exe's observed structure):
 *
 *   - The genome holds N "nodes". Each node is a tiny 3-input / 1-output
 *     rule table f(a, b, c) -> {-1, 0, 1}.
 *
 *   - Each node reads from three sources (its "input references"):
 *       - another node's current state (by node index in [0, N))
 *       - an external input bit (by input index in [0, K))
 *       - a literal constant (-1, 0, or 1)
 *
 *   - There are K input slots and M output slots, fixed by the genome
 *     shape. Inputs are read from the environment; outputs are read
 *     after a configurable number of forward steps.
 *
 *   - State evolution is synchronous. At step t+1, every node's next
 *     state is computed from the *step t* states of its three inputs
 *     (no read-your-own-write). This is the standard cellular-automaton
 *     convention; it makes the dynamics deterministic and reproducible.
 *
 *   - The rule table is a flat length-27 array indexed as
 *       idx = (a + 1) * 9 + (b + 1) * 3 + (c + 1)
 *     where each component is -1, 0, or +1. This packs {-1, 0, 1}^3 into
 *     [0, 27) without holes.
 *
 * Wire shape (JSON-serialisable):
 *
 *   {
 *     "schema": "trinary-rule-table@1",
 *     "node_count": 8,
 *     "input_count": 2,
 *     "output_count": 1,
 *     "input_indices": [0, 1],          // which node indices are input slots
 *     "output_indices": [7],            // which node indices are output slots
 *     "nodes": [
 *       { "inputs": [0, 1, 0], "rule": [-1, 0, 1, ...27 entries] },
 *       ...
 *     ],
 *     "version": 0,                     // mutation counter (mutable)
 *     "seed": 0                         // initial-state seed for reproducibility
 *   }
 *
 * The schema string is the version marker; if we change the wire format
 * incompatibly, bump to "trinary-rule-table@2" and add a migration.
 */

import { z } from "zod";
import type { Rng } from "./rng.js";

/** The three trinary states. Re-exported from @aigarth/trinary. */
export { TRINARY_STATES } from "@aigarth/trinary";
export type { TrinaryState } from "@aigarth/trinary";

/** The schema identifier for the wire format. Bumped on breaking changes. */
export const GENOME_SCHEMA = "trinary-rule-table@1";

/** The size of a node's rule table (3^3 = 27). */
export const RULE_TABLE_SIZE = 27;

/**
 * A reference to one of a node's three inputs. The discriminator
 * pattern keeps the wire format self-describing — a reader knows
 * exactly which kind of source to look up without guessing.
 */
export const InputRefSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("node"), index: z.number().int().min(0) }),
  z.object({ kind: z.literal("input"), index: z.number().int().min(0) }),
  z.object({ kind: z.literal("const"), value: z.union([z.literal(-1), z.literal(0), z.literal(1)]) }),
]);
export type InputRef = z.infer<typeof InputRefSchema>;

/** A single node in the rule-table genome. */
export const NodeSchema = z.object({
  /** Three input references. Order matters: they become the a, b, c of the rule lookup. */
  inputs: z.tuple([InputRefSchema, InputRefSchema, InputRefSchema]),
  /** Flat 27-entry rule table; entries must be in {-1, 0, 1}. */
  rule: z.array(z.union([z.literal(-1), z.literal(0), z.literal(1)])).length(RULE_TABLE_SIZE),
});
export type Node = z.infer<typeof NodeSchema>;

/** The full genome shape. */
export const GenomeSchema = z.object({
  schema: z.literal(GENOME_SCHEMA),
  node_count: z.number().int().min(1).max(1024),
  input_count: z.number().int().min(0).max(64),
  output_count: z.number().int().min(1).max(64),
  input_indices: z.array(z.number().int().min(0)).min(0),
  output_indices: z.array(z.number().int().min(0)).min(1),
  nodes: z.array(NodeSchema).min(1),
  version: z.number().int().min(0),
  seed: z.number().int(),
});
export type Genome = z.infer<typeof GenomeSchema>;

/**
 * Genome shape descriptor (the immutable parts of a genome).
 * Separates the structural choices (how many nodes, which are
 * inputs/outputs) from the mutable genome body. A single shape can
 * be re-used across many mutation cycles; only the `nodes` array
 * changes between generations.
 */
export interface GenomeShape {
  node_count: number;
  input_count: number;
  output_count: number;
  input_indices: readonly number[];
  output_indices: readonly number[];
}

/**
 * Build a default shape for a given environment.
 *
 * Convention:
 *   - input slots occupy indices [0, K)
 *   - output slots occupy indices [N - M, N)
 *   - the middle [K, N - M) are free mutable nodes
 *
 * This means a shape always has at least `input_count + output_count` nodes.
 * For XOR (2 in, 1 out) the minimum is 3 nodes; we pad up to `node_count`.
 */
export function makeShape(
  input_count: number,
  output_count: number,
  node_count: number,
): GenomeShape {
  if (input_count < 0 || !Number.isInteger(input_count)) {
    throw new RangeError(`makeShape: input_count must be a non-negative integer, got ${input_count}`);
  }
  if (output_count < 1 || !Number.isInteger(output_count)) {
    throw new RangeError(`makeShape: output_count must be a positive integer, got ${output_count}`);
  }
  if (node_count < input_count + output_count || !Number.isInteger(node_count)) {
    throw new RangeError(
      `makeShape: node_count (${node_count}) must be >= input_count + output_count (${input_count + output_count})`,
    );
  }

  const input_indices: number[] = [];
  for (let i = 0; i < input_count; i++) input_indices.push(i);

  const output_indices: number[] = [];
  for (let i = node_count - output_count; i < node_count; i++) output_indices.push(i);

  return {
    node_count,
    input_count,
    output_count,
    input_indices,
    output_indices,
  };
}

/** A uniformly random rule (each of the 27 entries picked independently). */
function randomRule(rng: Rng): Node["rule"] {
  const out: number[] = new Array(RULE_TABLE_SIZE);
  for (let i = 0; i < RULE_TABLE_SIZE; i++) out[i] = (rng.int(3) - 1) as -1 | 0 | 1;
  return out as Node["rule"];
}

/**
 * A random input reference that points at something legitimate for
 * a given shape. The bias weights:
 *   - 50% another node (most common, drives computation)
 *   - 30% an external input (gives the genome a way to read environment)
 *   - 20% a constant (gives the genome a bias term)
 *
 * For nodes that *are* input slots, the reference is forced to
 * `input[k]` because input slots have no incoming rule — they're
 * driven externally.
 */
function randomInputRef(
  rng: Rng,
  shape: GenomeShape,
  node_index: number,
  slot_index: number,
): InputRef {
  if (shape.input_indices.includes(node_index)) {
    // Input slot: pin to the matching external input.
    return { kind: "input", index: slot_index };
  }
  const roll = rng.next();
  if (roll < 0.5) {
    // Reference another node. Bias toward earlier nodes so information
    // flows forward (avoids accidental cycles in the very first
    // generation; cycles are possible via mutation later).
    const maxIdx = Math.max(1, node_index);
    return { kind: "node", index: rng.int(maxIdx) };
  }
  if (roll < 0.8) {
    return { kind: "input", index: rng.int(shape.input_count) };
  }
  return { kind: "const", value: (rng.int(3) - 1) as -1 | 0 | 1 };
}

/**
 * Build a fresh, random genome for a given shape. The seed used for
 * initial state and rule randomness is taken from the `Rng` instance
 * so two calls with the same seed produce identical genomes.
 */
export function randomGenome(rng: Rng, shape: GenomeShape): Genome {
  const nodes: Node[] = [];
  let slot = 0;
  for (let i = 0; i < shape.node_count; i++) {
    const a = randomInputRef(rng, shape, i, slot);
    // Bump the slot cursor only when this node IS an input slot.
    if (shape.input_indices.includes(i)) slot += 1;
    const b = randomInputRef(rng, shape, i, slot);
    if (shape.input_indices.includes(i)) slot += 1;
    const c = randomInputRef(rng, shape, i, slot);
    if (shape.input_indices.includes(i)) slot += 1;
    nodes.push({ inputs: [a, b, c], rule: randomRule(rng) });
  }
  return {
    schema: GENOME_SCHEMA,
    node_count: shape.node_count,
    input_count: shape.input_count,
    output_count: shape.output_count,
    input_indices: [...shape.input_indices],
    output_indices: [...shape.output_indices],
    nodes,
    version: 0,
    seed: rng.int(0x7fffffff),
  };
}

/**
 * Decode a packed rule index back into (a, b, c) for a given offset.
 * idx = (a+1)*9 + (b+1)*3 + (c+1), so reverse:
 *   c = (idx % 3) - 1
 *   b = (Math.floor(idx / 3) % 3) - 1
 *   a = (Math.floor(idx / 9)) - 1
 */
export function decodeRuleIndex(idx: number): { a: -1 | 0 | 1; b: -1 | 0 | 1; c: -1 | 0 | 1 } {
  if (!Number.isInteger(idx) || idx < 0 || idx >= RULE_TABLE_SIZE) {
    throw new RangeError(`decodeRuleIndex: idx must be in [0, 27), got ${idx}`);
  }
  const c = ((idx % 3) - 1) as -1 | 0 | 1;
  const b = ((Math.floor(idx / 3) % 3) - 1) as -1 | 0 | 1;
  const a = (Math.floor(idx / 9) - 1) as -1 | 0 | 1;
  return { a, b, c };
}

/**
 * Encode (a, b, c) back into a rule index. Inverse of decodeRuleIndex.
 */
export function encodeRuleIndex(a: number, b: number, c: number): number {
  // Strict trinary check: each value must be EXACTLY -1, 0, or +1.
  // (A previous version used a bitwise-OR arithmetic test that
  // mis-fired for -1 — the bitwise OR of negative integers can
  // collapse to a value distinct from the arithmetic sum.)
  for (const v of [a, b, c]) {
    if (v !== -1 && v !== 0 && v !== 1) {
      throw new RangeError(`encodeRuleIndex: a, b, c must each be in {-1, 0, 1}, got ${a}, ${b}, ${c}`);
    }
  }
  return (a + 1) * 9 + (b + 1) * 3 + (c + 1);
}

/**
 * Stable hash of a genome's mutation-relevant content. Used by the
 * evolution driver to dedupe equivalent genomes and by tests to
 * assert "the same seed produced the same starting population".
 *
 * Excludes `version` (which changes every mutation) and `seed`
 * (which is per-instance metadata, not content).
 */
export function genomeContentHash(genome: Genome): string {
  // We use a tiny djb2-style hash so the package has no crypto dep
  // for this helper; full sha256 lives in the wire canonicaliser
  // (`@aigarth/trinary/canonicalize`).
  let h = 5381;
  const mix = (s: string): void => {
    for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  };
  mix(`${genome.schema}|${genome.node_count}|${genome.input_count}|${genome.output_count}|`);
  mix(`inputs:${genome.input_indices.join(",")}|outputs:${genome.output_indices.join(",")}|`);
  for (const node of genome.nodes) {
    mix(`n(${node.inputs[0].kind},${node.inputs[1].kind},${node.inputs[2].kind})|`);
    mix(`${node.rule.join(",")}|`);
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * Convenience: build a shape + genome in one call.
 * Common case in fitness environments ("give me a fresh genome for XOR").
 */
export function freshGenome(rng: Rng, input_count: number, output_count: number, node_count: number): Genome {
  return randomGenome(rng, makeShape(input_count, output_count, node_count));
}
