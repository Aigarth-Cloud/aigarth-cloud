/**
 * Mutation operators on ternary rule-table genomes.
 *
 * Anna.exe's three observed mutation modes map to:
 *   - point-rule     : flip a single rule entry (-1 <-> 0, 0 <-> +1, +1 <-> -1)
 *   - point-input    : change a node's input reference to another node/input/const
 *   - whole-rule     : replace an entire node's rule table
 *
 * We add a fourth operator — uniform-crossover — for the population
 * driver (tournament selection + crossover + point-mutation is a
 * textbook GA, and beats pure hill-climbing on deceptive fitness
 * landscapes like XOR).
 *
 * Mutation operators always return a NEW genome. They never mutate
 * the input in place; this keeps the audit trail clean (every
 * `version` bump is a fresh object) and makes the operations
 * trivially thread-safe.
 */

import type { Rng } from "./rng.js";
import type { Genome, Node, InputRef } from "./genome.js";
import { RULE_TABLE_SIZE } from "./genome.js";

/** Pick a uniformly random trinary state. */
function tri(rng: Rng): -1 | 0 | 1 {
  return (rng.int(3) - 1) as -1 | 0 | 1;
}

/**
 * Cyclic-flip a trinary state within {-1, 0, 1}.
 *
 *   +1 ↔ -1 (always — they are opposites)
 *    0  → +1 or -1 with a 50/50 split driven by the supplied RNG
 *
 * The +1/-1 ↔ swap is the canonical "flip a trinary bit" operation;
 * the 0 case is split so mutation can move *out* of the neutral basin
 * (the all-zero output is a common local optimum the evolution
 * driver needs to escape).
 */
function flipTri(rng: Rng, v: -1 | 0 | 1): -1 | 0 | 1 {
  if (v === 1) return -1;
  if (v === -1) return 1;
  return rng.next() < 0.5 ? 1 : -1;
}

/**
 * Pick a new input reference of the same kind as `ref`, but with a
 * fresh value drawn from the genome's allowable range.
 */
function mutateInputRef(
  rng: Rng,
  genome: Genome,
  ref: InputRef,
  node_idx: number,
): InputRef {
  switch (ref.kind) {
    case "const":
      // 50% flip value, 50% change kind (to a node ref pointing at
      // a random earlier node).
      if (rng.next() < 0.5) {
        return { kind: "const", value: tri(rng) };
      }
      return { kind: "node", index: rng.int(Math.max(1, node_idx)) };
    case "node": {
      const maxIdx = Math.max(1, genome.node_count);
      return { kind: "node", index: rng.int(maxIdx) };
    }
    case "input": {
      if (genome.input_count === 0) {
        // No inputs to reference; fall back to const.
        return { kind: "const", value: tri(rng) };
      }
      return { kind: "input", index: rng.int(genome.input_count) };
    }
  }
}

/**
 * Replace a single rule entry with a fresh trinary value.
 *
 * This is the most local mutation: it changes one cell of the
 * 27-entry table. At a per-bit mutation rate of ~1/RULE_TABLE_SIZE,
 * one point-rule flip per generation is the expected load.
 */
export function pointRuleMutation(rng: Rng, genome: Genome): Genome {
  const target = rng.int(genome.nodes.length);
  const idx = rng.int(RULE_TABLE_SIZE);
  const node = genome.nodes[target]!;
  const newRule: Array<-1 | 0 | 1> = [...node.rule];
  newRule[idx] = flipTri(rng, newRule[idx]!);
  const newNodes = genome.nodes.map((n, i) =>
    i === target ? { inputs: n.inputs, rule: newRule as Node["rule"] } : n,
  );
  return { ...genome, nodes: newNodes, version: genome.version + 1 };
}

/**
 * Change one input reference on one node.
 */
export function pointInputMutation(rng: Rng, genome: Genome): Genome {
  const target = rng.int(genome.nodes.length);
  const which = rng.int(3);
  const node = genome.nodes[target]!;
  const newInputs: [InputRef, InputRef, InputRef] = [...node.inputs] as [
    InputRef,
    InputRef,
    InputRef,
  ];
  newInputs[which] = mutateInputRef(rng, genome, newInputs[which]!, target);
  const newNodes = genome.nodes.map((n, i) =>
    i === target ? { inputs: newInputs, rule: n.rule } : n,
  );
  return { ...genome, nodes: newNodes, version: genome.version + 1 };
}

/**
 * Replace an entire rule table with a fresh random one.
 *
 * Higher-variance operator; useful for escaping local optima but
 * destructive when applied too often. Default per-call probability
 * is low in the evolution driver (~5%).
 */
export function wholeRuleMutation(rng: Rng, genome: Genome): Genome {
  const target = rng.int(genome.nodes.length);
  const freshRule: Array<-1 | 0 | 1> = new Array(RULE_TABLE_SIZE);
  for (let i = 0; i < RULE_TABLE_SIZE; i++) freshRule[i] = tri(rng);
  const newNodes = genome.nodes.map((n, i) =>
    i === target ? { inputs: n.inputs, rule: freshRule as Node["rule"] } : n,
  );
  return { ...genome, nodes: newNodes, version: genome.version + 1 };
}

/**
 * Uniform crossover: pick a random node index; take nodes [0, idx)
 * from `a` and [idx, N) from `b`. Both parents must share a shape.
 *
 * If the parents have different shapes (different node counts),
 * we fall back to copying `a` verbatim and returning it; this
 * matches the "don't crash on a malformed population" convention
 * used elsewhere in the engine.
 */
export function crossover(rng: Rng, a: Genome, b: Genome): Genome {
  if (a.node_count !== b.node_count) {
    return { ...a, version: a.version + 1 };
  }
  const cut = rng.int(a.nodes.length + 1); // 0..N inclusive
  const newNodes: Node[] = [];
  for (let i = 0; i < a.nodes.length; i++) {
    newNodes.push(i < cut ? a.nodes[i]! : b.nodes[i]!);
  }
  return {
    ...a,
    nodes: newNodes,
    version: a.version + 1,
  };
}

/**
 * Apply one of {pointRule, pointInput, wholeRule} according to a
 * weighted distribution. The default weights match the Anna.exe
 * heuristic: most mutations are tiny (rule), fewer are structural
 * (input), rare are wholesale (whole-rule).
 */
export function mutate(
  rng: Rng,
  genome: Genome,
  weights: { point_rule: number; point_input: number; whole_rule: number } = {
    point_rule: 0.7,
    point_input: 0.25,
    whole_rule: 0.05,
  },
): Genome {
  const total = weights.point_rule + weights.point_input + weights.whole_rule;
  if (total <= 0) {
    throw new RangeError(`mutate: weights must sum to a positive number, got ${total}`);
  }
  const roll = rng.next() * total;
  if (roll < weights.point_rule) return pointRuleMutation(rng, genome);
  if (roll < weights.point_rule + weights.point_input) return pointInputMutation(rng, genome);
  return wholeRuleMutation(rng, genome);
}
