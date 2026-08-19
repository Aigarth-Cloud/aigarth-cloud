/**
 * Node escrow service — Phase 24.2.
 *
 * Double-entry ledger for the QUBIC held against a node reservation.
 * `debit` rows are payments in (user -> escrow). `credit` rows are
 * payments out (escrow -> user, on release/refund). The escrow's
 * running balance is `sum(debits) - sum(credits)` per reservation.
 *
 * The actual multisig hold is a stub in Phase 24. Phase 20.6 wires
 * the real QPI multisig; this table is the off-chain audit mirror
 * that the multisig will reconcile against.
 *
 * Idempotency: each ledger entry is keyed on its `tx_hash`. A second
 * call with the same hash returns the existing row, not a new one.
 *
 * What 24.2 does NOT do (deferred to later sub-stories):
 *   - 24.3 has the real price oracle (the rate is stored at entry time)
 *   - 24.4 has the Qearn lock wrapper (yield_credit entries will be
 *     written by that service on confirm; the escrow service just
 *     records the informational entry)
 *   - Phase 20.6 replaces the stub with the real QPI multisig
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db/index.js";
import {
  nodeEscrow,
  type NodeEscrow,
  type NodeEscrowDirection,
  type NodeEscrowPurpose,
} from "../db/schema.js";
import { logActivity } from "../lib/audit.js";

// ---------- Inputs ----------

export interface DebitEscrowInput {
  reservationId: string;
  userId: string;
  amountQubic: bigint;
  txHash: string;
  purpose: NodeEscrowPurpose;
  rateScaledAtEntry?: bigint | null;
  note?: string;
}

export interface CreditEscrowInput {
  reservationId: string;
  userId: string;
  amountQubic: bigint;
  txHash: string;
  purpose: NodeEscrowPurpose;
  rateScaledAtEntry?: bigint | null;
  yieldCreditRef?: string;
  note?: string;
}

export interface EscrowBalance {
  reservationId: string;
  totalDebitQubic: bigint;
  totalCreditQubic: bigint;
  /** Net balance held by the escrow for this reservation. */
  balanceQubic: bigint;
}

// ---------- Idempotency lookup ----------

async function getByTxHash(txHash: string): Promise<NodeEscrow | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(nodeEscrow)
    .where(eq(nodeEscrow.txHash, txHash))
    .limit(1);
  return rows[0] ?? null;
}

// ---------- Debit (user paid in) ----------

export async function debitEscrow(input: DebitEscrowInput): Promise<NodeEscrow> {
  if (input.amountQubic <= 0n) {
    throw new Error("Debit amount must be positive.");
  }
  if (input.purpose === "refund" || input.purpose === "penalty" || input.purpose === "yield_credit") {
    throw new Error(`Purpose '${input.purpose}' is a credit, not a debit.`);
  }
  const existing = await getByTxHash(input.txHash);
  if (existing) {
    if (existing.direction !== "debit") {
      throw new Error(
        `tx_hash ${input.txHash} already recorded as a '${existing.direction}' entry.`,
      );
    }
    return existing;
  }
  const db = getDb();
  const inserted = await db
    .insert(nodeEscrow)
    .values({
      reservationId: input.reservationId,
      userId: input.userId,
      direction: "debit",
      purpose: input.purpose,
      amountQubic: input.amountQubic,
      txHash: input.txHash,
      rateScaledAtEntry: input.rateScaledAtEntry ?? null,
      note: input.note ?? null,
    })
    .returning();
  logActivity(db, {
    action: "node_escrow.debited",
    actorUserId: input.userId,
    targetType: "node_escrow",
    targetId: inserted[0]!.id,
    metadata: {
      reservationId: input.reservationId,
      amountQubic: input.amountQubic.toString(),
      purpose: input.purpose,
      txHash: input.txHash,
    },
  });
  return inserted[0]!;
}

// ---------- Credit (escrow paid out) ----------

export async function creditEscrow(input: CreditEscrowInput): Promise<NodeEscrow> {
  if (input.amountQubic <= 0n) {
    throw new Error("Credit amount must be positive.");
  }
  if (
    input.purpose !== "refund" &&
    input.purpose !== "penalty" &&
    input.purpose !== "yield_credit"
  ) {
    throw new Error(`Purpose '${input.purpose}' is a debit, not a credit.`);
  }
  const existing = await getByTxHash(input.txHash);
  if (existing) {
    if (existing.direction !== "credit") {
      throw new Error(
        `tx_hash ${input.txHash} already recorded as a '${existing.direction}' entry.`,
      );
    }
    return existing;
  }
  const db = getDb();
  const inserted = await db
    .insert(nodeEscrow)
    .values({
      reservationId: input.reservationId,
      userId: input.userId,
      direction: "credit",
      purpose: input.purpose,
      amountQubic: input.amountQubic,
      txHash: input.txHash,
      rateScaledAtEntry: input.rateScaledAtEntry ?? null,
      yieldCreditRef: input.yieldCreditRef ?? null,
      note: input.note ?? null,
    })
    .returning();
  logActivity(db, {
    action: "node_escrow.credited",
    actorUserId: input.userId,
    targetType: "node_escrow",
    targetId: inserted[0]!.id,
    metadata: {
      reservationId: input.reservationId,
      amountQubic: input.amountQubic.toString(),
      purpose: input.purpose,
      txHash: input.txHash,
    },
  });
  return inserted[0]!;
}

// ---------- Read ----------

export async function getEscrowBalance(reservationId: string): Promise<EscrowBalance> {
  const db = getDb();
  const rows = await db
    .select({
      totalDebit: sql<string>`COALESCE(SUM(CASE WHEN ${nodeEscrow.direction} = 'debit' THEN ${nodeEscrow.amountQubic} ELSE 0 END), 0)::text`,
      totalCredit: sql<string>`COALESCE(SUM(CASE WHEN ${nodeEscrow.direction} = 'credit' THEN ${nodeEscrow.amountQubic} ELSE 0 END), 0)::text`,
    })
    .from(nodeEscrow)
    .where(eq(nodeEscrow.reservationId, reservationId));
  const totalDebit = BigInt(rows[0]?.totalDebit ?? "0");
  const totalCredit = BigInt(rows[0]?.totalCredit ?? "0");
  return {
    reservationId,
    totalDebitQubic: totalDebit,
    totalCreditQubic: totalCredit,
    balanceQubic: totalDebit - totalCredit,
  };
}

export async function listEscrowEntries(
  reservationId: string,
  options: { direction?: NodeEscrowDirection; limit?: number } = {},
): Promise<NodeEscrow[]> {
  const db = getDb();
  const conditions = [eq(nodeEscrow.reservationId, reservationId)];
  if (options.direction) conditions.push(eq(nodeEscrow.direction, options.direction));
  return db
    .select()
    .from(nodeEscrow)
    .where(and(...conditions))
    .orderBy(desc(nodeEscrow.createdAt))
    .limit(Math.min(options.limit ?? 50, 200));
}
