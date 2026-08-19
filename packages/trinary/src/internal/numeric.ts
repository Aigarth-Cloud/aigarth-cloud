/**
 * Internal numeric helpers used by the consensus algebra.
 *
 * Excluded from the public surface (not re-exported from index.ts) and
 * excluded from the coverage threshold. They are tested transitively
 * through the public `combine` API; the helper-level coverage is a
 * nice-to-have, not a contract.
 */

/** Clamp a number into [0, 1], treating non-finite values as 0. */
export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/** Arithmetic mean; returns 0 for an empty array. */
export function average(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}
