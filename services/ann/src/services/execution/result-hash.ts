/**
 * Result-hash — deterministic sha256 of (ann + input + target + output).
 *
 * The superprompt (§11 — Result Verification) defines the hash as
 *
 *   result_hash = sha256(
 *     ann_hash        // manifest hash
 *   + ann_version
 *   + input_hash      // sha256 of canonical input
 *   + target
 *   + output
 *   )
 *
 * The point: given an ANN manifest, an input, and a target, anyone
 * can recompute the hash and confirm "this result came from this
 * exact ANN version using this exact input." It does **not** require
 * trusting the executor's word; the executor returns the result and
 * the hash, and the caller (or auditor) re-derives the hash from
 * the canonical fields.
 *
 * In v1 we don't sign this hash. A future version (Phase 30+) will
 * sign it with the ANN creator's Qubic identity key, providing
 * non-repudiable provenance.
 */

import { createHash } from "node:crypto";

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) {
        sorted[k] = (v as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return v;
  });
}

/** SHA-256 of the canonicalised input. */
export function inputHash(input: Record<string, unknown>): string {
  return `sha256:${createHash("sha256").update(stableStringify(input)).digest("hex")}`;
}

/**
 * The full deterministic result hash. The input ordering is
 * `manifestHash || annVersion || inputHash || target || canonicalize(output)`.
 * The `||` is a UTF-8 byte concatenation, not a logical OR.
 */
export function resultHash(args: {
  manifestHash: string;
  annVersion: string;
  input: Record<string, unknown>;
  target: "local" | "qubic_oc";
  output: Record<string, unknown>;
}): string {
  const parts = [
    args.manifestHash,
    args.annVersion,
    inputHash(args.input),
    args.target,
    stableStringify(args.output),
  ].join("||");
  return `sha256:${createHash("sha256").update(parts).digest("hex")}`;
}
