/**
 * Evaluation engine — forward pass over a ternary rule-table genome.
 *
 * Given a genome and a vector of external inputs, run the synchronous
 * cellular update for `steps` ticks and return the resulting output
 * states. The output is the state of every node listed in
 * `output_indices` after the last step.
 *
 *   state_0[i] = input[i]                          if i is an input slot
 *              = 0                                 otherwise (default initial)
 *
 *   For t in [1, steps]:
 *     For every node i:
 *       a = lookup(state_{t-1}, node.inputs[0])
 *       b = lookup(state_{t-1}, node.inputs[1])
 *       c = lookup(state_{t-1}, node.inputs[2])
 *       state_t[i] = node.rule[(a+1)*9 + (b+1)*3 + (c+1)]
 *
 *   return state_{steps}[output_indices[0..M]]
 *
 * Inputs are clamped to {-1, 0, 1} before the run. The forward pass
 * never modifies the genome in place.
 */

import type { InputRef, Genome, Node } from "./genome.js";
import { encodeRuleIndex } from "./genome.js";

/** A trinary state vector: index → {-1, 0, 1}. */
export type StateVector = Int8Array;

/**
 * Allocate a zero-initialised state vector for a genome.
 */
function freshState(genome: Genome): StateVector {
  return new Int8Array(genome.node_count);
}

/**
 * Clamp an external input to the trinary alphabet. Anything <= -0.5
 * becomes -1, anything >= 0.5 becomes +1, in between is 0.
 *
 * Boolean inputs (the common case in boolean environments) feed in as
 * 0/1; this converter maps them to -1/+1 cleanly.
 */
export function clampInput(n: number): -1 | 0 | 1 {
  if (n >= 0.5) return 1;
  if (n <= -0.5) return -1;
  return 0;
}

/**
 * Resolve an InputRef against a (state, inputs) pair, returning the
 * value at step t.
 */
function resolveRef(
  ref: InputRef,
  state: StateVector,
  inputs: ReadonlyArray<number>,
): -1 | 0 | 1 {
  switch (ref.kind) {
    case "const":
      return ref.value;
    case "input": {
      const raw = inputs[ref.index] ?? 0;
      return clampInput(raw);
    }
    case "node": {
      const v = state[ref.index];
      if (v === undefined) {
        // Out-of-range node ref — clamp to 0 rather than throw.
        // A genome that references a non-existent node should produce
        // a low fitness, not crash the evaluator.
        return 0;
      }
      return (v as -1 | 0 | 1);
    }
  }
}

/**
 * Run one synchronous update step in place.
 *
 * IMPORTANT: the new state is computed from the OLD state for every
 * node in the same step (no read-your-own-write). We allocate a new
 * vector rather than mutating `state`, then return it.
 */
function step(
  genome: Genome,
  state: StateVector,
  inputs: ReadonlyArray<number>,
): StateVector {
  const next = new Int8Array(genome.node_count);
  for (let i = 0; i < genome.nodes.length; i++) {
    const node = genome.nodes[i] as Node;
    const a = resolveRef(node.inputs[0], state, inputs);
    const b = resolveRef(node.inputs[1], state, inputs);
    const c = resolveRef(node.inputs[2], state, inputs);
    next[i] = node.rule[encodeRuleIndex(a, b, c)]!;
  }
  return next;
}

/**
 * Apply the external inputs to the input slots of a fresh state
 * vector. Slots that aren't listed in `input_indices` stay 0.
 */
function applyInputs(genome: Genome, inputs: ReadonlyArray<number>): StateVector {
  const state = freshState(genome);
  for (let k = 0; k < genome.input_indices.length; k++) {
    const node_idx = genome.input_indices[k]!;
    const raw = inputs[k] ?? 0;
    state[node_idx] = clampInput(raw);
  }
  return state;
}

/**
 * Evaluate a genome on a single input vector. Returns the output
 * states after `steps` ticks of synchronous update.
 *
 * The output is `state[output_indices[0..M]]` after the run. If you
 * want the full trajectory (useful for debugging / visualisation),
 * use `evaluateTrace`.
 */
export function evaluate(
  genome: Genome,
  inputs: ReadonlyArray<number>,
  steps: number = 1,
): ReadonlyArray<-1 | 0 | 1> {
  if (!Number.isInteger(steps) || steps < 1) {
    throw new RangeError(`evaluate: steps must be a positive integer, got ${steps}`);
  }
  let state = applyInputs(genome, inputs);
  for (let t = 0; t < steps; t++) {
    state = step(genome, state, inputs);
  }
  // Re-apply the input slots at the end of each step. Without this,
  // an input slot that another node writes to would diverge from the
  // external signal after the first tick — that is, in most real
  // environments, not what we want. The "input slot is a write-only
  // input pin" semantic matches Anna.exe's observed behaviour.
  for (let k = 0; k < genome.input_indices.length; k++) {
    const node_idx = genome.input_indices[k]!;
    const raw = inputs[k] ?? 0;
    state[node_idx] = clampInput(raw);
  }
  return genome.output_indices.map((i) => state[i]! as -1 | 0 | 1);
}

/**
 * Evaluate a genome and return the entire step-by-step trajectory.
 * Used by tests and debug visualisers; not the hot path.
 */
export function evaluateTrace(
  genome: Genome,
  inputs: ReadonlyArray<number>,
  steps: number = 1,
): ReadonlyArray<ReadonlyArray<-1 | 0 | 1>> {
  if (!Number.isInteger(steps) || steps < 1) {
    throw new RangeError(`evaluateTrace: steps must be a positive integer, got ${steps}`);
  }
  const trace: Array<ReadonlyArray<-1 | 0 | 1>> = [];
  let state = applyInputs(genome, inputs);
  trace.push(stateView(state));
  for (let t = 0; t < steps; t++) {
    state = step(genome, state, inputs);
    for (let k = 0; k < genome.input_indices.length; k++) {
      const node_idx = genome.input_indices[k]!;
      const raw = inputs[k] ?? 0;
      state[node_idx] = clampInput(raw);
    }
    trace.push(stateView(state));
  }
  return trace;
}

function stateView(state: StateVector): ReadonlyArray<-1 | 0 | 1> {
  const out: Array<-1 | 0 | 1> = new Array(state.length);
  for (let i = 0; i < state.length; i++) out[i] = state[i]! as -1 | 0 | 1;
  return out;
}

/**
 * Map the genome's trinary output back to a boolean. Useful when the
 * environment is boolean but the genome emits {-1, 0, 1}:
 *   output == 1 → true
 *   output == 0 → undefined (fitness environments score this as wrong)
 *   output == -1 → false
 *
 * This is the standard "majority vote on the wire value" convention.
 */
export function trinaryToBoolean(v: -1 | 0 | 1): boolean | undefined {
  if (v === 1) return true;
  if (v === -1) return false;
  return undefined;
}
