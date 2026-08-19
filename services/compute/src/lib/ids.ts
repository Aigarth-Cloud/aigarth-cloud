/**
 * ID + token helpers.
 */

import { randomBytes, randomUUID, createHash } from "node:crypto";

/** RFC 4122 v4 UUID. */
export function uid(): string {
  return randomUUID();
}

/** 32-byte URL-safe token. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 hex. */
export async function sha256Hex(input: string): Promise<string> {
  return createHash("sha256").update(input).digest("hex");
}
