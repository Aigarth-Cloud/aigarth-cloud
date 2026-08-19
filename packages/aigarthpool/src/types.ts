/**
 * Shared types for the AigarthPool client and simulator.
 *
 * Mirrors the QPI contract spec at docs/aigarthpool/contract.md.
 * When the AIO Dev Kit is available and the real contract is
 * deployed, the wire types stay the same — only the backend
 * changes.
 */

// 32-byte Qubic identity (the staker's wallet key). Hex-string in
// the off-chain world; byte array on-chain.
export type QubicIdentity = string;

export interface Position {
  annId: string;
  amount: bigint;
  lockUntilEpoch: number;
  qearnLockId: string;
  active: boolean;
}

export interface AnnSplits {
  creatorBps: number;
  userBps: number;
  treasuryBps: number;
  creatorWallet: QubicIdentity;
  active: boolean;
}

export interface YieldOwed {
  principal: bigint;
  yieldAmount: bigint;
  annId: string;
  claimed: boolean;
}

export interface Totals {
  totalStaked: bigint;
  totalPositions: number;
  totalYieldPaid: bigint;
  totalYieldToCreator: bigint;
  totalYieldToTreasury: bigint;
}

export interface SplitResult {
  creatorAmount: bigint;
  userAmount: bigint;
  treasuryAmount: bigint;
}

// ---------- Events (emitted by the simulator; consumed by the watcher) ----------

export type AigarthPoolEvent =
  | { kind: "PositionOpened"; user: QubicIdentity; annId: string; amount: bigint; lockUntilEpoch: number; qearnLockId: string }
  | { kind: "PositionClosed"; user: QubicIdentity; annId: string; principal: bigint; yieldAmount: bigint; creatorAmount: bigint; userAmount: bigint; treasuryAmount: bigint }
  | { kind: "RewardsClaimed"; user: QubicIdentity; annId: string; principalPaid: bigint; yieldPaid: bigint }
  | { kind: "SplitsChanged"; annId: string; creatorBps: number; userBps: number; treasuryBps: number; treasuryWallet: QubicIdentity; actor: QubicIdentity; viaGovernance: boolean }
  // Phase 22: governance events
  | { kind: "GovernanceInitialized"; signers: QubicIdentity[]; threshold: number; treasuryWallet: QubicIdentity }
  | { kind: "TreasuryTransferSubmitted"; to: QubicIdentity; nonce: number; submittedBy: QubicIdentity }
  | { kind: "TreasuryTransferApproved"; nonce: number; approvedBy: QubicIdentity; approvalCount: number; threshold: number }
  | { kind: "TreasuryTransferExecuted"; from: QubicIdentity; to: QubicIdentity; nonce: number }
  | { kind: "SignerChangeSubmitted"; added: QubicIdentity[]; removed: QubicIdentity[]; newThreshold: number | null; nonce: number; submittedBy: QubicIdentity }
  | { kind: "SignerChangeApproved"; nonce: number; approvedBy: QubicIdentity; approvalCount: number; threshold: number }
  | { kind: "SignerChangeExecuted"; added: QubicIdentity[]; removed: QubicIdentity[]; newThreshold: number | null; nonce: number; newSignerCount: number; newThresholdValue: number }
  // Phase 23.2 (M4): circuit breaker events
  | { kind: "PoolPaused"; by: QubicIdentity; atEpoch: number }
  | { kind: "PoolUnpaused"; by: QubicIdentity; atEpoch: number };

// ---------- Phase 22: Governance types ----------

/** A pending treasury transfer waiting for signer approval. */
export interface PendingTreasuryTransfer {
  to: QubicIdentity;
  nonce: number;
  submittedAtEpoch: number;
  /** Map of signer identity -> approved. We use a Map (not array) so the
   *  index in the signer set doesn't matter for the approval lookup. */
  approvals: Map<QubicIdentity, boolean>;
  approvalCount: number;
}

/** A pending signer rotation. */
export interface PendingSignerChange {
  toAdd: QubicIdentity[];
  toRemove: QubicIdentity[]; // identities of signers being removed
  /** null = leave the threshold alone. */
  newThreshold: number | null;
  nonce: number;
  submittedAtEpoch: number;
  approvals: Map<QubicIdentity, boolean>;
  approvalCount: number;
}

export interface GovernanceState {
  initialized: boolean;
  signers: QubicIdentity[];
  threshold: number;
  treasuryWallet: QubicIdentity;
  hasPendingTreasuryTransfer: boolean;
  hasPendingSignerChange: boolean;
  pendingTreasuryTransfer: PendingTreasuryTransfer | null;
  pendingSignerChange: PendingSignerChange | null;
  /** Convenience: epoch at which any pending op will expire. */
  pendingOpExpiresAtEpoch: number | null;
  /**
   * Phase 23.2 (M4) — circuit breaker. When true, all mutation
   * procedures (stakeForAnn, extendLock, unlock, claimRewards,
   * setAnnSplits) reject with `PAUSED`. Read-only queries and the
   * event subscription are unaffected. Toggled by governance signers
   * via `pause` / `unpause`.
   */
  paused: boolean;
}

export const NO_THRESHOLD_CHANGE: number = 0;
export const PENDING_OP_TTL_EPOCHS: number = 4;

// ---------- Client interface ----------

/**
 * AigarthPoolClient is the public interface every service uses to
 * talk to the AigarthPool contract. The simulator and the real Qubic
 * RPC client both implement it. The choice is made at boot time via
 * `AIGARTHPOOL_MODE`.
 */
export interface AigarthPoolClient {
  /** Human-readable name of the backend, e.g. "simulator" or "qpi". */
  readonly mode: "simulator" | "qpi";

  // ---------- Procedures ----------

  /**
   * Lock `amount` QUBIC for `weeks` epochs, attributed to `annId`.
   * Returns the new position on success. Throws on validation
   * failure (amount=0, weeks out of range, ann not registered,
   * user at per-user cap).
   */
  stakeForAnn(user: QubicIdentity, annId: string, amount: bigint, weeks: number): Promise<Position>;

  /**
   * Add `additionalWeeks` to the existing lock for `(user, annId)`.
   * Total weeks must not exceed 52.
   */
  extendLock(user: QubicIdentity, annId: string, additionalWeeks: number): Promise<Position>;

  /**
   * Start the unlock for `(user, annId)`. The yield is split and
   * owed to creator/user/treasury; the principal + user share are
   * available via `claimRewards`.
   */
  unlock(user: QubicIdentity, annId: string): Promise<void>;

  /**
   * Claim the principal + user share of yield for a previously
   * unlocked position. Idempotent.
   */
  claimRewards(user: QubicIdentity, annId: string): Promise<{ principal: bigint; yield: bigint }>;

  /**
   * Set the splits for an ANN. Caller must be either the ANN's
   * creator OR a current governance signer (Phase 22 multi-sig
   * fallback). The simulator mirrors the contract's check; the
   * `viaGovernance` flag in the emitted event makes the source
   * auditable.
   */
  setAnnSplits(caller: QubicIdentity, annId: string, creatorBps: number, userBps: number, treasuryBps: number, creatorWallet: QubicIdentity): Promise<AnnSplits>;

  // ---------- Phase 22: Governance procedures ----------

  /**
   * Initialize the governance sub-state. Called once at deploy time.
   * Sets the multi-sig signer set, threshold, and treasury wallet
   * (defaults to the first signer).
   */
  initGovernance(initialSigners: QubicIdentity[], threshold: number): Promise<void>;

  /**
   * Submit a treasury wallet transfer. Any current signer may submit.
   * The op is queued until threshold signers approve, then anyone
   * can call execute. One pending transfer at a time.
   */
  submitTreasuryTransfer(caller: QubicIdentity, to: QubicIdentity, nonce: number): Promise<void>;

  /** Approve a pending treasury transfer. Idempotent. */
  approveTreasuryTransfer(caller: QubicIdentity, nonce: number): Promise<void>;

  /**
   * Execute a pending treasury transfer once threshold approvals are
   * met and the op hasn't expired.
   */
  executeTreasuryTransfer(nonce: number): Promise<void>;

  /**
   * Submit a signer rotation. The pending op is queued until
   * threshold signers approve.
   *
   * Pass `null` for newThreshold to leave it alone; pass
   * `NO_THRESHOLD_CHANGE` to the raw procedure explicitly if you
   * want a typed default.
   */
  submitSignerChange(
    caller: QubicIdentity,
    toAdd: QubicIdentity[],
    toRemove: QubicIdentity[],
    newThreshold: number | null,
    nonce: number,
  ): Promise<void>;

  /** Approve a pending signer change. Idempotent. */
  approveSignerChange(caller: QubicIdentity, nonce: number): Promise<void>;

  /** Execute a pending signer change once threshold approvals are met. */
  executeSignerChange(nonce: number): Promise<void>;

  // ---------- Phase 23.2 (M4): Circuit breaker ----------

  /**
   * Pause the pool. While paused, every mutation procedure (stake,
   * extend, unlock, claim, setAnnSplits) rejects with `PAUSED`.
   * Read-only queries and the event subscription are unaffected.
   * Governance-only: caller must be a current signer. Idempotent
   * (re-pausing while already paused is a no-op + event).
   */
  pause(caller: QubicIdentity): Promise<void>;

  /**
   * Resume the pool after a pause. Same authorization as `pause`.
   * Idempotent.
   */
  unpause(caller: QubicIdentity): Promise<void>;

  /**
   * Returns the current pause state. Cheaper than fetching the full
   * governance state.
   */
  isPaused(): Promise<boolean>;

  // ---------- Queries ----------

  getPosition(user: QubicIdentity, annId: string): Promise<Position | null>;
  getAnnSplits(annId: string): Promise<AnnSplits | null>;
  getYieldOwed(user: QubicIdentity, annId: string): Promise<YieldOwed | null>;
  getTotals(): Promise<Totals>;

  // ---------- Phase 22: Governance queries ----------

  /**
   * Return the full governance state — signers, threshold, treasury
   * wallet, and any pending ops. Used by the command centre and by
   * services that need to render the "approve" UI.
   */
  getGovernanceState(): Promise<GovernanceState>;

  // ---------- Events ----------

  /**
   * Subscribe to events. Returns an unsubscribe function. Used by
   * the watcher in services/qubic. The simulator pushes events
   * synchronously; the real client bridges to Qubic's event log.
   */
  subscribe(handler: (event: AigarthPoolEvent) => void): () => void;
}
