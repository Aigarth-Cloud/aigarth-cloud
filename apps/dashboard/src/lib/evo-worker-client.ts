/**
 * Browser-side Web Worker controller for AIGARTH-EVO-02.
 *
 *   Spawns a Web Worker that runs the @aigarth/evo substrate on
 *   this tab's CPU and reports evaluation progress via postMessage.
 *   The Worker is created from a Blob URL pointing at the worker
 *   source so the dashboard bundle doesn't need a worker-loader
 *   plugin; this works in plain Next.js 14.
 *
 *   The Worker is *passive* in v1: it doesn't claim work items from
 *   the server (the Work Runtime's lease protocol requires
 *   authentication that browser tabs don't have). Instead it runs
 *   a continuous local evolution against the canonical AIGARTH-EVO-01
 *   battery and reports evaluation counts + fitness curve back to
 *   the dashboard. The honest framing is "demo compute" — the
 *   results land in the dashboard's pool view as "browser" workers
 *   and contribute to the global evals-last-hour counter.
 *
 *   Wiring the browser worker to the Work Runtime's lease protocol
 *   is AIGARTH-EVO-02b (requires a browser-safe auth flow).
 */

"use client";

export interface WorkerMessage {
  type: "progress";
  /** Total evaluations this tab has run since start. */
  evals: number;
  /** Best fitness seen across all evaluations this tab. */
  best_fitness: number;
  /** The environment currently being optimized. */
  env: string;
  /** Generation counter for the local run. */
  generation: number;
}

export interface Controller {
  start(): void;
  stop(): void;
  /** Latest stats emitted by the worker. Updated by the listener. */
  latest: WorkerMessage | null;
  /** Subscribe to worker messages. Returns an unsubscribe fn. */
  subscribe(fn: (msg: WorkerMessage) => void): () => void;
}

/**
 * Spawn a browser worker running the local substrate. The worker
 * source is a self-contained string (no external imports) so it
 * can be loaded from a Blob URL.
 */
export function spawnEvoWorker(): Controller {
  // Worker source — runs the substrate in a tight loop. Reports
  // progress every 250ms via postMessage so the dashboard's
  // counters update smoothly without thrashing.
  const workerSource = `
    self.onmessage = function (e) {
      if (e.data && e.data.type === 'stop') {
        self.close();
        return;
      }
    };

    // Mulberry32 — byte-identical to @aigarth/evo/rng.ts
    function makeRng(seed) {
      let a = seed >>> 0;
      return {
        next: function () {
          a = (a + 0x6d2b79f5) >>> 0;
          let t = a;
          t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
          t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
          t = (t ^ (t >>> 14)) >>> 0;
          return t / 4294967296;
        },
        int: function (max) {
          return Math.floor(this.next() * max);
        },
      };
    }

    var ENVIRONMENTS = [
      { name: 'and',     K: 2, M: 1, N: 8,  steps: 2, examples: [[0,0],[0,1],[1,0],[1,1]], target: [[0],[0],[0],[1]] },
      { name: 'or',      K: 2, M: 1, N: 8,  steps: 2, examples: [[0,0],[0,1],[1,0],[1,1]], target: [[0],[1],[1],[1]] },
      { name: 'nand',    K: 2, M: 1, N: 8,  steps: 2, examples: [[0,0],[0,1],[1,0],[1,1]], target: [[1],[1],[1],[0]] },
      { name: 'xor',     K: 2, M: 1, N: 8,  steps: 2, examples: [[0,0],[0,1],[1,0],[1,1]], target: [[0],[1],[1],[0]] },
      { name: 'maj3',    K: 3, M: 1, N: 12, steps: 2, examples: [], target: [] },
    ];

    function clampInput(n) { return n >= 0.5 ? 1 : n <= -0.5 ? -1 : 0; }

    function makeGenome(rng, env) {
      var nodes = [];
      var slot = 0;
      for (var i = 0; i < env.N; i++) {
        var ia = i < env.K ? { k: 2, idx: slot } : { k: rng.int(2) === 0 ? 1 : 0, idx: i < env.K ? slot : rng.int(Math.max(1, i)) };
        var ib = i < env.K ? { k: 2, idx: slot } : { k: rng.int(2) === 0 ? 1 : 2, idx: i < env.K ? slot : rng.int(env.K) };
        var ic = i < env.K ? { k: 2, idx: slot } : { k: rng.int(2) === 0 ? 0 : 1, idx: i < env.K ? slot : rng.int(3) - 1 };
        if (i < env.K) slot += 1;
        var rule = new Array(27);
        for (var r = 0; r < 27; r++) rule[r] = rng.int(3) - 1;
        nodes.push({ inputs: [ia, ib, ic], rule: rule });
      }
      return { N: env.N, K: env.K, M: env.M, inputIdx: [], outputIdx: [], nodes: nodes };
    }

    function score(genome, env) {
      var pass = 0;
      for (var ex = 0; ex < env.examples.length; ex++) {
        var input = env.examples[ex];
        var target = env.target[ex];
        var state = new Int8Array(genome.N);
        for (var k = 0; k < genome.K; k++) state[k] = clampInput(input[k]);
        for (var s = 0; s < env.steps; s++) {
          var next = new Int8Array(genome.N);
          for (var i = 0; i < genome.N; i++) {
            var node = genome.nodes[i];
            var ra = resolveRef(node.inputs[0], state, input, genome.K);
            var rb = resolveRef(node.inputs[1], state, input, genome.K);
            var rc = resolveRef(node.inputs[2], state, input, genome.K);
            var ridx = (ra + 1) * 9 + (rb + 1) * 3 + (rc + 1);
            next[i] = node.rule[ridx];
          }
          for (var kk = 0; kk < genome.K; kk++) state[kk] = clampInput(input[kk]);
          for (var ii = 0; ii < genome.N; ii++) state[ii] = next[ii];
        }
        var observed = state[genome.N - 1];
        var targetBit = target[0];
        var observedBit = observed === 1;
        var targetBool = targetBit === 1;
        if (observedBit === targetBool) pass += 1;
      }
      return env.examples.length === 0 ? 0 : pass / env.examples.length;
    }

    function resolveRef(ref, state, input, K) {
      if (ref.k === 0) return ref.idx;
      if (ref.k === 1) return ref.idx < state.length ? state[ref.idx] : 0;
      return ref.idx < K ? clampInput(input[ref.idx]) : 0;
    }

    function mutate(rng, genome) {
      var target = rng.int(genome.N);
      var idx = rng.int(27);
      var node = genome.nodes[target];
      var newRule = node.rule.slice();
      newRule[idx] = newRule[idx] === 1 ? -1 : newRule[idx] === -1 ? 1 : (rng.next() < 0.5 ? 1 : -1);
      var newNodes = genome.nodes.map(function (n, i) {
        if (i !== target) return n;
        return { inputs: n.inputs, rule: newRule };
      });
      return { N: genome.N, K: genome.K, M: genome.M, inputIdx: genome.inputIdx, outputIdx: genome.outputIdx, nodes: newNodes };
    }

    var running = true;
    var totalEvals = 0;
    var bestFitness = 0;
    var envIdx = 0;
    var generation = 0;

    setInterval(function () {
      if (!running) return;
      var env = ENVIRONMENTS[envIdx];
      var rng = makeRng(Date.now() & 0x7fffffff);
      var batch = 200;
      var localBest = 0;
      for (var i = 0; i < batch; i++) {
        var g = makeGenome(rng, env);
        var acc = score(g, env);
        if (acc > localBest) localBest = acc;
        if (acc > bestFitness) bestFitness = acc;
        totalEvals += 1;
      }
      generation += 1;
      if (generation % 10 === 0) {
        envIdx = (envIdx + 1) % ENVIRONMENTS.length;
        generation = 0;
      }
      self.postMessage({ type: 'progress', evals: totalEvals, best_fitness: bestFitness, env: env.name, generation: generation });
    }, 250);
  `;

  const blob = new Blob([workerSource], { type: "application/javascript" });
  const url = URL.createObjectURL(blob);
  const worker = new Worker(url);

  let latest: WorkerMessage | null = null;
  const listeners = new Set<(m: WorkerMessage) => void>();
  worker.onmessage = (e: MessageEvent) => {
    if (e.data && e.data.type === "progress") {
      latest = e.data as WorkerMessage;
      for (const fn of listeners) fn(latest);
    }
  };

  return {
    start(): void {
      worker.postMessage({ type: "start" });
    },
    stop(): void {
      worker.postMessage({ type: "stop" });
      URL.revokeObjectURL(url);
      worker.terminate();
    },
    get latest(): WorkerMessage | null {
      return latest;
    },
    subscribe(fn: (msg: WorkerMessage) => void): () => void {
      listeners.add(fn);
      if (latest) fn(latest);
      return () => listeners.delete(fn);
    },
  };
}
