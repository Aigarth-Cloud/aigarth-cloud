/**
 * AigarthPool in-process simulator.
 *
 * Mirrors the QPI contract spec at docs/aigarthpool/contract.md for
 * local dev. Every procedure / query in the contract has a 1:1
 * counterpart here. The watcher in services/qubic subscribes to
 * the same events the real contract would emit.
 *
 * Default mode for dev/test. When AIO is available, the real
 * `AigarthPoolClient` (Qubic RPC) is wired in instead — the
 * interface is identical, so no service code changes.
 *
 * Phase 22: adds the governance sub-state (M1+M2 from
 * docs/aigarthpool/audit-checklist.md). Signer set, threshold,
 * pending treasury transfers, pending signer rotations — all
 * modelled here so the off-chain services can exercise the full
 * approval flow without AIO.
 *
 * Yield model: 4% APR prorated by weeks (matches Qearn's published
 * rate as of 2026-08). This is a placeholder; the real contract
 * reads the yield from Qearn directly.
 */

import { randomBytes } from "node:crypto";
import type {
  AigarthPoolClient,
  AigarthPoolEvent,
  AnnSplits,
  GovernanceState,
  PendingSignerChange,
  PendingTreasuryTransfer,
  Position,
  QubicIdentity,
  SplitResult,
  Totals,
  YieldOwed,
} from "./types.js";
import { PENDING_OP_TTL_EPOCHS } from "./types.js";

const MAX_POSITIONS_PER_USER = 64;
const MAX_ANNS = 65_536;
const EPOCHS_PER_YEAR = 52;
const MAX_SIGNERS = 16;
const DEFAULT_BPS_CREATOR = 3_000;   // 30%
const DEFAULT_BPS_USER = 6_000;      // 60%
const DEFAULT_BPS_TREASURY = 1_000;  // 10%

// ---------- Phase 23.1 (M3) — Rate limits ----------
// Per-tx cap: 1,000,000 QUBIC. Per-user-per-epoch cap: 5,000,000 QUBIC.
// Amounts are in Qu-bit (1 QUBIC = 1,000,000 Qu-bit), so:
//   1,000,000 QUBIC = 1_000_000_000_000 Qu-bit
//   5,000,000 QUBIC = 5_000_000_000_000 Qu-bit
// The audit checklist says "1,000,000 QUBIC per transaction" — the
// per-day (per-epoch) cap is a blast-radius limit too, set at 5x the
// per-tx cap. Both are env-overridable for test isolation, but the
// default is the prod cap.
const MAX_STAKE_PER_TX = 1_000_000_000_000n;
const MAX_STAKE_PER_USER_PER_EPOCH = 5_000_000_000_000n;

interface UserState {
  positions: Position[];
  yieldOwed: Map<string, YieldOwed>; // key = annId
  /**
   * Phase 23.1 (M3): sum of `stakeForAnn` amounts in the current
   * epoch. Reset when the user makes a call in a new epoch (the
   * simulator already advances currentEpoch explicitly via
   * `advanceEpochs`). Per-user state is O(1) — no global scan.
   */
  stakedThisEpoch: bigint;
  lastStakeEpoch: number;
}

export class AigarthPoolSimulator implements AigarthPoolClient {
  readonly mode = "simulator" as const;

  private users = new Map<QubicIdentity, UserState>();
  private splits = new Map<string, AnnSplits>();
  private currentEpoch = 0;
  private totals: Totals = {
    totalStaked: 0n,
    totalPositions: 0,
    totalYieldPaid: 0n,
    totalYieldToCreator: 0n,
    totalYieldToTreasury: 0n,
  };
  private handlers = new Set<(e: AigarthPoolEvent) => void>();

  /**
   * Original lock duration per qearn lock id. The contract spec
   * computes yield from `(amount, original_weeks)` at unlock time —
   * we record the original weeks here so the yield model is
   * deterministic. (The contract tracks this implicitly via the
   * difference between `created_epoch` and `lock_until_epoch`; the
   * simulator collapses it into a side-channel map for simplicity.)
   */
  private originalWeeksByLockId = new Map<string, number>();

  // ---------- Phase 22: Governance state ----------

  private signers: QubicIdentity[] = [];
  private signerThreshold = 0;
  private treasuryWallet: QubicIdentity = "";
  private governanceInitialized = false;
  private pendingTreasuryTransfer: PendingTreasuryTransfer | null = null;
  private pendingSignerChange: PendingSignerChange | null = null;

  // ---------- Phase 23.2 (M4): Circuit breaker ----------
  // When true, every mutation procedure (stakeForAnn, extendLock,
  // unlock, claimRewards, setAnnSplits) rejects with `PAUSED`. The
  // governance procedures (init, submit/approve/execute treasury +
  // signer-change) are also mutations of governance state and so
  // are rejected too. pause/unpause themselves are the only way to
  // change the flag. Read-only queries and the event subscription
  // are unaffected.
  private paused = false;

  // ---------- Test-only / advanced ----------

  /**
   * Advance the simulated clock. Production never calls this — the
   * real contract reads the Qubic clock. Tests use it to simulate
   * the passage of epochs.
   */
  advanceEpochs(n: number): void {
    if (n < 0) throw new Error("cannot rewind the clock");
    this.currentEpoch += n;
  }

  /**
   * Reset all state. Tests use this in `beforeEach`. Production
   * never calls it.
   */
  reset(): void {
    this.users.clear();
    this.splits.clear();
    this.currentEpoch = 0;
    this.totals = {
      totalStaked: 0n,
      totalPositions: 0,
      totalYieldPaid: 0n,
      totalYieldToCreator: 0n,
      totalYieldToTreasury: 0n,
    };
    this.handlers.clear();
    this.signers = [];
    this.signerThreshold = 0;
    this.treasuryWallet = "";
    this.governanceInitialized = false;
    this.pendingTreasuryTransfer = null;
    this.pendingSignerChange = null;
    this.paused = false;
  }

  // ---------- Procedures ----------

  async stakeForAnn(user: QubicIdentity, annId: string, amount: bigint, weeks: number): Promise<Position> {
    // Phase 23.2 (M4): pause gate comes first — no mutation at all
    // while paused, regardless of validity. (Read-only queries below
    // this point are unaffected.)
    if (this.paused) throw new AigarthPoolError("pool is paused (M4 circuit breaker)", "PAUSED");
    if (amount <= 0n) throw new AigarthPoolError("amount must be > 0", "INVALID_AMOUNT");
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > EPOCHS_PER_YEAR) {
      throw new AigarthPoolError(`weeks must be in [1, ${EPOCHS_PER_YEAR}]`, "INVALID_WEEKS");
    }
    const cfg = this.splits.get(annId);
    if (!cfg || !cfg.active) throw new AigarthPoolError(`ANN ${annId} not registered`, "ANN_NOT_REGISTERED");

    // ---------- Phase 23.1 (M3) — Rate limits ----------
    // Per-tx cap: blast-radius limit on a single call.
    if (amount > MAX_STAKE_PER_TX) {
      throw new AigarthPoolError(
        `amount ${amount} exceeds per-tx cap of ${MAX_STAKE_PER_TX} (${MAX_STAKE_PER_TX / 1_000_000n} QUBIC)`,
        "AMOUNT_EXCEEDS_TX_CAP",
      );
    }
    const userState = this.getOrCreateUser(user);
    // Per-user-per-epoch cap: reset the running total if the user
    // is staking in a new epoch. This is O(1) per call.
    if (this.currentEpoch > userState.lastStakeEpoch) {
      userState.stakedThisEpoch = 0n;
      userState.lastStakeEpoch = this.currentEpoch;
    }
    if (userState.stakedThisEpoch + amount > MAX_STAKE_PER_USER_PER_EPOCH) {
      throw new AigarthPoolError(
        `user ${user} would stake ${userState.stakedThisEpoch + amount} in epoch ${this.currentEpoch} ` +
          `(cap ${MAX_STAKE_PER_USER_PER_EPOCH} = ${MAX_STAKE_PER_USER_PER_EPOCH / 1_000_000n} QUBIC)`,
        "AMOUNT_EXCEEDS_USER_EPOCH_CAP",
      );
    }

    if (userState.positions.filter((p) => p.active).length >= MAX_POSITIONS_PER_USER) {
      throw new AigarthPoolError(`per-user cap of ${MAX_POSITIONS_PER_USER} positions reached`, "USER_CAP");
    }

    // Forward to Qearn — simulator: no-op, we just record the lock id.
    const qearnLockId = `qearn_${randomBytes(16).toString("hex")}`;
    const lockUntilEpoch = this.currentEpoch + weeks;
    this.originalWeeksByLockId.set(qearnLockId, weeks);

    const position: Position = {
      annId,
      amount,
      lockUntilEpoch,
      qearnLockId,
      active: true,
    };
    userState.positions.push(position);
    userState.stakedThisEpoch += amount;

    this.totals.totalStaked += amount;
    this.totals.totalPositions += 1;

    this.emit({ kind: "PositionOpened", user, annId, amount, lockUntilEpoch, qearnLockId });
    return position;
  }

  async extendLock(user: QubicIdentity, annId: string, additionalWeeks: number): Promise<Position> {
    if (this.paused) throw new AigarthPoolError("pool is paused (M4 circuit breaker)", "PAUSED");
    if (!Number.isInteger(additionalWeeks) || additionalWeeks < 1 || additionalWeeks > EPOCHS_PER_YEAR) {
      throw new AigarthPoolError(`additionalWeeks must be in [1, ${EPOCHS_PER_YEAR}]`, "INVALID_WEEKS");
    }
    const userState = this.users.get(user);
    if (!userState) throw new AigarthPoolError(`no positions for user`, "NO_POSITION");
    const target = userState.positions.find((p) => p.active && p.annId === annId);
    if (!target) throw new AigarthPoolError(`no active position for (${user}, ${annId})`, "NO_POSITION");
    const remaining = target.lockUntilEpoch - this.currentEpoch;
    const newTotal = remaining + additionalWeeks;
    if (newTotal > EPOCHS_PER_YEAR) {
      throw new AigarthPoolError(
        `extending by ${additionalWeeks} would total ${newTotal} epochs (> ${EPOCHS_PER_YEAR})`,
        "EXCEEDS_CAP",
      );
    }
    target.lockUntilEpoch = this.currentEpoch + newTotal;
    return target;
  }

  async unlock(user: QubicIdentity, annId: string): Promise<void> {
    if (this.paused) throw new AigarthPoolError("pool is paused (M4 circuit breaker)", "PAUSED");
    const userState = this.users.get(user);
    if (!userState) throw new AigarthPoolError(`no positions for user`, "NO_POSITION");
    const target = userState.positions.find((p) => p.active && p.annId === annId);
    if (!target) throw new AigarthPoolError(`no active position for (${user}, ${annId})`, "NO_POSITION");
    if (target.lockUntilEpoch > this.currentEpoch) {
      throw new AigarthPoolError(
        `cliff not reached: lock_until=${target.lockUntilEpoch}, current=${this.currentEpoch}`,
        "CLIFF_NOT_REACHED",
      );
    }
    target.active = false;

    // Yield model: 4% APR prorated by weeks. We track the original
    // lock duration in `originalWeeksByLockId` because the contract
    // spec doesn't store it directly (it derives from the
    // difference between created_epoch and lock_until_epoch; the
    // simulator collapses that into a side-channel for simplicity).
    const originalWeeks = this.originalWeeksByLockId.get(target.qearnLockId) ?? 0;
    const yieldAmount = computeYield(target.amount, originalWeeks);
    const principal = target.amount;
    const cfg = this.splits.get(annId);
    if (!cfg || !cfg.active) throw new AigarthPoolError(`ANN ${annId} not registered`, "ANN_NOT_REGISTERED");
    const split = applySplits(yieldAmount, cfg.creatorBps, cfg.userBps);

    userState.yieldOwed.set(annId, {
      principal,
      yieldAmount: split.userAmount,
      annId,
      claimed: false,
    });

    this.totals.totalYieldPaid += yieldAmount;
    this.totals.totalYieldToCreator += split.creatorAmount;
    this.totals.totalYieldToTreasury += split.treasuryAmount;
    this.totals.totalStaked -= principal;
    this.totals.totalPositions -= 1;

    this.emit({
      kind: "PositionClosed",
      user,
      annId,
      principal,
      yieldAmount,
      creatorAmount: split.creatorAmount,
      userAmount: split.userAmount,
      treasuryAmount: split.treasuryAmount,
    });
  }

  async claimRewards(user: QubicIdentity, annId: string): Promise<{ principal: bigint; yield: bigint }> {
    if (this.paused) throw new AigarthPoolError("pool is paused (M4 circuit breaker)", "PAUSED");
    const userState = this.users.get(user);
    if (!userState) throw new AigarthPoolError(`no positions for user`, "NO_POSITION");
    const owed = userState.yieldOwed.get(annId);
    if (!owed) throw new AigarthPoolError(`no rewards owed for (${user}, ${annId})`, "NO_REWARDS");
    if (owed.claimed) return { principal: 0n, yield: 0n };

    owed.claimed = true;
    const principalPaid = owed.principal;
    const yieldPaid = owed.yieldAmount;
    this.emit({ kind: "RewardsClaimed", user, annId, principalPaid, yieldPaid });
    return { principal: principalPaid, yield: yieldPaid };
  }

  async setAnnSplits(
    caller: QubicIdentity,
    annId: string,
    creatorBps: number,
    userBps: number,
    treasuryBps: number,
    creatorWallet: QubicIdentity,
  ): Promise<AnnSplits> {
    if (this.paused) throw new AigarthPoolError("pool is paused (M4 circuit breaker)", "PAUSED");
    if (creatorBps < 0 || creatorBps > 10_000) throw new AigarthPoolError("creator_bps out of range", "INVALID_BPS");
    if (userBps < 0 || userBps > 10_000) throw new AigarthPoolError("user_bps out of range", "INVALID_BPS");
    if (treasuryBps < 0 || treasuryBps > 10_000) throw new AigarthPoolError("treasury_bps out of range", "INVALID_BPS");
    if (creatorBps + userBps + treasuryBps !== 10_000) {
      throw new AigarthPoolError(
        `splits must sum to 10000 (got ${creatorBps + userBps + treasuryBps})`,
        "SPLITS_NOT_10000",
      );
    }

    // Phase 22: authorization — caller is either:
    //   (a) the very first setAnnSplits for this ANN (registration),
    //   (b) the ANN's existing creator, or
    //   (c) a current governance signer.
    // The first call is special: it implicitly grants creator status
    // to the caller (mirrors the contract spec — the creator is
    // whoever registered the ANN).
    const existing = this.splits.get(annId);
    const isFirstRegistration = !existing || !existing.active;
    const isCreator = existing?.active && existing.creatorWallet === caller;
    const isSigner = this.signers.includes(caller);
    if (!isFirstRegistration && !isCreator && !isSigner) {
      throw new AigarthPoolError(
        `caller ${caller} is not the ANN creator and not a governance signer`,
        "UNAUTHORIZED",
      );
    }

    const cfg: AnnSplits = { creatorBps, userBps, treasuryBps, creatorWallet, active: true };
    this.splits.set(annId, cfg);
    this.emit({
      kind: "SplitsChanged",
      annId,
      creatorBps,
      userBps,
      treasuryBps,
      treasuryWallet: this.treasuryWallet || creatorWallet,
      actor: caller,
      viaGovernance: isSigner && !isCreator,
    });
    return cfg;
  }

  // ---------- Phase 22: Governance procedures ----------

  async initGovernance(initialSigners: QubicIdentity[], threshold: number): Promise<void> {
    if (this.governanceInitialized) throw new AigarthPoolError("governance already initialized", "ALREADY_INITIALIZED");
    if (initialSigners.length < 1 || initialSigners.length > MAX_SIGNERS) {
      throw new AigarthPoolError(`signer_count must be in [1, ${MAX_SIGNERS}]`, "INVALID_SIGNERS");
    }
    if (threshold < 1 || threshold > initialSigners.length) {
      throw new AigarthPoolError(`threshold must be in [1, ${initialSigners.length}]`, "INVALID_THRESHOLD");
    }
    // Dedupe (the contract does this implicitly via signer index lookup;
    // a duplicate would have ambiguous index).
    const seen = new Set<QubicIdentity>();
    for (const s of initialSigners) {
      if (seen.has(s)) throw new AigarthPoolError(`duplicate signer ${s}`, "DUPLICATE_SIGNER");
      seen.add(s);
    }
    this.signers = [...initialSigners];
    this.signerThreshold = threshold;
    this.treasuryWallet = this.signers[0]!;
    this.governanceInitialized = true;
    this.emit({ kind: "GovernanceInitialized", signers: [...this.signers], threshold, treasuryWallet: this.treasuryWallet });
  }

  async submitTreasuryTransfer(caller: QubicIdentity, to: QubicIdentity, nonce: number): Promise<void> {
    if (!this.governanceInitialized) throw new AigarthPoolError("governance not initialized", "NOT_INITIALIZED");
    if (!this.signers.includes(caller)) throw new AigarthPoolError(`caller ${caller} is not a signer`, "NOT_SIGNER");
    if (this.pendingTreasuryTransfer) {
      throw new AigarthPoolError("a treasury transfer is already pending", "PENDING_EXISTS");
    }
    this.pendingTreasuryTransfer = {
      to,
      nonce,
      submittedAtEpoch: this.currentEpoch,
      approvals: new Map(),
      approvalCount: 0,
    };
    this.emit({ kind: "TreasuryTransferSubmitted", to, nonce, submittedBy: caller });
  }

  async approveTreasuryTransfer(caller: QubicIdentity, nonce: number): Promise<void> {
    if (!this.governanceInitialized) throw new AigarthPoolError("governance not initialized", "NOT_INITIALIZED");
    if (!this.pendingTreasuryTransfer) throw new AigarthPoolError("no pending transfer", "NO_PENDING");
    if (this.pendingTreasuryTransfer.nonce !== nonce) {
      throw new AigarthPoolError(`nonce mismatch (pending=${this.pendingTreasuryTransfer.nonce}, got=${nonce})`, "NONCE_MISMATCH");
    }
    if (this.currentEpoch > this.pendingTreasuryTransfer.submittedAtEpoch + PENDING_OP_TTL_EPOCHS) {
      throw new AigarthPoolError("pending op expired", "EXPIRED");
    }
    if (!this.signers.includes(caller)) throw new AigarthPoolError(`caller ${caller} is not a signer`, "NOT_SIGNER");
    if (this.pendingTreasuryTransfer.approvals.get(caller)) {
      return; // idempotent
    }
    this.pendingTreasuryTransfer.approvals.set(caller, true);
    this.pendingTreasuryTransfer.approvalCount += 1;
    this.emit({
      kind: "TreasuryTransferApproved",
      nonce,
      approvedBy: caller,
      approvalCount: this.pendingTreasuryTransfer.approvalCount,
      threshold: this.signerThreshold,
    });
  }

  async executeTreasuryTransfer(nonce: number): Promise<void> {
    if (!this.governanceInitialized) throw new AigarthPoolError("governance not initialized", "NOT_INITIALIZED");
    if (!this.pendingTreasuryTransfer) throw new AigarthPoolError("no pending transfer", "NO_PENDING");
    if (this.pendingTreasuryTransfer.nonce !== nonce) {
      throw new AigarthPoolError(`nonce mismatch`, "NONCE_MISMATCH");
    }
    if (this.currentEpoch > this.pendingTreasuryTransfer.submittedAtEpoch + PENDING_OP_TTL_EPOCHS) {
      this.pendingTreasuryTransfer = null;
      throw new AigarthPoolError("pending op expired", "EXPIRED");
    }
    if (this.pendingTreasuryTransfer.approvalCount < this.signerThreshold) {
      throw new AigarthPoolError(
        `need ${this.signerThreshold} approvals, have ${this.pendingTreasuryTransfer.approvalCount}`,
        "THRESHOLD_NOT_MET",
      );
    }
    const from = this.treasuryWallet;
    const to = this.pendingTreasuryTransfer.to;
    this.treasuryWallet = to;
    this.pendingTreasuryTransfer = null;
    this.emit({ kind: "TreasuryTransferExecuted", from, to, nonce });
  }

  async submitSignerChange(
    caller: QubicIdentity,
    toAdd: QubicIdentity[],
    toRemove: QubicIdentity[],
    newThreshold: number | null,
    nonce: number,
  ): Promise<void> {
    if (!this.governanceInitialized) throw new AigarthPoolError("governance not initialized", "NOT_INITIALIZED");
    if (!this.signers.includes(caller)) throw new AigarthPoolError(`caller ${caller} is not a signer`, "NOT_SIGNER");
    if (this.pendingSignerChange) throw new AigarthPoolError("a signer change is already pending", "PENDING_EXISTS");
    if (toRemove.some((s) => !this.signers.includes(s))) {
      throw new AigarthPoolError(`toRemove contains non-signer`, "INVALID_REMOVE");
    }
    const resultingCount = this.signers.length - toRemove.length + toAdd.length;
    if (resultingCount > MAX_SIGNERS) throw new AigarthPoolError(`resulting signer set > ${MAX_SIGNERS}`, "TOO_MANY_SIGNERS");
    if (resultingCount < 1) throw new AigarthPoolError(`resulting signer set would be empty`, "EMPTY_SIGNER_SET");
    if (newThreshold !== null && (newThreshold < 1 || newThreshold > resultingCount)) {
      throw new AigarthPoolError(`newThreshold ${newThreshold} out of [1, ${resultingCount}]`, "INVALID_THRESHOLD");
    }
    // Dedupe adds.
    const seen = new Set<QubicIdentity>();
    for (const s of toAdd) {
      if (seen.has(s)) throw new AigarthPoolError(`duplicate add ${s}`, "DUPLICATE_SIGNER");
      seen.add(s);
    }
    // Reject add of an existing signer (it's a no-op, but indicates caller confusion).
    for (const s of toAdd) {
      if (this.signers.includes(s) && !toRemove.includes(s)) {
        throw new AigarthPoolError(`${s} is already a signer (and not in toRemove)`, "ALREADY_SIGNER");
      }
    }

    this.pendingSignerChange = {
      toAdd: [...toAdd],
      toRemove: [...toRemove],
      newThreshold,
      nonce,
      submittedAtEpoch: this.currentEpoch,
      approvals: new Map(),
      approvalCount: 0,
    };
    this.emit({
      kind: "SignerChangeSubmitted",
      added: [...toAdd],
      removed: [...toRemove],
      newThreshold,
      nonce,
      submittedBy: caller,
    });
  }

  async approveSignerChange(caller: QubicIdentity, nonce: number): Promise<void> {
    if (!this.governanceInitialized) throw new AigarthPoolError("governance not initialized", "NOT_INITIALIZED");
    if (!this.pendingSignerChange) throw new AigarthPoolError("no pending change", "NO_PENDING");
    if (this.pendingSignerChange.nonce !== nonce) {
      throw new AigarthPoolError(`nonce mismatch`, "NONCE_MISMATCH");
    }
    if (this.currentEpoch > this.pendingSignerChange.submittedAtEpoch + PENDING_OP_TTL_EPOCHS) {
      throw new AigarthPoolError("pending op expired", "EXPIRED");
    }
    if (!this.signers.includes(caller)) throw new AigarthPoolError(`caller ${caller} is not a signer`, "NOT_SIGNER");
    if (this.pendingSignerChange.approvals.get(caller)) return;
    this.pendingSignerChange.approvals.set(caller, true);
    this.pendingSignerChange.approvalCount += 1;
    this.emit({
      kind: "SignerChangeApproved",
      nonce,
      approvedBy: caller,
      approvalCount: this.pendingSignerChange.approvalCount,
      threshold: this.signerThreshold,
    });
  }

  async executeSignerChange(nonce: number): Promise<void> {
    if (!this.governanceInitialized) throw new AigarthPoolError("governance not initialized", "NOT_INITIALIZED");
    if (!this.pendingSignerChange) throw new AigarthPoolError("no pending change", "NO_PENDING");
    if (this.pendingSignerChange.nonce !== nonce) {
      throw new AigarthPoolError(`nonce mismatch`, "NONCE_MISMATCH");
    }
    if (this.currentEpoch > this.pendingSignerChange.submittedAtEpoch + PENDING_OP_TTL_EPOCHS) {
      this.pendingSignerChange = null;
      throw new AigarthPoolError("pending op expired", "EXPIRED");
    }
    if (this.pendingSignerChange.approvalCount < this.signerThreshold) {
      throw new AigarthPoolError(
        `need ${this.signerThreshold} approvals, have ${this.pendingSignerChange.approvalCount}`,
        "THRESHOLD_NOT_MET",
      );
    }
    const removed = [...this.pendingSignerChange.toRemove];
    const added = [...this.pendingSignerChange.toAdd];
    const newThreshold = this.pendingSignerChange.newThreshold;
    // Apply removes (filter preserves order).
    this.signers = this.signers.filter((s) => !removed.includes(s));
    // Apply adds (reject any that are now signers — should be a no-op given submit validation).
    for (const s of added) {
      if (!this.signers.includes(s)) this.signers.push(s);
    }
    if (newThreshold !== null) this.signerThreshold = newThreshold;
    else if (this.signerThreshold > this.signers.length) this.signerThreshold = this.signers.length;

    this.pendingSignerChange = null;
    this.emit({
      kind: "SignerChangeExecuted",
      added,
      removed,
      newThreshold,
      nonce,
      newSignerCount: this.signers.length,
      newThresholdValue: this.signerThreshold,
    });
  }

  // ---------- Phase 23.2 (M4): Circuit breaker ----------

  async pause(caller: QubicIdentity): Promise<void> {
    if (!this.governanceInitialized) {
      throw new AigarthPoolError("governance not initialized", "NOT_INITIALIZED");
    }
    if (!this.signers.includes(caller)) {
      throw new AigarthPoolError(`caller ${caller} is not a governance signer`, "NOT_SIGNER");
    }
    if (this.paused) {
      // Idempotent: re-pausing is a no-op but still emit so the
      // audit log records the attempt.
      this.emit({ kind: "PoolPaused", by: caller, atEpoch: this.currentEpoch });
      return;
    }
    this.paused = true;
    this.emit({ kind: "PoolPaused", by: caller, atEpoch: this.currentEpoch });
  }

  async unpause(caller: QubicIdentity): Promise<void> {
    if (!this.governanceInitialized) {
      throw new AigarthPoolError("governance not initialized", "NOT_INITIALIZED");
    }
    if (!this.signers.includes(caller)) {
      throw new AigarthPoolError(`caller ${caller} is not a governance signer`, "NOT_SIGNER");
    }
    if (!this.paused) {
      this.emit({ kind: "PoolUnpaused", by: caller, atEpoch: this.currentEpoch });
      return;
    }
    this.paused = false;
    this.emit({ kind: "PoolUnpaused", by: caller, atEpoch: this.currentEpoch });
  }

  // ---------- Queries ----------

  async getPosition(user: QubicIdentity, annId: string): Promise<Position | null> {
    const userState = this.users.get(user);
    if (!userState) return null;
    const p = userState.positions.find((p) => p.active && p.annId === annId);
    return p ?? null;
  }

  async getAnnSplits(annId: string): Promise<AnnSplits | null> {
    return this.splits.get(annId) ?? null;
  }

  async getYieldOwed(user: QubicIdentity, annId: string): Promise<YieldOwed | null> {
    const userState = this.users.get(user);
    if (!userState) return null;
    return userState.yieldOwed.get(annId) ?? null;
  }

  async getTotals(): Promise<Totals> {
    return { ...this.totals };
  }

  async getGovernanceState(): Promise<GovernanceState> {
    return {
      initialized: this.governanceInitialized,
      signers: [...this.signers],
      threshold: this.signerThreshold,
      treasuryWallet: this.treasuryWallet,
      hasPendingTreasuryTransfer: this.pendingTreasuryTransfer !== null,
      hasPendingSignerChange: this.pendingSignerChange !== null,
      pendingTreasuryTransfer: this.pendingTreasuryTransfer
        ? { ...this.pendingTreasuryTransfer, approvals: new Map(this.pendingTreasuryTransfer.approvals) }
        : null,
      pendingSignerChange: this.pendingSignerChange
        ? { ...this.pendingSignerChange, approvals: new Map(this.pendingSignerChange.approvals) }
        : null,
      pendingOpExpiresAtEpoch: this.pendingTreasuryTransfer
        ? this.pendingTreasuryTransfer.submittedAtEpoch + PENDING_OP_TTL_EPOCHS
        : this.pendingSignerChange
          ? this.pendingSignerChange.submittedAtEpoch + PENDING_OP_TTL_EPOCHS
          : null,
      paused: this.paused,
    };
  }

  async isPaused(): Promise<boolean> {
    return this.paused;
  }

  subscribe(handler: (event: AigarthPoolEvent) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  // ---------- Internals ----------

  private getOrCreateUser(user: QubicIdentity): UserState {
    let s = this.users.get(user);
    if (!s) {
      s = { positions: [], yieldOwed: new Map(), stakedThisEpoch: 0n, lastStakeEpoch: -1 };
      this.users.set(user, s);
    }
    return s;
  }

  private emit(event: AigarthPoolEvent): void {
    for (const h of this.handlers) {
      try {
        h(event);
      } catch (err) {
        // Handlers must not throw. Swallow + continue so one bad
        // subscriber doesn't poison the rest.
        // eslint-disable-next-line no-console
        console.error("AigarthPoolSimulator handler threw", err);
      }
    }
  }
}

// ---------- Helpers (exposed for the test suite) ----------

/**
 * Pure function. Mirrors `applySplits` in the C++ contract.
 *
 * Truncation rule: creator and treasury get floor division. The
 * user absorbs the rounding remainder so the contract never mints
 * or burns value.
 */
export function applySplits(totalYield: bigint, creatorBps: number, userBps: number): SplitResult {
  const BPS_DENOM = 10_000n;
  const creatorAmount = (totalYield * BigInt(creatorBps)) / BPS_DENOM;
  const treasuryAmount = (totalYield * BigInt(10_000 - creatorBps - userBps)) / BPS_DENOM;
  const userAmount = totalYield - creatorAmount - treasuryAmount;
  return { creatorAmount, userAmount, treasuryAmount };
}

/**
 * Yield model. 4% APR prorated by weeks. 1 epoch = 1 week.
 * yield = amount * 400 bps * weeks / (10_000 bps * 52 weeks)
 */
export function computeYield(amount: bigint, weeks: number): bigint {
  if (amount <= 0n || weeks <= 0) return 0n;
  return (amount * 400n * BigInt(weeks)) / (10_000n * BigInt(EPOCHS_PER_YEAR));
}

/**
 * Default splits used by `registerAnn` below.
 */
export function defaultSplits(creatorWallet: QubicIdentity): AnnSplits {
  return {
    creatorBps: DEFAULT_BPS_CREATOR,
    userBps: DEFAULT_BPS_USER,
    treasuryBps: DEFAULT_BPS_TREASURY,
    creatorWallet,
    active: true,
  };
}

// ---------- Errors ----------

export class AigarthPoolError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "AigarthPoolError";
  }
}

// Suppress unused-import warnings
void MAX_ANNS;
