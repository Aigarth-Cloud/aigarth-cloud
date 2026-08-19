/**
 * Algorithm registry — Zod schemas.
 *
 * Per ADR 006 §10 (Task 10 — awork_1).
 */

import { z } from "zod";
import { createHmac, timingSafeEqual } from "node:crypto";

export const RegisterAlgorithmSchema = z.object({
  name: z.string().min(1).max(120),
  version: z.string().regex(/^v\d+\.\d+\.\d+$/),
  container: z.string().min(1).max(512),
  deterministic: z.boolean().default(false),
  description: z.string().max(2_000).optional(),
});

export type RegisterAlgorithmInput = z.infer<typeof RegisterAlgorithmSchema>;

/**
 * HMAC-SHA-256 signature of `name|version|container` keyed on
 * WORK_SIGNING_KEY.
 */
export function signAlgorithm(
  name: string,
  version: string,
  container: string,
  key: string,
): string {
  return createHmac("sha256", key)
    .update(`${name}|${version}|${container}`)
    .digest("hex");
}

export function verifyAlgorithmSignature(
  name: string,
  version: string,
  container: string,
  signature: string,
  key: string,
): boolean {
  const expected = signAlgorithm(name, version, container, key);
  if (expected.length !== signature.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature, "hex"),
    );
  } catch {
    return false;
  }
}
