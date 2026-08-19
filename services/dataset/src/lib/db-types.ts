/**
 * Postgres bigint helpers.
 *
 * Postgres bigints come back as strings by default in node-postgres
 * (because JS numbers can't represent 64-bit integers safely). The
 * Drizzle schema declares them as `mode: "number"` for fields that
 * fit comfortably in 53 bits (file sizes up to ~9 PB, row counts up
 * to ~9 quadrillion) — which is all we need. This file centralizes
 * the type narrowing so it's consistent across services.
 *
 * If we ever need exact 64-bit integers, switch to `mode: "bigint"`
 * and use the BigInt type. We don't need that yet.
 */

export function bigintToNumber(value: string | number | null | undefined, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n : fallback;
}
