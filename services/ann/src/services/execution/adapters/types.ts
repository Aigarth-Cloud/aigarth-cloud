/**
 * ANN adapter — the per-architecture inference function.
 *
 * The Execution Router runs the same ANN through either the local
 * executor or the Qubic OC executor. The actual inference logic
 * (how `input` becomes `output`) lives in the **adapter**, not in
 * the executor. Adapters are keyed by `manifest.architecture` so
 * each architecture ("mlp-3", "transformer-decoder", "deterministic-stub",
 * "btc-direction-predictor-v1", ...) has its own inference function.
 *
 * Adapters are registered at startup. The local executor consults
 * the registry; if no adapter matches, it falls back to a clearly
 * labelled deterministic stub so the pipeline is never blocked.
 *
 * The OC executor delegates to services/work — the algorithm is
 * identified by the algorithm registry there, not by an adapter
 * here. The `aigarth-oc-algorithm` algorithm is registered as the
 * default and is what the OC executor submits. (Phase 30+: each
 * manifest.architecture can register a corresponding OC algorithm.)
 */

import type { AnnManifest } from "../../../types/ann-manifest.js";

export interface AnnAdapter {
  /** Stable id. Matches `manifest.architecture`. */
  id: string;
  /** Human-readable description, shown in dashboards. */
  description: string;
  /**
   * Run inference.
   *
   *   input    — caller-supplied, already validated against manifest.inputSchema
   *   manifest — the full manifest (so the adapter can read architecture
   *              + modelHash + benchmark + ...)
   *
   * Returns the raw output object. The Execution Router wraps it
   * in a deterministic result hash before returning to the caller.
   */
  infer(input: Record<string, unknown>, manifest: AnnManifest): Promise<Record<string, unknown>>;
}
