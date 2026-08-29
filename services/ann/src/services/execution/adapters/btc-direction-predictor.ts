/**
 * BTC Direction Predictor v1 — demo ANN adapter.
 *
 * A trivial rule-based predictor that takes a 30-day window of
 * closing prices and emits a "up" or "down" prediction for the
 * next 5 days. Used to prove the entire pipeline
 *
 *   manifest → ExecutionRouter → LocalExecutor/QubicOC → result
 *
 * end-to-end. **Not a real model.** A real BTC predictor would
 * use a trained MLP or transformer; this is a transparent fixture
 * so the pipeline mechanics are obvious.
 *
 * Algorithm:
 *
 *   - input.features is an array of 30 daily closing prices
 *   - compute the 5-day momentum: last_close - close_5_days_ago
 *   - if momentum > 0: predict "up", confidence = clamp(momentum / mean_price, 0, 1)
 *   - else: predict "down", confidence = clamp(-momentum / mean_price, 0, 1)
 *
 * The adapter is fully deterministic; given the same input, it
 * always returns the same output. This matches the manifest's
 * `algorithm.deterministic = true` flag and lets the OC executor
 * use the `deterministic` verification method (single re-run
 * confirms the result, no need for 3-way replication).
 */

import type { AnnAdapter } from "./types.js";
import type { AnnManifest } from "../../../types/ann-manifest.js";

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

export const BtcDirectionPredictorAdapter: AnnAdapter = {
  id: "btc-direction-predictor-v1",
  description:
    "Trivial 5-day momentum rule on a 30-day price window. Demo fixture, not a real model.",
  async infer(input, _manifest) {
    const features = input.features;
    if (!Array.isArray(features) || features.length < 6) {
      throw new Error(
        "btc-direction-predictor-v1: input.features must be a numeric array of at least 6 entries",
      );
    }
    const xs = features.map((x) => Number(x));
    if (xs.some((x) => !Number.isFinite(x))) {
      throw new Error("btc-direction-predictor-v1: input.features contains non-finite values");
    }
    const last = xs[xs.length - 1]!;
    const fifth = xs[xs.length - 6]!;
    const momentum = last - fifth;
    const meanPrice = mean(xs);
    const confidence = clamp(Math.abs(momentum) / Math.max(meanPrice, 1), 0, 1);
    const prediction = momentum > 0 ? "up" : momentum < 0 ? "down" : "flat";
    return {
      prediction,
      confidence: Number(confidence.toFixed(4)),
      momentum: Number(momentum.toFixed(4)),
      last_price: last,
      mean_price: Number(meanPrice.toFixed(4)),
      window_size: xs.length,
      adapter: "btc-direction-predictor-v1",
    };
  },
};

/** Convenience: register the BTC adapter as the default for Phase 29. */
export function registerDefaultBtcAdapter(): void {
  // Lazy import to avoid a circular dep with ./registry.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { registerAnnAdapter } = require("./registry.js") as typeof import("./registry.js");
  registerAnnAdapter(BtcDirectionPredictorAdapter);
}
