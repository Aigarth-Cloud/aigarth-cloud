/**
 * Qearn staking configuration.
 *
 * Source of truth for the Qearn smart contract on Qubic mainnet. Numbers
 * are illustrative Phase 0 placeholders that match the Qearn contract
 * ABI; real on-chain values are pulled from
 * https://static.qubic.org/v1/general/data/smart_contracts.json in
 * Phase 1.
 *
 * See:
 *   - docs/use-cases/material-science-eval.md (the cost story)
 *   - services/qubic/src/client/stub.ts (the local Qearn stub)
 *   - qubic.org/blog "Qearn dApp: Expanding Staking & Transparency"
 *
 * Apply when: any component that touches the Qearn lock flow, the
 * early-unlock penalty table, or the reward calculation.
 */

/** Qearn contract: 60-char A-Z, "QEARN" + 55 A's. */
export const QEARN_CONTRACT_ADDRESS = "QEARN" + "A".repeat(55);

/** One epoch = 1 week. */
export const WEEKS_PER_EPOCH = 1;
export const EPOCHS_PER_YEAR = 52;

/** Lock constraints. */
export const MIN_LOCK_QUBIC = 10_000_000; // 10M
export const MAX_LOCK_QUBIC = 1_000_000_000_000; // 1T
export const MIN_WEEKS = 1;
export const MAX_WEEKS = 52;

/** Approximate annual reward rate, illustrative for Phase 0. Real
 * value is inversely proportional to total locked (Qearn spec). */
export const ANNUAL_REWARD_RATE = 0.08;

/** Convert a "M" or "K" string ("3M QUBIC", "1.2K") to a number.
 *  Returns null on parse failure. */
export function parseStakeString(input: string): number | null {
  const cleaned = input.replace(/[^0-9.KMkm]/g, "").trim();
  if (!cleaned) return null;
  const match = cleaned.match(/^([\d.]+)\s*([KkMm]?)$/);
  if (!match) return null;
  const value = parseFloat(match[1] ?? "");
  if (Number.isNaN(value)) return null;
  const suffix = (match[2] ?? "").toUpperCase();
  if (suffix === "K") return value * 1_000;
  if (suffix === "M") return value * 1_000_000;
  return value;
}

/** Format a number with "K" or "M" suffix for display. */
export function formatQubic(value: number, withUnit = false): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M${withUnit ? " QUBIC" : ""}`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K${withUnit ? " QUBIC" : ""}`;
  }
  return `${value}${withUnit ? " QUBIC" : ""}`;
}

/** Estimated weekly reward in QUBIC. Phase 0 placeholder. */
export function weeklyReward(amountQubic: number): number {
  return (amountQubic * ANNUAL_REWARD_RATE) / EPOCHS_PER_YEAR;
}

/** Estimated annual reward in QUBIC. */
export function annualReward(amountQubic: number): number {
  return amountQubic * ANNUAL_REWARD_RATE;
}

/** APY as a percentage string. Phase 0 placeholder. */
export function apyPercent(): string {
  return `${(ANNUAL_REWARD_RATE * 100).toFixed(0)}%`;
}

/**
 * Early-unlock penalty schedule (matches services/qubic/src/client/stub.ts).
 * Returns the % of accrued reward kept by the user if they unlock
 * before the full term. Principal is never touched: the penalty
 * is on the reward only.
 */
export function earlyUnlockRewardKept(weeksHeld: number): number {
  if (weeksHeld < 4) return 0;
  if (weeksHeld < 12) return 0.05;
  if (weeksHeld < 16) return 0.10;
  if (weeksHeld < 20) return 0.15;
  if (weeksHeld < 24) return 0.20;
  if (weeksHeld < 28) return 0.25;
  if (weeksHeld < 32) return 0.30;
  if (weeksHeld < 36) return 0.35;
  if (weeksHeld < 40) return 0.40;
  if (weeksHeld < 44) return 0.45;
  if (weeksHeld < 48) return 0.50;
  if (weeksHeld < 52) return 0.55;
  return 1.0; // full term: keep 100%
}

export type PenaltyRow = {
  weeksHeld: number;
  pctKept: number;
};

export const PENALTY_SCHEDULE: PenaltyRow[] = [
  { weeksHeld: 0, pctKept: 0 },
  { weeksHeld: 4, pctKept: 0.05 },
  { weeksHeld: 12, pctKept: 0.10 },
  { weeksHeld: 16, pctKept: 0.15 },
  { weeksHeld: 20, pctKept: 0.20 },
  { weeksHeld: 24, pctKept: 0.25 },
  { weeksHeld: 28, pctKept: 0.30 },
  { weeksHeld: 32, pctKept: 0.35 },
  { weeksHeld: 36, pctKept: 0.40 },
  { weeksHeld: 40, pctKept: 0.45 },
  { weeksHeld: 44, pctKept: 0.50 },
  { weeksHeld: 48, pctKept: 0.55 },
  { weeksHeld: 52, pctKept: 1.0 },
];

export type StakeContext = {
  /** Human-readable label for what the user is unlocking. */
  label: string;
  /** What they're staking for: shown in the modal header. */
  purpose: string;
  /** Optional minimum stake required to unlock the target. */
  minStakeQubic?: number;
  /** Optional Qubic wallet address of the recipient / target. */
  recipientAddress?: string;
  /** Where the user lands after the lock is signed. Default: dashboard. */
  successHref?: string;
};

/** Lock presets for the duration slider (in weeks). */
export const LOCK_PRESETS = [4, 12, 26, 52] as const;
