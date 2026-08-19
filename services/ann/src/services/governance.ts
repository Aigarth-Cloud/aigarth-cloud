/**
 * AigarthPool governance service — Phase 22.
 *
 * Thin service-layer wrapper around the governance procedures on
 * the AigarthPool client. The HTTP layer in routes/governance.ts
 * talks to this; the AigarthPool client is the canonical state
 * machine (in simulator mode) or the Qubic RPC backend (in qpi mode,
 * hardware-gated).
 *
 * The flow is the standard multi-sig approval pattern:
 *   1. A current signer submits a change (treasury transfer or
 *      signer rotation) with a caller-chosen nonce.
 *   2. Other signers call `approve*` to record their approval.
 *   3. Once the threshold is met, anyone can call `execute*` to
 *      apply the change.
 *
 * Pending ops expire after PENDING_OP_TTL_EPOCHS (4 weeks).
 */

import { getAigarthPool } from "./aigarthpool.js";
import type { GovernanceState, QubicIdentity } from "@aigarth/aigarthpool";

/**
 * Initialize governance. Called once at deploy time.
 */
export async function initGovernance(
  initialSigners: QubicIdentity[],
  threshold: number,
): Promise<void> {
  const pool = getAigarthPool();
  await pool.initGovernance(initialSigners, threshold);
}

/**
 * Submit a treasury transfer. The op is queued until threshold
 * signers approve. One pending transfer at a time.
 */
export async function submitTreasuryTransfer(
  caller: QubicIdentity,
  to: QubicIdentity,
  nonce: number,
): Promise<void> {
  const pool = getAigarthPool();
  await pool.submitTreasuryTransfer(caller, to, nonce);
}

/** Approve a pending treasury transfer. Idempotent. */
export async function approveTreasuryTransfer(
  caller: QubicIdentity,
  nonce: number,
): Promise<void> {
  const pool = getAigarthPool();
  await pool.approveTreasuryTransfer(caller, nonce);
}

/** Execute a pending treasury transfer once threshold approvals are met. */
export async function executeTreasuryTransfer(nonce: number): Promise<void> {
  const pool = getAigarthPool();
  await pool.executeTreasuryTransfer(nonce);
}

/**
 * Submit a signer rotation. The pending op is queued until
 * threshold signers approve. Pass `null` for newThreshold to leave
 * it alone.
 */
export async function submitSignerChange(
  caller: QubicIdentity,
  toAdd: QubicIdentity[],
  toRemove: QubicIdentity[],
  newThreshold: number | null,
  nonce: number,
): Promise<void> {
  const pool = getAigarthPool();
  await pool.submitSignerChange(caller, toAdd, toRemove, newThreshold, nonce);
}

/** Approve a pending signer change. Idempotent. */
export async function approveSignerChange(
  caller: QubicIdentity,
  nonce: number,
): Promise<void> {
  const pool = getAigarthPool();
  await pool.approveSignerChange(caller, nonce);
}

/** Execute a pending signer change once threshold approvals are met. */
export async function executeSignerChange(nonce: number): Promise<void> {
  const pool = getAigarthPool();
  await pool.executeSignerChange(nonce);
}

/** Read the full governance state. */
export async function getGovernanceState(): Promise<GovernanceState> {
  const pool = getAigarthPool();
  return pool.getGovernanceState();
}

/**
 * Phase 23.2 (M4) — pause the pool. The AigarthPool client
 * enforces governance-only authorization; the route layer
 * additionally requires JWT. Idempotent.
 */
export async function pausePool(caller: QubicIdentity): Promise<void> {
  const pool = getAigarthPool();
  await pool.pause(caller);
}

/** Phase 23.2 (M4) — unpause the pool. Idempotent. */
export async function unpausePool(caller: QubicIdentity): Promise<void> {
  const pool = getAigarthPool();
  await pool.unpause(caller);
}

/** Phase 23.2 (M4) — read pause state. */
export async function isPaused(): Promise<boolean> {
  const pool = getAigarthPool();
  return pool.isPaused();
}
