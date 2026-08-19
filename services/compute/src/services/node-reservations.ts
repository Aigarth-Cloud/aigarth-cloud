/**
 * Node reservation service — Phase 24 hardware presale.
 *
 * Lifecycle:
 *   pending_funding -> spot_held -> awaiting_confirm -> (confirmed | released)
 *
 * USD-anchored. The user pays X USD cents for the deposit and (later) Y
 * USD cents for the balance. The QUBIC amount for each charge is derived
 * from the latest row in `qubic_usd_rates` at the moment of the charge.
 *
 * The state machine is enforced server-side; the route layer cannot
 * trigger a transition that isn't allowed from the current status.
 *
 * Idempotency:
 *   - `txHashReserve` is unique. A second fund call with the same hash
 *     returns the existing reservation, not a new one.
 *   - `txHashConfirm` is unique. Same rule for the balance payment.
 *
 * What 24.1 does NOT do (deferred to later sub-stories):
 *   - 24.2: QUBIC escrow + multisig hold (the fund/confirm/refund flows
 *     call a local stub that records the intent; the real escrow service
 *     will be wired in 24.2 and the stub will be replaced.)
 *   - 24.3: USD price oracle worker (this service reads from
 *     `qubic_usd_rates`; if the table is empty, it falls back to a
 *     configured default for dev convenience.)
 *   - 24.4: Qearn yield opt-in (this service stores `yieldOptIn` and
 *     `yieldCreditQubic`; the actual lock + yield accrual is wired in
 *     24.4.)
 *
 * State machine diagram:
 *
 *   createNodeReservation (status=pending_funding)
 *            |
 *            |  user signs deposit tx on Qubic
 *            v
 *   fundNodeReservation (status=spot_held, depositQubic + rate recorded)
 *            |
 *            |  mainnet activates, operator runs openConfirmWindow
 *            v
 *   (status=awaiting_confirm, confirm window 14d)
 *            |
 *   +--------+----------------------+
 *   |                               |
 *   v                               v
 *   confirmNodeReservation         releaseNodeReservation
 *   (status=confirmed)             (status=released)
 */

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import {
  nodeReservations,
  qubicUsdRates,
  type NodeReservation,
  type NodeReservationStatus,
  type QubicUsdRate,
} from "../db/schema.js";
export type { NodeReservationStatus };
import { uid } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";
import { loadConfig } from "../config/index.js";
import { debitEscrow, creditEscrow, getEscrowBalance } from "./escrow.js";
import {
  lockDeposit,
  releaseLock,
  getCurrentYield,
} from "./qearn-lock.js";

// ---------- Tier config ----------

/**
 * Tier spec. The deposit and balance are USD cents (the user-facing
 * anchor). The QUBIC amounts are derived at charge time from the
 * `qubic_usd_rates` table. Tiers 2 and 3 are placeholders this phase;
 * the marketing layer rejects reservations for them.
 */
export interface NodeReservationTierSpec {
  tier: 1 | 2 | 3;
  /** USD cents, e.g. 3000 = $30.00 */
  depositUsdCents: bigint;
  /** USD cents, e.g. 56900 = $569.00 */
  balanceUsdCents: bigint;
  /** Display label, e.g. "Tier 1 — 100K QUBIC reference allocation". */
  label: string;
  /** Short marketing description. */
  description: string;
}

export const TIER_SPECS: Record<1 | 2 | 3, NodeReservationTierSpec> = {
  1: {
    tier: 1,
    depositUsdCents: 3000n,   // $30.00
    balanceUsdCents: 56900n,  // $569.00
    label: "Tier 1 — 100K QUBIC reference allocation",
    description: "Reserve a tier 1 compute spot. Full commitment $599, $30 deposit.",
  },
  2: {
    tier: 2,
    depositUsdCents: 5000n,   // $50.00
    balanceUsdCents: 84900n,  // $849.00
    label: "Tier 2 — 250K QUBIC high-throughput allocation",
    description: "Reserve a tier 2 compute spot. Full commitment $899, $50 deposit.",
  },
  3: {
    tier: 3,
    depositUsdCents: 7500n,   // $75.00
    balanceUsdCents: 122400n, // $1,224.00
    label: "Tier 3 — 500K QUBIC top allocation + governance",
    description: "Reserve a tier 3 compute spot. Full commitment $1,299, $75 deposit.",
  },
};

export const TIERS_OPEN_FOR_RESERVATION: ReadonlyArray<1 | 2 | 3> = [1];

// ---------- Zod input schemas ----------

/** USD cents, as a string to avoid JS number precision loss. */
const usdCents = z
  .union([z.string().regex(/^\d+$/), z.number().int().min(0)])
  .transform((v) => BigInt(v));

/** QUBIC amount (smallest unit), as a string of digits. */
const qubicAmount = z.string().regex(/^\d+$/, "must be a positive integer string");

/** Rate in scaled form (USD per 1 QUBIC, scaled to 10 decimals). */
const rateScaled = z.string().regex(/^\d+$/, "must be a positive integer string");

export const CreateNodeReservationSchema = z.object({
  tier: z
    .number()
    .int()
    .refine((n) => n === 1 || n === 2 || n === 3, "tier must be 1, 2, or 3"),
  yieldOptIn: z.boolean().optional().default(false),
});
export type CreateNodeReservationInput = z.infer<typeof CreateNodeReservationSchema>;

export const FundNodeReservationSchema = z.object({
  txHashReserve: z.string().min(20).max(120),
  depositQubic: qubicAmount,
  qubicUsdRateScaled: rateScaled,
});
export type FundNodeReservationInput = z.infer<typeof FundNodeReservationSchema>;

export const ConfirmNodeReservationSchema = z.object({
  txHashConfirm: z.string().min(20).max(120),
  balanceQubic: qubicAmount,
  qubicUsdRateScaled: rateScaled,
  yieldCreditQubic: qubicAmount.optional().default("0"),
});
export type ConfirmNodeReservationInput = z.infer<typeof ConfirmNodeReservationSchema>;

export const ReleaseNodeReservationSchema = z.object({
  /** Optional override rate; if omitted, uses the latest from the oracle. */
  qubicUsdRateScaled: rateScaled.optional(),
});
export type ReleaseNodeReservationInput = z.infer<typeof ReleaseNodeReservationSchema>;

// ---------- Price oracle ----------

/** Maximum age (ms) of a QUBIC/USD rate before we refuse to charge. */
const RATE_MAX_AGE_MS = 5 * 60 * 1000;

export interface PriceQuote {
  rate: QubicUsdRate;
  /** USD per 1 QUBIC as a float (for display only). */
  rateUsdPerQubic: number;
}

/**
 * Returns the latest QUBIC/USD rate. Throws if the most recent rate is
 * older than RATE_MAX_AGE_MS. Falls back to a configured default in dev
 * when the table is empty (this is the only place we tolerate stale
 * data; the actual `qubic_usd_rates` table can be empty at boot).
 */
export async function getCurrentQubicUsdRate(): Promise<PriceQuote> {
  const db = getDb();
  const cfg = loadConfig();
  const rows = await db
    .select()
    .from(qubicUsdRates)
    .orderBy(desc(qubicUsdRates.fetchedAt))
    .limit(1);
  const r = rows[0];
  if (!r) {
    if (cfg.NODE_ENV === "development" && cfg.QUBIC_USD_FALLBACK_RATE_SCALED) {
      const fallback = BigInt(cfg.QUBIC_USD_FALLBACK_RATE_SCALED);
      return {
        rate: {
          id: "fallback",
          rateScaled: fallback,
          source: "fallback",
          rateRaw: (Number(fallback) / 1e10).toString(),
          fetchedAt: new Date(),
        },
        rateUsdPerQubic: Number(fallback) / 1e10,
      };
    }
    throw new Error("No QUBIC/USD rate available — price oracle has not yet recorded a row.");
  }
  const ageMs = Date.now() - r.fetchedAt.getTime();
  if (ageMs > RATE_MAX_AGE_MS) {
    throw new Error(
      `QUBIC/USD rate is stale (${Math.round(ageMs / 1000)}s old, max ${RATE_MAX_AGE_MS / 1000}s). Refusing to charge.`,
    );
  }
  return {
    rate: r,
    rateUsdPerQubic: Number(r.rateScaled) / 1e10,
  };
}

/**
 * Convert a USD-cents amount to a QUBIC amount at the given rate.
 *
 * Rate convention:
 *   rateScaled = round(rateUsdPerQubic * 10^10)
 *   e.g. 0.0000004450 USD/QUBIC -> rateScaled = 4450
 *
 * Math:
 *   QUBIC = (usdCents / 100) / rateUsdPerQubic
 *         = (usdCents / 100) / (rateScaled / 10^10)
 *         = usdCents * 10^10 / (100 * rateScaled)
 *         = usdCents * 10^8 / rateScaled
 *
 * Rounded down (the user pays at least the USD value, never less).
 */
export function usdCentsToQubic(usdCents: bigint, rateScaled: bigint): bigint {
  if (rateScaled <= 0n) throw new Error("Rate must be positive");
  return (usdCents * 10n ** 8n) / rateScaled;
}

// ---------- Auto-cancel helper ----------

const PENDING_FUNDING_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * If a `pending_funding` row is older than 24h, cancel it (move to
 * `released` with no payment, no penalty). Called by every read path.
 */
async function autoCancelStalePending(rows: NodeReservation[]): Promise<boolean> {
  const now = Date.now();
  const staleIds = rows
    .filter(
      (r) =>
        r.status === "pending_funding" &&
        now - r.createdAt.getTime() > PENDING_FUNDING_TTL_MS,
    )
    .map((r) => r.id);
  if (staleIds.length === 0) return false;
  const db = getDb();
  await db
    .update(nodeReservations)
    .set({
      status: "released",
      releasedAt: new Date(),
      autoReleasedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(inArray(nodeReservations.id, staleIds));
  for (const id of staleIds) {
    logActivity(db, {
      action: "node_reservation.auto_released",
      targetType: "node_reservation",
      targetId: id,
      metadata: { reason: "pending_funding_ttl_exceeded" },
    });
  }
  return true;
}

// ---------- Create ----------

export interface CreateNodeReservationResult {
  reservation: NodeReservation;
  /** Tier spec echoed back so the client can render the deposit details. */
  tierSpec: NodeReservationTierSpec;
  /** Current rate, so the client can show the USD value of the deposit. */
  rate: PriceQuote;
  /** Computed QUBIC amount for the deposit at the current rate. */
  expectedDepositQubic: string;
}

export async function createNodeReservation(
  userId: string,
  input: CreateNodeReservationInput,
): Promise<CreateNodeReservationResult> {
  if (!TIERS_OPEN_FOR_RESERVATION.includes(input.tier as 1 | 2 | 3)) {
    throw new Error(`Tier ${input.tier} is not open for reservation this phase.`);
  }
  const tierSpec = TIER_SPECS[input.tier as 1 | 2 | 3];
  const rate = await getCurrentQubicUsdRate();
  const expectedDepositQubic = usdCentsToQubic(
    tierSpec.depositUsdCents,
    rate.rate.rateScaled,
  );
  const id = uid();
  const db = getDb();
  const inserted = await db
    .insert(nodeReservations)
    .values({
      id,
      userId,
      tier: input.tier,
      status: "pending_funding",
      depositUsdCents: tierSpec.depositUsdCents,
      balanceUsdCents: tierSpec.balanceUsdCents,
      yieldOptIn: input.yieldOptIn,
      qubicWalletId: null,
    })
    .returning();
  logActivity(db, {
    action: "node_reservation.created",
    actorUserId: userId,
    targetType: "node_reservation",
    targetId: id,
    metadata: {
      tier: input.tier,
      depositUsdCents: tierSpec.depositUsdCents.toString(),
      yieldOptIn: input.yieldOptIn,
    },
  });
  return {
    reservation: inserted[0]!,
    tierSpec,
    rate,
    expectedDepositQubic: expectedDepositQubic.toString(),
  };
}

// ---------- Fund (deposit) ----------

export async function fundNodeReservation(
  userId: string,
  reservationId: string,
  input: FundNodeReservationInput,
): Promise<NodeReservation> {
  const db = getDb();
  const rows = await db
    .select()
    .from(nodeReservations)
    .where(
      and(
        eq(nodeReservations.id, reservationId),
        eq(nodeReservations.userId, userId),
      ),
    )
    .limit(1);
  const r = rows[0];
  if (!r) throw new Error("Node reservation not found.");
  await autoCancelStalePending([r]);
  if (r.status !== "pending_funding") {
    throw new Error(
      `Node reservation is in status '${r.status}', cannot fund. Expected 'pending_funding'.`,
    );
  }
  // Idempotency: if the same tx_hash has already been recorded on a
  // different reservation, the unique index will reject this insert.
  // If it's already on this reservation, we no-op.
  if (r.txHashReserve === input.txHashReserve) {
    return r;
  }
  const rateScaled = BigInt(input.qubicUsdRateScaled);
  if (rateScaled <= 0n) throw new Error("Rate must be positive.");
  const depositQubic = BigInt(input.depositQubic);
  // Record the deposit debit in the escrow ledger. Idempotent on tx_hash.
  await debitEscrow({
    reservationId,
    userId,
    amountQubic: depositQubic,
    txHash: input.txHashReserve,
    purpose: "deposit",
    rateScaledAtEntry: rateScaled,
    note: "Hardware presale deposit (Phase 24)",
  });
  const updated = await db
    .update(nodeReservations)
    .set({
      status: "spot_held",
      depositQubic,
      qubicUsdRateAtReserve: rateScaled,
      txHashReserve: input.txHashReserve,
      updatedAt: new Date(),
    })
    .where(eq(nodeReservations.id, reservationId))
    .returning();
  logActivity(db, {
    action: "node_reservation.funded",
    actorUserId: userId,
    targetType: "node_reservation",
    targetId: reservationId,
    metadata: {
      depositQubic: depositQubic.toString(),
      txHashReserve: input.txHashReserve,
      rateScaled: rateScaled.toString(),
    },
  });
  // If yield opt-in, create the Qearn lock for the deposit. Phase 24
  // uses a linear-accrual stub; Phase 25+ wires the real Qearn lock.
  if (r.yieldOptIn) {
    try {
      await lockDeposit({
        reservationId,
        userId,
        principalQubic: depositQubic,
        apyBps: 500, // 5% APY default
      });
      await db
        .update(nodeReservations)
        .set({ qearnLockId: `local:${reservationId}` })
        .where(eq(nodeReservations.id, reservationId));
    } catch (e) {
      // Graceful degradation: log the failure but don't fail the fund.
      // The reservation is held; yield_opt_in is effectively false.
      logActivity(db, {
        action: "node_yield_lock.created_failed",
        targetType: "node_reservation",
        targetId: reservationId,
        metadata: {
          error: e instanceof Error ? e.message : String(e),
        },
      });
      await db
        .update(nodeReservations)
        .set({ yieldOptIn: false })
        .where(eq(nodeReservations.id, reservationId));
    }
  }
  return updated[0]!;
}

// ---------- Open confirm window ----------

/**
 * Internal: opens the 14-day confirm window. Called by the system when
 * mainnet activates (manual via the operator script in Phase 24, auto
 * by a worker in a later phase). The route layer exposes this as a
 * privileged endpoint (JWT + service role).
 */
export async function openConfirmWindow(reservationId: string): Promise<NodeReservation> {
  const db = getDb();
  const rows = await db
    .select()
    .from(nodeReservations)
    .where(eq(nodeReservations.id, reservationId))
    .limit(1);
  const r = rows[0];
  if (!r) throw new Error("Node reservation not found.");
  if (r.status !== "spot_held") {
    throw new Error(
      `Node reservation is in status '${r.status}', cannot open confirm window. Expected 'spot_held'.`,
    );
  }
  const opensAt = new Date();
  const closesAt = new Date(opensAt.getTime() + 14 * 24 * 60 * 60 * 1000);
  const updated = await db
    .update(nodeReservations)
    .set({
      status: "awaiting_confirm",
      confirmWindowOpensAt: opensAt,
      confirmWindowClosesAt: closesAt,
      updatedAt: new Date(),
    })
    .where(eq(nodeReservations.id, reservationId))
    .returning();
  logActivity(db, {
    action: "node_reservation.confirm_window_opened",
    targetType: "node_reservation",
    targetId: reservationId,
    metadata: {
      confirmWindowOpensAt: opensAt.toISOString(),
      confirmWindowClosesAt: closesAt.toISOString(),
    },
  });
  return updated[0]!;
}

// ---------- Confirm (balance) ----------

export interface ConfirmNodeReservationResult {
  reservation: NodeReservation;
  balanceQubic: bigint;
  yieldCreditQubic: bigint;
  netBalanceQubic: bigint;
}

export async function confirmNodeReservation(
  userId: string,
  reservationId: string,
  input: ConfirmNodeReservationInput,
): Promise<ConfirmNodeReservationResult> {
  const db = getDb();
  const rows = await db
    .select()
    .from(nodeReservations)
    .where(
      and(
        eq(nodeReservations.id, reservationId),
        eq(nodeReservations.userId, userId),
      ),
    )
    .limit(1);
  const r = rows[0];
  if (!r) throw new Error("Node reservation not found.");
  if (r.status !== "awaiting_confirm") {
    throw new Error(
      `Node reservation is in status '${r.status}', cannot confirm. Expected 'awaiting_confirm'.`,
    );
  }
  if (r.confirmWindowClosesAt && r.confirmWindowClosesAt.getTime() < Date.now()) {
    throw new Error("Confirm window has closed. Auto-release will fire shortly.");
  }
  // If yield opt-in, capture the accrued yield from the Qearn lock.
  // The default 0 is the fallback when the user did not opt in.
  let yieldCreditQubic: bigint;
  if (r.yieldOptIn) {
    try {
      yieldCreditQubic = await releaseLock(reservationId);
    } catch (e) {
      // Yield release failure: log and continue with 0.
      logActivity(db, {
        action: "node_yield_lock.release_failed",
        targetType: "node_reservation",
        targetId: reservationId,
        metadata: { error: e instanceof Error ? e.message : String(e) },
      });
      yieldCreditQubic = 0n;
    }
  } else {
    yieldCreditQubic = 0n;
  }
  // Allow the caller to override (e.g. for tests or backfill), but
  // prefer the freshly-computed value.
  if (input.yieldCreditQubic && input.yieldCreditQubic !== "0") {
    yieldCreditQubic = BigInt(input.yieldCreditQubic);
  }
  if (r.txHashConfirm === input.txHashConfirm) {
    // Idempotent: already confirmed with this tx hash.
    return {
      reservation: r,
      balanceQubic: BigInt(input.balanceQubic),
      yieldCreditQubic: r.yieldCreditQubic,
      netBalanceQubic: BigInt(input.balanceQubic) - r.yieldCreditQubic,
    };
  }
  const balanceQubic = BigInt(input.balanceQubic);
  const netBalanceQubic = balanceQubic - yieldCreditQubic;
  const rateScaled = BigInt(input.qubicUsdRateScaled);
  if (rateScaled <= 0n) throw new Error("Rate must be positive.");
  if (yieldCreditQubic > balanceQubic) {
    throw new Error("Yield credit exceeds the balance — investigate.");
  }
  // Record the balance debit in the escrow ledger. Idempotent on tx_hash.
  await debitEscrow({
    reservationId,
    userId,
    amountQubic: balanceQubic,
    txHash: input.txHashConfirm,
    purpose: "balance",
    rateScaledAtEntry: rateScaled,
    note: "Hardware presale balance (Phase 24)",
  });
  // If yield credit > 0, record it as an informational credit (not a
  // fund movement — the user never received this; it's a Qearn payout
  // that offsets the balance). Single composite tx_hash with a
  // `:yield` suffix keeps idempotency simple.
  if (yieldCreditQubic > 0n) {
    await creditEscrow({
      reservationId,
      userId,
      amountQubic: yieldCreditQubic,
      txHash: `${input.txHashConfirm}:yield`,
      purpose: "yield_credit",
      rateScaledAtEntry: rateScaled,
      note: "Qearn yield offset on confirm (Phase 24.4 wires the real lock)",
    });
  }
  const updated = await db
    .update(nodeReservations)
    .set({
      status: "confirmed",
      balanceQubic,
      qubicUsdRateAtConfirm: rateScaled,
      yieldCreditQubic,
      txHashConfirm: input.txHashConfirm,
      updatedAt: new Date(),
    })
    .where(eq(nodeReservations.id, reservationId))
    .returning();
  logActivity(db, {
    action: "node_reservation.confirmed",
    actorUserId: userId,
    targetType: "node_reservation",
    targetId: reservationId,
    metadata: {
      balanceQubic: balanceQubic.toString(),
      yieldCreditQubic: yieldCreditQubic.toString(),
      netBalanceQubic: netBalanceQubic.toString(),
      txHashConfirm: input.txHashConfirm,
    },
  });
  return {
    reservation: updated[0]!,
    balanceQubic,
    yieldCreditQubic,
    netBalanceQubic,
  };
}

// ---------- Release ----------

export interface ReleaseNodeReservationResult {
  reservation: NodeReservation;
  /** QUBIC returned to the user. For pre-confirm releases this is the full deposit; for post-confirm it's the balance minus penalty. */
  refundQubic: bigint;
  /** Penalty burned (0 for pre-confirm release; configurable for post-confirm). */
  penaltyQubic: bigint;
  /** True if this was triggered by the auto-release (window closed), not the user. */
  autoReleased: boolean;
}

const POST_CONFIRM_PENALTY_BPS = 500; // 5% of the deposit, matching existing releaseReservation

export async function releaseNodeReservation(
  userId: string,
  reservationId: string,
  input: ReleaseNodeReservationInput = {},
): Promise<ReleaseNodeReservationResult> {
  const db = getDb();
  const rows = await db
    .select()
    .from(nodeReservations)
    .where(
      and(
        eq(nodeReservations.id, reservationId),
        eq(nodeReservations.userId, userId),
      ),
    )
    .limit(1);
  const r = rows[0];
  if (!r) throw new Error("Node reservation not found.");
  if (
    r.status !== "spot_held" &&
    r.status !== "awaiting_confirm" &&
    r.status !== "pending_funding"
  ) {
    throw new Error(
      `Node reservation is in status '${r.status}', cannot release.`,
    );
  }
  // Compute refund in QUBIC.
  let refundQubic: bigint;
  let penaltyQubic = 0n;
  if (r.status === "pending_funding") {
    // Nothing was paid. Nothing to refund.
    refundQubic = 0n;
  } else if (r.status === "spot_held" || r.status === "awaiting_confirm") {
    // Full refund of the deposit, computed at the rate at release time
    // (or the override rate if provided).
    const rateScaled = input.qubicUsdRateScaled
      ? BigInt(input.qubicUsdRateScaled)
      : r.qubicUsdRateAtReserve;
    if (!rateScaled || rateScaled <= 0n) {
      throw new Error("No rate available for refund calculation.");
    }
    refundQubic = usdCentsToQubic(r.depositUsdCents, rateScaled);
  } else {
    // confirmed — post-confirm release with 5% penalty on the deposit.
    const rateScaled = input.qubicUsdRateScaled
      ? BigInt(input.qubicUsdRateScaled)
      : r.qubicUsdRateAtConfirm;
    if (!rateScaled || rateScaled <= 0n) {
      throw new Error("No rate available for refund calculation.");
    }
    const depositRefund = usdCentsToQubic(r.depositUsdCents, rateScaled);
    penaltyQubic = (depositRefund * BigInt(POST_CONFIRM_PENALTY_BPS)) / 10_000n;
    refundQubic = depositRefund - penaltyQubic;
  }
  // Build a synthetic tx_hash for the refund/penalty (real refunds
  // eventually have their own on-chain tx; for Phase 24 this records
  // the off-chain intent). The `:refund` and `:penalty` suffixes
  // keep each entry idempotent.
  const refundTxHash = `refund:${r.id}:${Date.now()}`;
  // Record the refund credit in the escrow ledger. Idempotent on tx_hash.
  if (refundQubic > 0n) {
    await creditEscrow({
      reservationId,
      userId,
      amountQubic: refundQubic,
      txHash: refundTxHash,
      purpose: "refund",
      rateScaledAtEntry:
        input.qubicUsdRateScaled
          ? BigInt(input.qubicUsdRateScaled)
          : r.qubicUsdRateAtReserve ?? null,
      note: "Hardware presale refund on release (Phase 24)",
    });
  }
  // If there's a penalty (post-confirm release), record it as a credit
  // for the audit trail. The actual QUBIC burn happens at the multisig
  // layer when Phase 20.6 lands.
  if (penaltyQubic > 0n) {
    const penaltyTxHash = `penalty:${r.id}:${Date.now()}`;
    await creditEscrow({
      reservationId,
      userId,
      amountQubic: penaltyQubic,
      txHash: penaltyTxHash,
      purpose: "penalty",
      rateScaledAtEntry:
        input.qubicUsdRateScaled
          ? BigInt(input.qubicUsdRateScaled)
          : r.qubicUsdRateAtConfirm ?? null,
      note: "Post-confirm release penalty (Phase 24, 5% of deposit)",
    });
  }
  const updated = await db
    .update(nodeReservations)
    .set({
      status: "released",
      releasedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(nodeReservations.id, reservationId))
    .returning();
  logActivity(db, {
    action: "node_reservation.released",
    actorUserId: userId,
    targetType: "node_reservation",
    targetId: reservationId,
    metadata: {
      priorStatus: r.status,
      refundQubic: refundQubic.toString(),
      penaltyQubic: penaltyQubic.toString(),
    },
  });
  return {
    reservation: updated[0]!,
    refundQubic,
    penaltyQubic,
    autoReleased: false,
  };
}

/**
 * Internal: auto-release any reservations whose confirm window has
 * closed. Called by the operator script in Phase 24; will be a
 * scheduled worker in a later phase.
 */
export async function autoReleaseExpiredConfirmWindows(): Promise<number> {
  const db = getDb();
  const now = new Date();
  const rows = await db
    .select()
    .from(nodeReservations)
    .where(eq(nodeReservations.status, "awaiting_confirm"));
  const expiredIds = rows
    .filter((r) => r.confirmWindowClosesAt && r.confirmWindowClosesAt <= now)
    .map((r) => r.id);
  if (expiredIds.length === 0) return 0;
  for (const id of expiredIds) {
    await db
      .update(nodeReservations)
      .set({
        status: "released",
        autoReleasedAt: now,
        releasedAt: now,
        updatedAt: now,
      })
      .where(eq(nodeReservations.id, id));
    logActivity(db, {
      action: "node_reservation.auto_released",
      targetType: "node_reservation",
      targetId: id,
      metadata: { reason: "confirm_window_closed" },
    });
  }
  return expiredIds.length;
}

// ---------- Read ----------

export async function listNodeReservations(
  userId: string,
  options: { status?: NodeReservationStatus; limit?: number } = {},
): Promise<NodeReservation[]> {
  const db = getDb();
  const conditions = [eq(nodeReservations.userId, userId)];
  if (options.status) conditions.push(eq(nodeReservations.status, options.status));
  const rows = await db
    .select()
    .from(nodeReservations)
    .where(and(...conditions))
    .orderBy(desc(nodeReservations.createdAt))
    .limit(Math.min(options.limit ?? 50, 200));
  await autoCancelStalePending(rows);
  // Re-read after auto-cancel so callers see the updated status.
  const refreshed = await db
    .select()
    .from(nodeReservations)
    .where(and(...conditions))
    .orderBy(desc(nodeReservations.createdAt))
    .limit(Math.min(options.limit ?? 50, 200));
  return refreshed;
}

export async function getNodeReservation(
  userId: string,
  id: string,
): Promise<NodeReservation | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(nodeReservations)
    .where(and(eq(nodeReservations.id, id), eq(nodeReservations.userId, userId)))
    .limit(1);
  const r = rows[0] ?? null;
  if (r) await autoCancelStalePending([r]);
  return r;
}

// ---------- Price oracle writer ----------
// (Used by the usd-price-oracle worker in 24.3; the function lives here
// so the service is the single source of truth for the schema.)

export interface RecordRateInput {
  rateScaled: bigint;
  source: string;
  rateRaw: string;
}

export async function recordQubicUsdRate(input: RecordRateInput): Promise<QubicUsdRate> {
  const db = getDb();
  const id = uid();
  const inserted = await db
    .insert(qubicUsdRates)
    .values({
      id,
      rateScaled: input.rateScaled,
      source: input.source,
      rateRaw: input.rateRaw,
    })
    .returning();
  logActivity(db, {
    action: "qubic_usd_rate.recorded",
    targetType: "qubic_usd_rate",
    targetId: id,
    metadata: {
      rateScaled: input.rateScaled.toString(),
      source: input.source,
    },
  });
  return inserted[0]!;
}

// Re-export sql for convenience
export { sql };
