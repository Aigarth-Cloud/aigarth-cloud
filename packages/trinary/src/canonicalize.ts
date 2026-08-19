/**
 * Canonicalize — produce a stable, deterministic JSON encoding of an
 * IntentEnvelope (or any value) so that signatures and hashes are
 * reproducible across runtimes, key orders, and whitespace.
 *
 * Rules (RFC 8785 JCS-ish, simplified for our payload):
 *  - Object keys sorted lexicographically at every depth
 *  - No insignificant whitespace
 *  - UTF-8 encoded
 *  - Numbers in their shortest form (JSON.stringify behaviour, which
 *    matches JSON spec)
 *  - `undefined` values are dropped (matches JSON.stringify; combined
 *    with zod's defaults, optional fields with no value are absent)
 *
 * This module is the *one* place the wire encoding is defined. Any
 * change to canonicalize.ts is a protocol break and requires a
 * schema_version bump.
 */

import { createHash } from "node:crypto";
import type { IntentEnvelope } from "./envelope.js";

/**
 * Canonical JSON string of an IntentEnvelope with the signature field
 * cleared. The empty-string clear is the protocol's convention; it
 * keeps the canonical form a *function* of the envelope's content,
 * not of the signature itself.
 */
export function canonicalizeEnvelope(envelope: IntentEnvelope | Omit<IntentEnvelope, "signature">): string {
  const cleared = { ...envelope, signature: "" } as Record<string, unknown>;
  return canonicalizeValue(cleared);
}

/** Recursive canonicalize for an arbitrary value. */
export function canonicalizeValue(value: unknown): string {
  return JSON.stringify(value, replacer);
}

/**
 * JSON.stringify replacer that sorts object keys. The function
 * signature `(key, value)` is what JSON.stringify expects, so the
 * `key` parameter is required even though we don't use it.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function replacer(_key: string, value: unknown): unknown {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[k] = (value as Record<string, unknown>)[k];
    }
    return sorted;
  }
  return value;
}

/** SHA-256 hex of the canonical envelope form. */
export function hashEnvelope(envelope: IntentEnvelope | Omit<IntentEnvelope, "signature">): string {
  return createHash("sha256").update(canonicalizeEnvelope(envelope), "utf8").digest("hex");
}
