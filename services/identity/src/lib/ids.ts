/**
 * ID generation. Uses crypto.randomUUID().
 */

import { createHash, randomBytes, randomUUID } from "node:crypto";

/** RFC 4122 v4 UUID. */
export function uid(): string {
  return randomUUID();
}

/** 32-byte URL-safe token (for email verification, password reset, etc). */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 of a token. Stored in the DB; the token itself is only in the email. */
export async function hashToken(token: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(token).digest("hex");
}

/** IP hash for abuse detection (hashed so we don't store raw IPs). */
export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}
