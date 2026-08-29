/**
 * Canonicalisation helpers.
 *
 *   canonicaliseInvocation — the deterministic string the Qubic
 *   computors sign. Same fields in same order = same bytes. The
 *   processor re-derives this string from a received `QubicInvocation`
 *   and checks it equals `signatures.message_hash`.
 *
 *   stableStringify — sorted-keys JSON.stringify. Same input always
 *   produces the same string regardless of the order the caller
 *   wrote the keys.
 */

import { createHash } from "node:crypto";
import type { QubicInvocation } from "./types.js";

export function stableStringify(value: unknown): string {
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

/**
 * The canonical form Aigarth expects the Qubic computors to sign.
 * The 451/676 trust root (ADR 007 §5) is verified by re-deriving
 * this string and comparing to `signatures.message_hash`.
 *
 *   canonicaliseInvocation(inv) =
 *     contract_index || procedure || caller || payer ||
 *     fee_paid_qubit || epoch || nonce ||
 *     stableStringify(payload)
 *
 *   messageHash(inv) = "sha256:" + sha256(canonicaliseInvocation(inv))
 */
export function canonicaliseInvocation(inv: QubicInvocation): string {
  return [
    String(inv.contract_index),
    inv.procedure,
    inv.caller,
    inv.payer,
    inv.fee_paid_qubit,
    String(inv.epoch),
    inv.nonce,
    stableStringify(inv.payload),
  ].join("||");
}

export function messageHash(inv: QubicInvocation): string {
  return `sha256:${createHash("sha256").update(canonicaliseInvocation(inv)).digest("hex")}`;
}
