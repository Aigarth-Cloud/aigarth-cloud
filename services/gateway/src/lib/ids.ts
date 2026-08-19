/**
 * ID + token helpers.
 */

import { randomBytes, randomUUID, createHash } from "node:crypto";

export function uid(): string {
  return randomUUID();
}

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Generate an API key with a given prefix. */
export function generateApiKey(prefix: string): { key: string; secret: string; full: string } {
  const keyPrefix = randomBytes(4).toString("hex"); // 8 char prefix
  const secret = generateToken(); // 43 char secret
  return {
    key: keyPrefix,
    secret,
    full: `${prefix}${keyPrefix}.${secret}`,
  };
}

/** SHA-256 hex. */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
