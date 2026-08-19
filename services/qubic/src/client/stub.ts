/**
 * Stub Qubic client — Qearn-aware.
 *
 * Deterministic in-memory mock. Useful for local dev and the e2e
 * test suite. Does NOT call the network.
 *
 * Determinism rules:
 *   - Balances derive from the address (last char) so tests can predict.
 *   - Tick advances 1 per call to getCurrentTick() (capped to avoid runaway).
 *   - broadcastStake() to the Qearn contract address applies Qearn
 *     semantics (lock state, week-bucket penalty on unlock). Other
 *     receivers use the generic protocol-level broadcast.
 *   - 1 epoch = 1 week (matches real Qearn). 52 epochs = 1 year.
 *
 * Qearn reference (real mainnet):
 *   - "QEarn" is a deployed Qubic smart contract, not a protocol-level
 *     transfer. Users sign a tx to the Qearn contract's `lock`
 *     procedure; the contract holds the principal.
 *   - Lock range: 10M – 1T QUBIC. Lock duration: 1–52 weeks.
 *   - Reward pool: ~10% of weekly emissions (configurable).
 *   - Early-unlock penalty is bucketed by weeks held — see
 *     `computeEarlyUnlockPenalty`.
 *   - Sources: docs.qubic.org/learn/tokenomics, qubic.org blog
 *     "Introducing QEarn", qubican.com "What is Qubic's Qearn".
 */

import type {
  QubicBalance,
  QubicBroadcastResult,
  QubicClient,
  QubicComputor,
  QubicStakeIntent,
  QubicTickInfo,
  QubicTransaction,
} from "./types.js";
import { createHash } from "node:crypto";

const BASE_TICK = 14_000_000;
const BASE_EPOCH = 150;
const TICK_PER_EPOCH = 14_400; // ~4 hours at 1s ticks (Qubic mainnet) — only used for protocol-level math
const WEEKS_PER_EPOCH = 1;     // Qearn uses 1 epoch = 1 week
const WEEKS_PER_YEAR = 52;
const QEARN_TARGET_APY_BPS = 1250; // 12.50% — typical for ~800B locked, per Qubic docs

/**
 * Qearn staking contract address (60-char A-Z).
 *
 * Format chosen to be visually distinct from a wallet:
 *   "QEARN" + 55 trailing A's.
 * Real Qubic contract addresses are deterministic from contract index;
 * this is a stable placeholder for local dev. When wired to real Qubic,
 * the address should be read from the contract registry (e.g.
 * https://static.qubic.org/v1/general/data/smart_contracts.json).
 */
export const QEARN_CONTRACT_ADDRESS = "QEARN" + "A".repeat(55);

/**
 * Week-bucket penalty schedule (basis points of unearned reward kept
 * by the user on early unlock; remainder is split between burn and
 * redistribution to remaining stakers).
 *
 *   weeks held     | % of reward kept
 *   ---------------+-----------------
 *    0 (under 4)   |   0%
 *    4–11          |   5%
 *   12–15          |  10%
 *   16–19          |  15%
 *   20–23          |  20%
 *   24–27          |  25%
 *   28–31          |  30%
 *   32–35          |  35%
 *   36–39          |  40%
 *   40–43          |  45%
 *   44–47          |  50%
 *   48–51          |  55%
 *   52             | 100%  (full term)
 */
const PENALTY_BUCKETS: ReadonlyArray<{ minWeeks: number; rewardBps: number }> = [
  { minWeeks: 52, rewardBps: 10_000 },
  { minWeeks: 48, rewardBps: 5_500 },
  { minWeeks: 44, rewardBps: 5_000 },
  { minWeeks: 40, rewardBps: 4_500 },
  { minWeeks: 36, rewardBps: 4_000 },
  { minWeeks: 32, rewardBps: 3_500 },
  { minWeeks: 28, rewardBps: 3_000 },
  { minWeeks: 24, rewardBps: 2_500 },
  { minWeeks: 20, rewardBps: 2_000 },
  { minWeeks: 16, rewardBps: 1_500 },
  { minWeeks: 12, rewardBps: 1_000 },
  { minWeeks: 4,  rewardBps: 500 },
  { minWeeks: 0,  rewardBps: 0 },
];

/**
 * Compute the early-unlock penalty for a Qearn position.
 *
 *   weeksHeld   — number of full weeks the position has been locked
 *   totalWeeks  — original lock duration in weeks
 *
 * Returns:
 *   - `rewardBps`: basis points of the accrued reward the user keeps
 *                  (0–10000). The rest is split between burn and
 *                  redistribution per Qearn rules.
 *   - `principalReturnBps`: always 10000 — principal is never touched
 *                  in Qearn, even on early unlock.
 */
export function computeEarlyUnlockPenalty(
  weeksHeld: number,
  totalWeeks: number,
): { rewardBps: number; principalReturnBps: number } {
  if (!Number.isFinite(weeksHeld) || weeksHeld < 0) {
    throw new Error(`weeksHeld must be a non-negative number, got ${weeksHeld}`);
  }
  if (!Number.isFinite(totalWeeks) || totalWeeks < 1) {
    throw new Error(`totalWeeks must be a positive integer, got ${totalWeeks}`);
  }
  // Full term reached: no penalty.
  if (weeksHeld >= totalWeeks) {
    return { rewardBps: 10_000, principalReturnBps: 10_000 };
  }
  for (const bucket of PENALTY_BUCKETS) {
    if (weeksHeld >= bucket.minWeeks) {
      return { rewardBps: bucket.rewardBps, principalReturnBps: 10_000 };
    }
  }
  // Unreachable given the buckets, but be defensive.
  return { rewardBps: 0, principalReturnBps: 10_000 };
}

/**
 * Qearn lock position (the off-chain mirror of the contract's state).
 * One per (staker, lock-id) pair.
 */
export interface QearnLockPosition {
  /** Deterministic lock id, sha256(staker|amount|startEpoch)[:24]. */
  lockId: string;
  staker: string;
  amountQubic: bigint;
  /** Total lock duration in weeks. Capped to 52 per Qearn rules. */
  totalWeeks: number;
  /** Epoch (1-indexed) when the lock started. */
  startEpoch: number;
  /** Tick the lock intent was sealed. */
  startTick: number;
  /** Tx hash that created the lock. */
  lockTxHash: string;
  /** Currently locked — false between unlock intent and finalization. */
  isActive: boolean;
  /** When the position was unlocked (null if still active). */
  unlockedAtTick: number | null;
  /** Unlocked early? */
  isEarly: boolean;
  /** Reward paid out on unlock (in QUBIC), after penalty. BigInt 0 if still active. */
  rewardPaidQubic: bigint;
  /** Penalty burned on unlock (in QUBIC). BigInt 0 if still active. */
  penaltyBurnedQubic: bigint;
}

export interface QearnState {
  contractAddress: string;
  /** Total principal currently locked (sum of all active positions). */
  totalLockedQubic: bigint;
  /** Total rewards distributed since contract inception. */
  totalRewardsPaidQubic: bigint;
  /** Total QUBIC burned from early-unlock penalties. */
  totalBurnedQubic: bigint;
  /** Current simulated APY (basis points), based on the locked pool. */
  currentApyBps: number;
  /** Active positions keyed by staker address. */
  positions: QearnLockPosition[];
}

/** Convert the address to a deterministic uint64-like QUBIC balance. */
function balanceForAddress(address: string): bigint {
  if (!address) return 0n;
  // Use the last 8 chars (interpreted as 4 bytes) plus an offset.
  const tail = address.slice(-8);
  let n = 0n;
  for (const c of tail) n = (n << 8n) | BigInt(c.charCodeAt(0));
  // Clamp to a sensible balance: 1k QUBIC .. 1M QUBIC
  return 1_000_000_000n + (n % 999_000_000_000n);
}

let tickCounter = BASE_TICK;
function nextTick(): number {
  tickCounter += 1;
  if (tickCounter > BASE_TICK + 1_000_000) tickCounter = BASE_TICK; // reset
  return tickCounter;
}

function tickToEpoch(tick: number): number {
  return BASE_EPOCH + Math.floor((tick - BASE_TICK) / TICK_PER_EPOCH);
}

/**
 * Estimate elapsed weeks between two ticks using WEEKS_PER_EPOCH semantics.
 * In the stub we don't have real wall time, so this is an approximation
 * based on tick number (matches real Qearn: 1 epoch = 1 week).
 */
function elapsedWeeks(fromTick: number, toTick: number): number {
  const fromEpoch = tickToEpoch(fromTick);
  const toEpoch = tickToEpoch(toTick);
  return Math.max(0, (toEpoch - fromEpoch) * WEEKS_PER_EPOCH);
}

/**
 * Simulate the APY given a locked pool size and the per-epoch reward
 * budget. Mirrors the real Qubic formula: APY ≈ 100B / totalLocked.
 * Result is basis points, capped to [0, 100_00] (100%).
 */
function simulatedApyBps(totalLockedQubic: bigint): number {
  if (totalLockedQubic <= 0n) return 0;
  // Weekly emission pool: 100B QUBIC / week (per Qubic blog).
  // APY ≈ (100B * 52) / totalLocked → bounded to 100%.
  const weeklyPoolQubic = 100_000_000_000n;
  const annualPoolQubic = weeklyPoolQubic * BigInt(WEEKS_PER_YEAR);
  const apyBpsBig = (annualPoolQubic * 10_000n) / totalLockedQubic;
  const apyBps = Number(apyBpsBig > 10_000n ? 10_000n : apyBpsBig);
  return apyBps;
}

export class StubQubicClient implements QubicClient {
  private readonly broadcastLog: QubicTransaction[] = [];
  private readonly locks = new Map<string, QearnLockPosition>(); // lockId → position

  async ping(): Promise<{ ok: boolean; latencyMs: number; nodeInfo?: unknown }> {
    return { ok: true, latencyMs: 1, nodeInfo: { stub: true, network: "testnet", qearnContract: QEARN_CONTRACT_ADDRESS } };
  }

  async getCurrentTick(): Promise<QubicTickInfo> {
    const tick = nextTick();
    return {
      tickNumber: tick,
      epoch: tickToEpoch(tick),
      sealedAt: Date.now(),
    };
  }

  async getBalance(address: string): Promise<QubicBalance> {
    if (!/^[A-Z]{60}$/.test(address)) {
      throw new Error(`Invalid Qubic address: ${address.slice(0, 10)}...`);
    }
    const tick = await this.getCurrentTick();
    return {
      address,
      balanceQubic: balanceForAddress(address),
      tickNumber: tick.tickNumber,
      observedAt: Date.now(),
    };
  }

  async getTransactionHistory(
    address: string,
    options: { limit?: number; fromTick?: number } = {},
  ): Promise<QubicTransaction[]> {
    const limit = Math.min(options.limit ?? 25, 200);
    const filtered = this.broadcastLog
      .filter((t) => t.fromAddress === address || t.toAddress === address)
      .filter((t) => (options.fromTick ?? 0) <= t.tickNumber)
      .sort((a, b) => b.tickNumber - a.tickNumber)
      .slice(0, limit);
    return filtered;
  }

  async getTransaction(txHash: string): Promise<QubicTransaction | null> {
    return this.broadcastLog.find((t) => t.txHash === txHash) ?? null;
  }

  async broadcastStake(intent: QubicStakeIntent): Promise<QubicBroadcastResult> {
    if (!/^[A-Z]{60}$/.test(intent.staker)) throw new Error("Invalid staker address");
    if (!/^[A-Z]{60}$/.test(intent.receiver)) throw new Error("Invalid receiver address");
    if (intent.amountQubic <= 0n) throw new Error("Amount must be positive");
    if (intent.epochsLocked < 1) throw new Error("Must lock for at least 1 epoch");
    if (!intent.signature || intent.signature.length < 16) {
      throw new Error("Signature required");
    }

    const tick = await this.getCurrentTick();
    const hashInput = JSON.stringify({
      staker: intent.staker,
      receiver: intent.receiver,
      amount: intent.amountQubic.toString(),
      startEpoch: intent.startEpoch,
      tick: intent.tickNumber,
      sig: intent.signature.slice(0, 16),
      isQearn: intent.receiver === QEARN_CONTRACT_ADDRESS,
    });
    const txHash = createHash("sha256").update(hashInput).digest("hex").slice(0, 60).toUpperCase().padEnd(60, "A");

    this.broadcastLog.push({
      txHash,
      fromAddress: intent.staker,
      toAddress: intent.receiver,
      amountQubic: intent.amountQubic,
      tickNumber: tick.tickNumber,
      status: "broadcast",
      timestamp: Date.now(),
    });

    // Qearn path: track the lock in the simulated contract state.
    if (intent.receiver === QEARN_CONTRACT_ADDRESS) {
      this.recordQearnLock(intent, tick.tickNumber, txHash);
    }

    return {
      txHash,
      tickNumber: tick.tickNumber,
      acceptedAt: Date.now(),
    };
  }

  async listComputors(options: { limit?: number } = {}): Promise<QubicComputor[]> {
    const limit = Math.min(options.limit ?? 25, 676);
    const out: QubicComputor[] = [];
    for (let i = 0; i < limit; i++) {
      // Build a deterministic 60-char A–Z address with the index encoded
      // in the last 2 chars as base-26 (AA..ZZ → 0..675).
      // Real Qubic addresses are uppercase A–Z only — no digits.
      const hi = Math.floor(i / 26);
      const lo = i % 26;
      const a = String.fromCharCode(65 + hi);
      const b = String.fromCharCode(65 + lo);
      const tail = a + b; // 2 chars
      const head = "A".repeat(60 - tail.length); // 58 A's
      const addr = (head + tail).slice(0, 60);
      out.push({
        computorIndex: i,
        qubicAddress: addr,
        alias: `computor-${i}`,
        isActive: true,
        performanceScore: 95 + (i % 5),
        stakeQubic: 1_000_000_000_000n + BigInt(i) * 100_000_000n,
      });
    }
    return out;
  }

  async getComputor(index: number): Promise<QubicComputor | null> {
    if (index < 0 || index > 675) return null;
    const list = await this.listComputors({ limit: index + 1 });
    return list[index] ?? null;
  }

  // -------------------------------------------------------------------------
  // Qearn-specific methods (in addition to the QubicClient interface).
  // -------------------------------------------------------------------------

  /** Return the Qearn contract address the stub uses. */
  getQearnContractAddress(): string {
    return QEARN_CONTRACT_ADDRESS;
  }

  /**
   * Simulate an early or full-term unlock of a Qearn position.
   *
   * `weeksHeld` is how many full weeks the position has been locked.
   * If `weeksHeld >= totalWeeks` the position is closed at full reward.
   * Otherwise the Qearn week-bucket penalty is applied: principal is
   * always returned in full; a portion of the accrued reward is
   * withheld, split (50/50 default) between burn and redistribution.
   */
  async unlockQearn(lockId: string, weeksHeld: number): Promise<{
    lockId: string;
    principalReturnedQubic: bigint;
    rewardPaidQubic: bigint;
    penaltyBurnedQubic: bigint;
    penaltyRedistributedQubic: bigint;
    finalTick: number;
  }> {
    const position = this.locks.get(lockId);
    if (!position) throw new Error(`Unknown lock: ${lockId}`);
    if (!position.isActive) throw new Error(`Lock ${lockId} already closed`);

    const tick = await this.getCurrentTick();
    const { rewardBps, principalReturnBps } = computeEarlyUnlockPenalty(
      weeksHeld,
      position.totalWeeks,
    );

    // Accrued reward (linear approximation; real Qearn distributes
    // per-epoch via the contract). Cap to [0, totalWeeks] of weeks.
    const weeksAccrued = Math.max(0, Math.min(weeksHeld, position.totalWeeks));
    const annualRewardQubic = (position.amountQubic * BigInt(QEARN_TARGET_APY_BPS)) / 10_000n;
    const weeklyRewardQubic = annualRewardQubic / BigInt(WEEKS_PER_YEAR);
    const grossRewardQubic = weeklyRewardQubic * BigInt(weeksAccrued);

    const principalReturnedQubic =
      (position.amountQubic * BigInt(principalReturnBps)) / 10_000n;
    const netRewardQubic = (grossRewardQubic * BigInt(rewardBps)) / 10_000n;
    const penaltyQubic = grossRewardQubic - netRewardQubic;
    // 50/50 split between burn and redistribution.
    const penaltyBurnedQubic = penaltyQubic / 2n;
    const penaltyRedistributedQubic = penaltyQubic - penaltyBurnedQubic;

    position.isActive = false;
    position.isEarly = weeksHeld < position.totalWeeks;
    position.unlockedAtTick = tick.tickNumber;
    position.rewardPaidQubic = netRewardQubic;
    position.penaltyBurnedQubic = penaltyBurnedQubic;

    return {
      lockId,
      principalReturnedQubic,
      rewardPaidQubic: netRewardQubic,
      penaltyBurnedQubic,
      penaltyRedistributedQubic,
      finalTick: tick.tickNumber,
    };
  }

  /** Get the current simulated state of the Qearn contract. */
  async getQearnState(): Promise<QearnState> {
    const active = Array.from(this.locks.values()).filter((p) => p.isActive);
    const totalLockedQubic = active.reduce((s, p) => s + p.amountQubic, 0n);
    const totalRewardsPaidQubic = Array.from(this.locks.values())
      .reduce((s, p) => s + p.rewardPaidQubic, 0n);
    const totalBurnedQubic = Array.from(this.locks.values())
      .reduce((s, p) => s + p.penaltyBurnedQubic, 0n);
    return {
      contractAddress: QEARN_CONTRACT_ADDRESS,
      totalLockedQubic,
      totalRewardsPaidQubic,
      totalBurnedQubic,
      currentApyBps: simulatedApyBps(totalLockedQubic),
      positions: active,
    };
  }

  /** Get a single lock position by id (or null if not found). */
  async getQearnPosition(lockId: string): Promise<QearnLockPosition | null> {
    return this.locks.get(lockId) ?? null;
  }

  /** List all positions for a given staker (active + closed). */
  async listQearnPositions(staker: string): Promise<QearnLockPosition[]> {
    return Array.from(this.locks.values()).filter((p) => p.staker === staker);
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private recordQearnLock(
    intent: QubicStakeIntent,
    tickNumber: number,
    txHash: string,
  ): void {
    const lockIdInput = `${intent.staker}|${intent.amountQubic.toString()}|${intent.startEpoch}|${tickNumber}`;
    const lockId = createHash("sha256").update(lockIdInput).digest("hex").slice(0, 24);
    // Qearn locks are in weeks; our stake intent uses epochs.
    // Per Qubic config, 1 epoch = 1 week (WEEKS_PER_EPOCH), so this is a 1:1 mapping.
    const totalWeeks = Math.min(intent.epochsLocked * WEEKS_PER_EPOCH, WEEKS_PER_YEAR);
    const position: QearnLockPosition = {
      lockId,
      staker: intent.staker,
      amountQubic: intent.amountQubic,
      totalWeeks,
      startEpoch: intent.startEpoch,
      startTick: tickNumber,
      lockTxHash: txHash,
      isActive: true,
      unlockedAtTick: null,
      isEarly: false,
      rewardPaidQubic: 0n,
      penaltyBurnedQubic: 0n,
    };
    this.locks.set(lockId, position);
  }
}
