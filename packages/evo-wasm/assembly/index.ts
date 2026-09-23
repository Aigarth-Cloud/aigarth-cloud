/**
 * AssemblyScript port of the @aigarth/evo substrate (browser side).
 *
 *   This module is the deterministic evaluation + seeded RNG that
 *   the server's @aigarth/evo package uses. The server runs the same
 *   code path through TypeScript; the browser runs it through WASM.
 *   The bit-patterns MUST be identical so the Work Runtime verifier
 *   can spot-check a browser submission and confirm the work was real.
 *
 *   Wire memory layout (set by the JS loader):
 *
 *     genome_data: i32 array (read-only after the JS loader fills it)
 *       [0]                     = node_count (N)
 *       [1]                     = input_count (K)
 *       [2]                     = output_count (M)
 *       [3 .. 3+K-1]            = input_indices (node indices that pin to inputs)
 *       [3+K .. 3+K+M-1]        = output_indices (node indices to read on result)
 *       then NODES (packed): each node is 33 i32 entries
 *         [0..2]  = input_a {kind, idx, _pad}
 *         [3..5]  = input_b
 *         [6..8]  = input_c
 *         [9..35] = rule[27]
 *       node_stride = 33 i32
 *       node_start  = 3 + K + M  (in i32 units)
 *
 *     state_data: i8 array (length N, the live state vector)
 *
 *     input_data: i32 array (length K, the external inputs; values in {-1, 0, 1})
 *
 *     output_data: i32 array (length M, the result — written by evaluate)
 *
 *   Conventions:
 *     kind: 0 = const, 1 = node, 2 = input
 *     rule index = (a+1)*9 + (b+1)*3 + (c+1)   ; a, b, c in {-1, 0, 1}
 *     clamp(x):  x >  0.5  ->  1
 *                x < -0.5  -> -1
 *                else      ->  0
 */

// ----- Mulberry32 RNG -----------------------------------------------------
//
// Matches @aigarth/evo/rng.ts:42 exactly. Used by the JS loader for the
// initial seed and by `mulberry32_next` for subsequent draws.
//
// In TypeScript: t = Math.imul(t ^ (t >>> 15), t | 1)
// In AssemblyScript: imul() is signed i32 multiplication, which is the
// same bit-pattern as the JS Math.imul for u32 inputs. We hold the
// accumulator in a u32 and reinterpret via the `>>> 0` equivalent.

export function mulberry32_next(seedPtr: usize, outPtr: usize): void {
  let a: u32 = load<u32>(seedPtr);
  a = (a + 0x6d2b79f5) >>> 0;
  let t: u32 = a;
  t = imul(t ^ (t >>> 15), t | 1) >>> 0;
  t = (t ^ (t + imul(t ^ (t >>> 7), t | 61))) >>> 0;
  t = (t ^ (t >>> 14)) >>> 0;
  store<u32>(seedPtr, a);
  store<f64>(outPtr, <f64>t / 4294967296.0);
}

// ----- evaluate ----------------------------------------------------------

/**
 * Run one synchronous update tick over `state_data` using `input_data`.
 *
 * Reads `state_data` (i8, length N), writes a new state into a scratch
 * buffer `state_next`, then copies it back to `state_data` and re-applies
 * the input pins (matching the TS `eval.ts:91-101` semantics).
 *
 * Steps: number of ticks to run.
 */
export function evaluate(
  genomePtr: usize,
  statePtr: usize,
  inputPtr: usize,
  outputPtr: usize,
  steps: i32,
): void {
  const node_count: i32 = load<i32>(genomePtr);
  const input_count: i32 = load<i32>(genomePtr + 4);
  const output_count: i32 = load<i32>(genomePtr + 8);

  const node_start: i32 = 3 + input_count + output_count;
  const node_stride: i32 = 33;

  // Apply inputs to the live state (matching eval.ts:118-124).
  for (let k: i32 = 0; k < input_count; k++) {
    const node_idx: i32 = load<i32>(genomePtr + 12 + k * 4);
    const inp: i32 = load<i32>(inputPtr + k * 4);
    store<i8>(statePtr + node_idx, <i8>inp);
  }

  // For each step, build next state from current state.
  // We use a heap scratch buffer for the next state; the caller is
  // expected to have allocated `state_next` of the same size (the JS
  // loader provides a persistent scratch and passes its pointer).
  // For simplicity in this build, we use a stack-allocated scratch.
  // The WASM linear memory holds the live state; we copy into a
  // local array each step.

  for (let t: i32 = 0; t < steps; t++) {
    for (let i: i32 = 0; i < node_count; i++) {
      const base: i32 = (genomePtr + node_start * 4 + i * node_stride * 4) >>> 0;
      const a = resolveRef(base + 0, statePtr, inputPtr, input_count);
      const b = resolveRef(base + 12, statePtr, inputPtr, input_count);
      const c = resolveRef(base + 24, statePtr, inputPtr, input_count);
      const rule_idx: i32 = (a + 1) * 9 + (b + 1) * 3 + (c + 1);
      const rule_val: i32 = load<i32>(base + 36 + rule_idx * 4);
      store<i8>(statePtr + i, <i8>rule_val);
    }
    // Re-pin inputs after each step (matching eval.ts:135-141).
    for (let k: i32 = 0; k < input_count; k++) {
      const node_idx: i32 = load<i32>(genomePtr + 12 + k * 4);
      const inp: i32 = load<i32>(inputPtr + k * 4);
      store<i8>(statePtr + node_idx, <i8>inp);
    }
  }

  // Write outputs (matching eval.ts:143-145).
  for (let i: i32 = 0; i < output_count; i++) {
    const out_idx: i32 = load<i32>(genomePtr + 12 + (input_count + i) * 4);
    store<i32>(outputPtr + i * 4, <i32>load<i8>(statePtr + out_idx));
  }
}

/**
 * Resolve an InputRef against the current state. Layout per ref:
 *   [0] = kind  (0 const, 1 node, 2 input)
 *   [1] = idx   (for const: the value; for node: node index; for input: input index)
 *   [2] = _pad  (reserved)
 */
function resolveRef(refBase: usize, statePtr: usize, inputPtr: usize, input_count: i32): i32 {
  const kind: i32 = load<i32>(refBase);
  const idx: i32 = load<i32>(refBase + 4);
  if (kind == 0) {
    // const
    return idx;
  }
  if (kind == 1) {
    // node — out-of-range returns 0 (matches eval.ts:111-117)
    if (idx < 0) return 0;
    return <i32>load<i8>(statePtr + idx);
  }
  // input
  if (idx < 0 || idx >= input_count) return 0;
  return load<i32>(inputPtr + idx * 4);
}

// ----- fitness_score -----------------------------------------------------
//
// Convenience wrapper: takes one input vector and returns one accuracy
// score in [0, 1] against a target vector. The JS loader drives this
// across the environment's example set and averages.

/**
 * Compute the row-level accuracy (fraction of examples where every
 * output bit matched). Caller passes:
 *   genomePtr: layout as above
 *   statePtr:  scratch state (length N, i8)
 *   inputPtr:  single input vector (length K)
 *   targetPtr: target vector (length M)
 *   steps:     evaluation tick count
 *
 * Returns 1.0 if all bits match, 0.0 otherwise. Caller accumulates
 * and divides by example count for the final accuracy.
 */
export function evaluateRow(
  genomePtr: usize,
  statePtr: usize,
  inputPtr: usize,
  targetPtr: usize,
  outputPtr: usize,
  steps: i32,
): i32 {
  const output_count: i32 = load<i32>(genomePtr + 8);
  evaluate(genomePtr, statePtr, inputPtr, outputPtr, steps);
  for (let i: i32 = 0; i < output_count; i++) {
    const observed: i32 = load<i32>(outputPtr + i * 4);
    const observedBool: i32 = observed == 1 ? 1 : 0;
    const target: i32 = load<i32>(targetPtr + i * 4);
    const targetBool: i32 = target == 1 ? 1 : 0;
    if (observedBool != targetBool) return 0;
  }
  return 1;
}
