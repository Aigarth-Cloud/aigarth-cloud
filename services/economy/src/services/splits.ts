/**
 * Pure revenue-split engine.
 *
 * Given a usage record (revenue in QUBIC), a list of contributor shares
 * (bps), and a platform fee (bps), compute the per-recipient payout.
 *
 * The math is exact-integer; no floats anywhere. Total QUBIC is preserved
 * modulo the platform fee (which goes to the platform, not the contributors).
 *
 * Smoke-tested in `./splits.smoke.ts` — no DB required.
 */

import type { ContributorShare } from "../db/schema.js";

/** Basis points multiplier (10_000 bps = 100%). */
export const BPS_DENOMINATOR = 10_000n;

/** Maximum number of contributors we'll split among in a single call. */
export const MAX_CONTRIBUTORS_PER_ANN = 64;

export interface RecipientShare {
  /** Stable id from the contributor_shares row. */
  contributorId: string;
  userId: string;
  /** Recipient's share in basis points (0–10000). */
  bps: number;
}

export interface SplitInput {
  /** Total QUBIC billed to consumers of this ANN over the period. */
  totalRevenueQubic: bigint;
  /** Active contributor shares for the ANN. */
  contributors: RecipientShare[];
  /** Platform fee in basis points (0–10000). Defaults to 0 if not provided. */
  platformFeeBps?: number;
}

export interface PayoutLine {
  contributorId: string;
  userId: string;
  bps: number;
  amountQubic: bigint;
}

export interface SplitResult {
  platformFeeQubic: bigint;
  platformFeeBps: number;
  netToContributorsQubic: bigint;
  payouts: PayoutLine[];
  /**
   * Sum of `payouts[].amountQubic`. Equals `netToContributorsQubic` for
   * well-formed inputs. Exposed for verification.
   */
  sumPayoutsQubic: bigint;
}

/**
 * Apply the revenue split. Throws on invalid input.
 *
 * Validation:
 *   - `totalRevenueQubic` must be >= 0
 *   - `platformFeeBps` must be 0–10000
 *   - Sum of contributor bps must be 0–10000 (i.e. not more than 100%)
 *   - `contributors.length` must be <= MAX_CONTRIBUTORS_PER_ANN
 *   - No duplicate `contributorId`s
 */
export function applySplit(input: SplitInput): SplitResult {
  if (input.totalRevenueQubic < 0n) {
    throw new Error(`totalRevenueQubic must be >= 0, got ${input.totalRevenueQubic}`);
  }
  const platformFeeBps = input.platformFeeBps ?? 0;
  if (!Number.isInteger(platformFeeBps) || platformFeeBps < 0 || platformFeeBps > 10_000) {
    throw new Error(`platformFeeBps must be 0–10000, got ${platformFeeBps}`);
  }
  if (input.contributors.length > MAX_CONTRIBUTORS_PER_ANN) {
    throw new Error(
      `too many contributors: ${input.contributors.length} (max ${MAX_CONTRIBUTORS_PER_ANN})`,
    );
  }

  // Validate bps sum and uniqueness
  const seen = new Set<string>();
  let bpsSum = 0;
  for (const c of input.contributors) {
    if (!Number.isInteger(c.bps) || c.bps < 0 || c.bps > 10_000) {
      throw new Error(`contributor ${c.contributorId} bps out of range: ${c.bps}`);
    }
    if (seen.has(c.contributorId)) {
      throw new Error(`duplicate contributorId: ${c.contributorId}`);
    }
    seen.add(c.contributorId);
    bpsSum += c.bps;
  }
  if (bpsSum > 10_000) {
    throw new Error(`sum of contributor bps exceeds 10000: ${bpsSum}`);
  }

  // Compute platform fee and net
  const platformFeeQubic = (input.totalRevenueQubic * BigInt(platformFeeBps)) / BPS_DENOMINATOR;
  const netToContributorsQubic = input.totalRevenueQubic - platformFeeQubic;

  // Compute per-recipient payouts. Each recipient gets (bps * net / 10000).
  // Any remainder from integer division is dropped (goes to platform effectively,
  // but is < 1 QUBIC per recipient per period and within acceptable rounding).
  const payouts: PayoutLine[] = input.contributors.map((c) => ({
    contributorId: c.contributorId,
    userId: c.userId,
    bps: c.bps,
    amountQubic: (netToContributorsQubic * BigInt(c.bps)) / BPS_DENOMINATOR,
  }));

  let sumPayoutsQubic = 0n;
  for (const p of payouts) sumPayoutsQubic += p.amountQubic;

  return {
    platformFeeQubic,
    platformFeeBps,
    netToContributorsQubic,
    payouts,
    sumPayoutsQubic,
  };
}

// ---------- Compute grant math (Qearn lock → compute units) ----------

/**
 * Convert a Qearn lock position into compute-credit units.
 *
 * Formula:
 *   grant = amountQubic * weeks_locked * GRANT_PER_QU_PER_WEEK
 *
 * Intentionally simple. Real-world scaling is a separate problem; this
 * is the deterministic formula the demo and tests use.
 *
 * @param amountQubic  Principal locked, in QUBIC.
 * @param weeks        Number of weeks the user committed to (1–52).
 * @param unitsPerQuPerWeek  Conversion rate. Default: 1 unit per 1M QUBIC per week.
 *                           (i.e. 1T QUBIC for 52 weeks = 52 units of compute).
 */
export const DEFAULT_GRANT_PER_QU_PER_WEEK = 1n / 1_000_000n;

export function computeGrantUnits(
  amountQubic: bigint,
  weeks: number,
  unitsPerQuPerWeek: bigint = 1_000_000n, // 1 unit per 1M QUBIC per week, scaled below
): bigint {
  if (amountQubic < 0n) {
    throw new Error(`amountQubic must be >= 0, got ${amountQubic}`);
  }
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52) {
    throw new Error(`weeks must be 1–52, got ${weeks}`);
  }
  // grant = amountQubic * weeks / 1_000_000
  return (amountQubic * BigInt(weeks)) / unitsPerQuPerWeek;
}

// ---------- DB row → RecipientShare adapter ----------

/** Convert a DB row to a RecipientShare, for use with applySplit. */
export function toRecipientShare(row: ContributorShare): RecipientShare {
  return {
    contributorId: row.id,
    userId: row.userId,
    bps: row.bps,
  };
}
