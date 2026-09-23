/**
 * BTC direction predictor — regression-style fitness environment.
 *
 * This is the same problem Anna.exe's BPP9000 attempts: given a
 * sliding window of K daily closing prices, predict whether the next
 * day's price is up, flat, or down relative to the most recent close.
 *
 * The environment is intentionally simple so the substrate can
 * demonstrate convergence on it. The training set is synthesised
 * deterministically from a seeded random walk — no real BTC data,
 * no external HTTP fetch — so the demo is hermetic and reproducible.
 *
 * The encoded inputs are a 5-bit trinary signal:
 *
 *   bit 0:  momentum sign  (next - last > 0 ? +1 : -1)
 *   bit 1:  momentum magnitude bucket  (-1 small, 0 medium, +1 large)
 *   bit 2:  volatility sign  (recent std > long std ? +1 : -1)
 *   bit 3:  trend sign      (slope of the linear fit > 0 ? +1 : -1)
 *   bit 4:  last-step sign  (close - open of last day)
 *
 * The target is the actual next-day direction (up=+1, flat=0, down=-1),
 * fed in as a one-hot-style target.
 *
 * For the AIGARTH-EVO-01 battery, the substrate only needs to predict
 * the *sign* of the next-day direction; the trinary target matches.
 */

import { evaluate } from "../eval.js";
import type { Genome, GenomeShape } from "../genome.js";
import { makeShape } from "../genome.js";
import type { RegressionEnvironment } from "./types.js";

/**
 * Seeded pseudo-random walk generator (LCG, deterministic).
 * Same seed → same walk; tests rely on this.
 */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Build a deterministic random-walk of length N. Each step is a
 * Gaussian-ish increment (sum of three uniforms) scaled by `vol`.
 */
function randomWalk(seed: number, length: number, vol: number): number[] {
  const r = lcg(seed);
  const out: number[] = [];
  let level = 100;
  for (let i = 0; i < length; i++) {
    const a = r() - 0.5;
    const b = r() - 0.5;
    const c = r() - 0.5;
    level += (a + b + c) * vol;
    out.push(level);
  }
  return out;
}

/**
 * Encode a price window as a 5-bit trinary input vector.
 *
 * `prices` is the past window; the next-day price is `next`.
 */
function encodeWindow(prices: ReadonlyArray<number>, next: number): number[] {
  const last = prices[prices.length - 1]!;
  const prev = prices[prices.length - 2] ?? last;
  const momentum = next - last;
  const fiveAgo = prices[Math.max(0, prices.length - 6)] ?? last;
  const momentumMag = Math.abs(momentum) / Math.max(Math.abs(last - fiveAgo), 1e-9);

  // Volatility: std of last 5 vs std of last 15.
  const lastFive = prices.slice(-5);
  const lastFifteen = prices.slice(-15);
  const std = (xs: ReadonlyArray<number>): number => {
    if (xs.length < 2) return 0;
    const m = xs.reduce((s, x) => s + x, 0) / xs.length;
    return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
  };
  const volShort = std(lastFive);
  const volLong = std(lastFifteen);
  const volSign = volShort > volLong ? 1 : -1;

  // Trend: sign of linear-fit slope over the window.
  const xs = prices.map((_, i) => i);
  const xMean = xs.reduce((s, x) => s + x, 0) / xs.length;
  const yMean = prices.reduce((s, x) => s + x, 0) / prices.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i]! - xMean) * (prices[i]! - yMean);
    den += (xs[i]! - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const trendSign = slope > 0 ? 1 : -1;

  // Last-step: close - open. We don't have open separately, so use
  // last - prev as a proxy for the most recent tick's direction.
  const lastStepSign = last - prev > 0 ? 1 : -1;

  return [
    momentum >= 0 ? 1 : -1,
    momentumMag > 0.5 ? 1 : momentumMag < 0.2 ? -1 : 0,
    volSign,
    trendSign,
    lastStepSign,
  ];
}

/**
 * Encode the next-day direction as a single trinary target.
 *   up   (next > last)        → +1
 *   flat (next == last)       →  0
 *   down (next < last)        → -1
 */
function encodeDirection(next: number, last: number): number {
  if (next > last) return 1;
  if (next < last) return -1;
  return 0;
}

/**
 * Build the BTC direction environment.
 *
 *   seed: random walk seed
 *   length: total number of daily prices generated
 *   vol: per-step volatility (smaller = easier to predict)
 *   window: how many past days feed into the input vector
 */
export function makeBtcEnvironment(
  seed: number = 42,
  length: number = 240,
  vol: number = 0.5,
  window: number = 30,
): RegressionEnvironment {
  const prices = randomWalk(seed, length, vol);

  // Each example is one prediction step: prices[t-window..t] -> direction(t+1).
  // We need at least `window` past prices to form the input, so we start at t=window.
  const examples: Array<{ input: number[]; target: number[] }> = [];
  for (let t = window; t < prices.length - 1; t++) {
    const win = prices.slice(t - window, t);
    const next = prices[t + 1]!;
    examples.push({
      input: encodeWindow(win, next),
      target: [encodeDirection(next, win[win.length - 1]!)],
    });
  }

  const shape: GenomeShape = makeShape(examples[0]!.input.length, examples[0]!.target.length, 16);

  return {
    name: "btc_direction",
    shape: () => shape,
    examples: () => examples,
    /**
     * Mean absolute error in [0, 1]. The trinary target is {-1, 0, +1}
     * and the genome output is also {-1, 0, +1}; the absolute
     * difference is 0, 1, or 2; we normalise by dividing by 2.
     */
    error(genome: Genome): number {
      let sum = 0;
      let n = 0;
      for (const ex of examples) {
        const out = evaluate(genome, ex.input, 3);
        const pred = out[0] ?? 0;
        const target = ex.target[0]!;
        sum += Math.abs(pred - target) / 2;
        n += 1;
      }
      return n === 0 ? 1 : sum / n;
    },
  };
}

/** Default BTC direction environment for the AIGARTH-EVO-01 demo. */
export const BtcEnv = makeBtcEnvironment(42, 240, 0.5, 30);
