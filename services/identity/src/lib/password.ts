/**
 * Password hashing with Argon2id.
 *
 * Argon2id is the recommended algorithm by OWASP. We use the `argon2`
 * npm package (native bindings, fast).
 *
 * Parameters (memory, iterations, parallelism) are tuned for ~100ms
 * per hash on a modern x86 server. Adjust via env vars to match
 * your hardware.
 */

import argon2 from "argon2";
import { loadConfig } from "../config/index.js";

export interface PasswordHash {
  hash: string;
  params: { type: "argon2id"; memory: number; iterations: number; parallelism: number };
}

export async function hashPassword(password: string): Promise<PasswordHash> {
  const cfg = loadConfig();
  const hash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: cfg.ARGON2_MEMORY_KIB,
    timeCost: cfg.ARGON2_ITERATIONS,
    parallelism: cfg.ARGON2_PARALLELISM,
  });
  return {
    hash,
    params: {
      type: "argon2id",
      memory: cfg.ARGON2_MEMORY_KIB,
      iterations: cfg.ARGON2_ITERATIONS,
      parallelism: cfg.ARGON2_PARALLELISM,
    },
  };
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * Check if a stored hash was created with parameters below the
 * current minimum. Used to trigger a rehash on next successful login.
 */
export function needsRehash(stored: { memory: number; iterations: number }): boolean {
  const cfg = loadConfig();
  return (
    stored.memory < cfg.ARGON2_MEMORY_KIB || stored.iterations < cfg.ARGON2_ITERATIONS
  );
}

/** Server-side password validation. Returns the first error, or null. */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 12) return "Password must be at least 12 characters.";
  if (password.length > 256) return "Password must be 256 characters or fewer.";
  if (!/[a-z]/.test(password)) return "Password must contain a lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Password must contain an uppercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain a digit.";
  return null;
}
