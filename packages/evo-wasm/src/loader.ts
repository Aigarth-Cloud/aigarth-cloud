/**
 * @aigarth/evo-wasm — JS loader for the WASM-compiled substrate.
 *
 *   Wraps the AssemblyScript module and exposes a synchronous API:
 *     - encodeGenome(Genome)  → packed i32 buffer (memory layout)
 *     - evaluateRow(eval)     → 0 or 1 (did the row pass?)
 *     - newRng(seed)          → { next(), int(max), intRange(min, max) }
 *
 *   The bit-pattern of `evaluateRow` is identical to the server's
 *   @aigarth/evo TypeScript implementation, so the Work Runtime
 *   verifier can spot-check a browser submission by re-running the
 *   same genome + inputs on the server.
 *
 *   This loader is the canonical client-side substrate for browser
 *   workers. The Web Worker host code in apps/dashboard wraps this
 *   with claim/post-result lifecycle logic.
 */

import type { Genome } from "@aigarth/evo";

/**
 * WASM exports surface — the relevant subset of the AssemblyScript
 * runtime exports we depend on. The full runtime also exports
 * `__new`, `__pin`, `__unpin`, `__collect`, etc.; we don't use them
 * here because we manage all memory ourselves via ArrayBuffers.
 */
export interface EvoWasmExports {
  memory: WebAssembly.Memory;
  mulberry32_next: (seedPtr: number, outPtr: number) => void;
  evaluate: (
    genomePtr: number,
    statePtr: number,
    inputPtr: number,
    outputPtr: number,
    steps: number,
  ) => void;
  evaluateRow: (
    genomePtr: number,
    statePtr: number,
    inputPtr: number,
    targetPtr: number,
    outputPtr: number,
    steps: number,
  ) => number;
}

export interface EvoWasmModule {
  exports: EvoWasmExports;
  /** The backing ArrayBuffer for the linear memory. */
  memoryBuffer: ArrayBuffer;
}

/** Lazily-loaded WASM module promise. */
let modulePromise: Promise<EvoWasmModule> | null = null;

/**
 * Load the WASM module from the canonical `./evo-wasm.wasm` URL.
 * The Web Worker host is expected to import the .wasm as a static
 * asset (Vite/webpack handle this with `?url` or `import wasm from ...`).
 */
export async function loadEvoWasm(wasmUrl: string | URL): Promise<EvoWasmModule> {
  if (modulePromise) return modulePromise;
  modulePromise = (async () => {
    const res = await fetch(wasmUrl);
    if (!res.ok) {
      throw new Error(`Failed to load evo-wasm: HTTP ${res.status}`);
    }
    const bytes = await res.arrayBuffer();
    const result = await WebAssembly.instantiate(bytes, {
      env: {},
    });
    const exports = result.instance.exports as unknown as EvoWasmExports;
    if (!exports.memory) {
      throw new Error("evo-wasm: missing memory export");
    }
    return {
      exports,
      memoryBuffer: exports.memory.buffer,
    };
  })();
  return modulePromise;
}

/**
 * One packed-genome + scratch-state handle. Created by `packGenome`
 * and used by `evaluateRow` on the WASM module.
 */
export interface PackedGenome {
  /** Number of nodes (N). */
  readonly nodeCount: number;
  /** Number of input slots (K). */
  readonly inputCount: number;
  /** Number of output slots (M). */
  readonly outputCount: number;
  /** Index into the wasm memory of the genome buffer (in i32 units). */
  readonly genomePtr: number;
  /** Index into the wasm memory of the scratch state (in i8 units). */
  readonly statePtr: number;
  /** Backing ArrayBuffer for the genome (kept alive by reference). */
  readonly genomeBuffer: Int32Array;
  /** Backing ArrayBuffer for the scratch state. */
  readonly stateBuffer: Int8Array;
}

/** Allocate `count` i32 entries inside the WASM linear memory. */
function allocI32(wasm: EvoWasmModule, count: number): { ptr: number; view: Int32Array } {
  // AS uses a bump allocator exposed as __new; we manage our own
  // scratch region by simply writing past the current memory limit
  // and growing if needed.
  const bytesNeeded = count * 4;
  const cur = wasm.memoryBuffer.byteLength;
  let target = cur;
  while (target < cur + bytesNeeded) target *= 2;
  wasm.exports.memory.grow(Math.ceil((target - cur) / 65536));
  const ptr = cur;
  return { ptr, view: new Int32Array(wasm.memoryBuffer, ptr, count) };
}

/** Allocate `count` i8 entries. */
function allocI8(wasm: EvoWasmModule, count: number): { ptr: number; view: Int8Array } {
  const bytesNeeded = count;
  const cur = wasm.memoryBuffer.byteLength;
  let target = cur;
  while (target < cur + bytesNeeded) target *= 2;
  wasm.exports.memory.grow(Math.ceil((target - cur) / 65536));
  const ptr = cur;
  return { ptr, view: new Int8Array(wasm.memoryBuffer, ptr, count) };
}

/**
 * Pack a `Genome` (the canonical JSON shape) into the WASM memory
 * layout described in assembly/index.ts.
 *
 * Layout:
 *   [0]                    = node_count
 *   [1]                    = input_count
 *   [2]                    = output_count
 *   [3..3+K-1]             = input_indices
 *   [3+K..3+K+M-1]         = output_indices
 *   then NODES (each 33 i32 entries):
 *     [0..2] = input_a {kind, idx, _pad}
 *     [3..5] = input_b {kind, idx, _pad}
 *     [6..8] = input_c {kind, idx, _pad}
 *     [9..35] = rule[27]
 */
export function packGenome(wasm: EvoWasmModule, genome: Genome): PackedGenome {
  const N = genome.node_count;
  const K = genome.input_count;
  const M = genome.output_count;
  const HEADER = 3 + K + M;
  const NODES = N * 33;
  const total = HEADER + NODES;
  const { ptr, view } = allocI32(wasm, total);
  let off = 0;
  view[off++] = N;
  view[off++] = K;
  view[off++] = M;
  for (const ix of genome.input_indices) view[off++] = ix;
  for (const ix of genome.output_indices) view[off++] = ix;
  for (const node of genome.nodes) {
    for (let k = 0; k < 3; k++) {
      const ref = node.inputs[k]!;
      view[off++] = refKind(ref.kind);
      view[off++] = refIdx(ref);
      view[off++] = 0;
    }
    for (let k = 0; k < 27; k++) view[off++] = node.rule[k]!;
  }

  const { ptr: statePtr, view: stateView } = allocI8(wasm, N);

  return {
    nodeCount: N,
    inputCount: K,
    outputCount: M,
    genomePtr: ptr / 4, // i32 units
    statePtr,
    genomeBuffer: view,
    stateBuffer: stateView,
  };
}

function refKind(k: "node" | "input" | "const"): number {
  if (k === "const") return 0;
  if (k === "node") return 1;
  return 2;
}

function refIdx(ref: { kind: "node" | "input" | "const"; index?: number; value?: number }): number {
  if (ref.kind === "const") return ref.value ?? 0;
  return ref.index ?? 0;
}

/** One row of an environment (input → target). */
export interface EvalRow {
  input: ReadonlyArray<number>;
  target: ReadonlyArray<number>;
}

/**
 * Score a packed genome against a list of (input, target) rows.
 * Returns the row-level accuracy in [0, 1] — i.e. the fraction of
 * rows where every output bit matched.
 *
 * Bit-pattern is identical to @aigarth/evo/eval.ts + boolean envs.
 */
export function scoreRows(
  wasm: EvoWasmModule,
  packed: PackedGenome,
  rows: ReadonlyArray<EvalRow>,
  steps: number,
): number {
  // Allocate a persistent input + target + output scratch region.
  const K = packed.inputCount;
  const M = packed.outputCount;
  const { ptr: inputPtr } = allocI32(wasm, K);
  const { ptr: targetPtr } = allocI32(wasm, M);
  const { ptr: outputPtr } = allocI32(wasm, M);
  let pass = 0;
  for (const row of rows) {
    // Reset state to zero before each row (clean evaluation).
    packed.stateBuffer.fill(0);
    // Write inputs (clamped).
    for (let k = 0; k < K; k++) {
      const raw = row.input[k] ?? 0;
      const clamped = raw >= 0.5 ? 1 : raw <= -0.5 ? -1 : 0;
      new Int32Array(wasm.memoryBuffer, inputPtr, K)[k] = clamped;
    }
    for (let m = 0; m < M; m++) {
      const t = row.target[m] ?? 0;
      new Int32Array(wasm.memoryBuffer, targetPtr, M)[m] = t >= 0.5 ? 1 : 0;
    }
    const result = wasm.exports.evaluateRow(
      packed.genomePtr,
      packed.statePtr,
      inputPtr,
      targetPtr,
      outputPtr,
      steps,
    );
    if (result === 1) pass += 1;
  }
  return rows.length === 0 ? 0 : pass / rows.length;
}

// ---------------- Mulberry32 RNG (JS-side, matches WASM exactly) -------

/** A seeded RNG that draws floats in [0, 1). Bit-pattern matches WASM. */
export function makeRng(seed: number): { next(): number; int(max: number): number; intRange(min: number, max: number): number } {
  let a = seed >>> 0;
  return {
    next(): number {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
      t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
      t = (t ^ (t >>> 14)) >>> 0;
      return t / 4294967296;
    },
    int(max: number): number {
      return Math.floor(this.next() * max);
    },
    intRange(min: number, max: number): number {
      return min + Math.floor(this.next() * (max - min + 1));
    },
  };
}
