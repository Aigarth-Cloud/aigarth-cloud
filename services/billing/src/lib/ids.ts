/**
 * ID + token helpers.
 */

import { randomBytes, randomUUID } from "node:crypto";

export function uid(): string {
  return randomUUID();
}

/** Short public-facing code (e.g. for coupons: "LAUNCH50"). */
export function shortCode(length = 8): string {
  return randomBytes(length).toString("base64url").slice(0, length).toUpperCase();
}
