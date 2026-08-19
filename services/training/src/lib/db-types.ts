/**
 * Postgres bigint helpers.
 *
 * Postgres bigints come back as strings by default in node-postgres.
 * The Drizzle schema declares them as `mode: "number"` for fields
 * that fit comfortably in 53 bits (file sizes up to ~9 PB, etc.).
 * This file centralizes the type narrowing so it's consistent
 * across services.
 */

export function bigintToNumber(value: string | number | null | undefined, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n : fallback;
}
