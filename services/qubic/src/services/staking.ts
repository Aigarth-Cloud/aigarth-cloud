/**
 * Staking service.
 *
 * Flow:
 *   1. User calls createStakeIntent() → server builds the intent (unsigned),
 *      returns it for the user's wallet to sign.
 *   2. User signs the intent with their Qubic private key.
 *   3. User calls submitStake() with the signed intent.
 *   4. Server broadcasts via the Qubic client.
 *   5. Transaction monitor (worker) picks up confirmations, flips the
 *      stake status to `active`, and starts accruing rewards.
 *
 * The signing step happens client-side; the server never sees the
 * user's Qubic private key. The server does, however, own the
 * treasury's private key for fee collection + reward payouts.
 */

import { eq, and, sql, desc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import {
  stakes,
  qubicWallets,
  qubicBalances,
  transactions,
  type Stake,
  type StakeStatus,
} from "../db/schema.js";
import { uid } from "../lib/ids.js";
import { getQubicClient } from "../client/index.js";
import { logActivity } from "../lib/audit.js";

// ---------- Schemas ----------

export const CreateStakeIntentSchema = z.object({
  walletId: z.string().uuid(),
  /** The validator address to stake TO. (Qubic stakes go to a specific computor.) */
  receiver: z.string().regex(/^[A-Z]{60}$/),
  /** Amount in QUBIC. */
  amountQubic: z.string().regex(/^\d+$/), // bigint as string
  /** Number of epochs to lock for. */
  epochsLocked: z.number().int().min(1).max(52).default(1),
});

export const SubmitStakeSchema = z.object({
  intentHash: z.string().min(16).max(256),
  signature: z.string().min(16).max(2048),
});

// ---------- Create unsigned intent ----------

export interface StakeIntentDraft {
  intentHash: string;
  staker: string;
  receiver: string;
  amountQubic: bigint;
  epochsLocked: number;
  startEpoch: number;
  tickNumber: number;
  /** Canonical message the user must sign. */
  message: string;
}

export async function createStakeIntent(
  userId: string,
  input: z.infer<typeof CreateStakeIntentSchema>,
): Promise<{ intent: StakeIntentDraft; stake: Stake }> {
  const db = getDb();

  // Verify wallet belongs to user and is authorized
  const walletRows = await db
    .select()
    .from(qubicWallets)
    .where(and(eq(qubicWallets.id, input.walletId), eq(qubicWallets.userId, userId)))
    .limit(1);
  const wallet = walletRows[0];
  if (!wallet) throw new Error("Wallet not found.");
  if (!wallet.stakeAuthorized) {
    throw new Error("Wallet is not authorized for staking. Complete the on-chain auth first.");
  }
  if (wallet.stakeAuthorizationExpiresAt && wallet.stakeAuthorizationExpiresAt < new Date()) {
    throw new Error("Stake authorization has expired.");
  }

  // Get current tick + epoch
  const client = getQubicClient();
  const tick = await client.getCurrentTick();

  const amount = BigInt(input.amountQubic);
  if (amount <= 0n) throw new Error("Amount must be positive.");

  // Verify balance
  const balRows = await db
    .select()
    .from(qubicBalances)
    .where(eq(qubicBalances.walletId, wallet.id))
    .limit(1);
  const balance = balRows[0];
  if (balance && balance.balanceQubic < amount) {
    throw new Error(`Insufficient balance. Have ${balance.balanceQubic}, need ${amount}.`);
  }

  // Create the intent draft
  const intentId = uid();
  const message = `Aigarth stake\nstaker: ${wallet.qubicAddress}\nreceiver: ${input.receiver}\namount: ${amount}\nepochs: ${input.epochsLocked}\nstartEpoch: ${tick.epoch + 1}\ntick: ${tick.tickNumber}`;
  const intentHash = await sha256Hex(message);

  // Store the stake as pending_signature
  const stakeId = uid();
  await db.insert(stakes).values({
    id: stakeId,
    userId,
    walletId: wallet.id,
    principalQubic: amount,
    receiverAddress: input.receiver,
    startEpoch: tick.epoch + 1,
    epochsLocked: input.epochsLocked,
    status: "pending_signature",
    signedTick: tick.tickNumber,
    intentHash,
  });

  logActivity(db, {
    action: "stake.intent_created",
    actorUserId: userId,
    orgId: null,
    targetType: "stake",
    targetId: stakeId,
    metadata: {
      amount: amount.toString(),
      receiver: input.receiver,
      epochs: input.epochsLocked,
    },
  });

  return {
    intent: {
      intentHash,
      staker: wallet.qubicAddress,
      receiver: input.receiver,
      amountQubic: amount,
      epochsLocked: input.epochsLocked,
      startEpoch: tick.epoch + 1,
      tickNumber: tick.tickNumber,
      message,
    },
    stake: (await db.select().from(stakes).where(eq(stakes.id, stakeId)).limit(1))[0]!,
  };
}

// ---------- Submit signed intent ----------

export async function submitStake(
  userId: string,
  stakeId: string,
  input: z.infer<typeof SubmitStakeSchema>,
): Promise<{ stake: Stake; txHash: string }> {
  const db = getDb();
  const stakeRows = await db
    .select()
    .from(stakes)
    .where(and(eq(stakes.id, stakeId), eq(stakes.userId, userId)))
    .limit(1);
  const stake = stakeRows[0];
  if (!stake) throw new Error("Stake not found.");
  if (stake.status !== "pending_signature") {
    throw new Error(`Stake is in status '${stake.status}', cannot submit.`);
  }
  if (stake.intentHash !== input.intentHash) {
    throw new Error("Intent hash does not match. Re-create the intent.");
  }

  const walletRows = await db
    .select()
    .from(qubicWallets)
    .where(eq(qubicWallets.id, stake.walletId))
    .limit(1);
  const wallet = walletRows[0];
  if (!wallet) throw new Error("Wallet disappeared.");

  // Broadcast
  const client = getQubicClient();
  const result = await client.broadcastStake({
    staker: wallet.qubicAddress,
    receiver: stake.receiverAddress,
    amountQubic: stake.principalQubic,
    epochsLocked: stake.epochsLocked,
    startEpoch: stake.startEpoch,
    tickNumber: stake.signedTick ?? 0,
    signature: input.signature,
  });

  // Update stake + record transaction
  await db
    .update(stakes)
    .set({
      status: "broadcast",
      txHash: result.txHash,
      updatedAt: new Date(),
    })
    .where(eq(stakes.id, stakeId));

  await db.insert(transactions).values({
    id: uid(),
    refType: "stake",
    refId: stakeId,
    txHash: result.txHash,
    fromAddress: wallet.qubicAddress,
    toAddress: stake.receiverAddress,
    amountQubic: stake.principalQubic,
    direction: "outbound",
    status: "broadcast",
    tickNumber: result.tickNumber,
  });

  logActivity(db, {
    action: "stake.broadcast",
    actorUserId: userId,
    targetType: "stake",
    targetId: stakeId,
    metadata: { txHash: result.txHash, amount: stake.principalQubic.toString() },
  });

  const updated = await db.select().from(stakes).where(eq(stakes.id, stakeId)).limit(1);
  return { stake: updated[0]!, txHash: result.txHash };
}

// ---------- List user's stakes ----------

export async function listUserStakes(
  userId: string,
  options: { status?: StakeStatus; limit?: number } = {},
): Promise<Stake[]> {
  const db = getDb();
  const conditions = [eq(stakes.userId, userId)];
  if (options.status) conditions.push(eq(stakes.status, options.status));
  return db
    .select()
    .from(stakes)
    .where(and(...conditions))
    .orderBy(desc(stakes.createdAt))
    .limit(Math.min(options.limit ?? 50, 200));
}

export async function getStake(userId: string, stakeId: string): Promise<Stake | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(stakes)
    .where(and(eq(stakes.id, stakeId), eq(stakes.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

// ---------- Cancel (only valid before broadcast) ----------

export async function cancelStake(userId: string, stakeId: string): Promise<void> {
  const db = getDb();
  const rows = await db
    .select()
    .from(stakes)
    .where(and(eq(stakes.id, stakeId), eq(stakes.userId, userId)))
    .limit(1);
  const stake = rows[0];
  if (!stake) throw new Error("Stake not found.");
  if (stake.status !== "pending_signature") {
    throw new Error("Can only cancel before signing/broadcasting.");
  }
  await db
    .update(stakes)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(stakes.id, stakeId));
  logActivity(db, {
    action: "stake.cancelled",
    actorUserId: userId,
    targetType: "stake",
    targetId: stakeId,
  });
}

// ---------- Release (after epoch + cool-down) ----------

export async function releaseStake(userId: string, stakeId: string): Promise<Stake> {
  const db = getDb();
  const rows = await db
    .select()
    .from(stakes)
    .where(and(eq(stakes.id, stakeId), eq(stakes.userId, userId)))
    .limit(1);
  const stake = rows[0];
  if (!stake) throw new Error("Stake not found.");
  if (stake.status !== "active" && stake.status !== "unstaking") {
    throw new Error(`Cannot release a stake in status '${stake.status}'.`);
  }

  const tick = await getQubicClient().getCurrentTick();
  const releaseEpoch = stake.startEpoch + stake.epochsLocked;
  if (tick.epoch < releaseEpoch) {
    throw new Error(`Stake matures at epoch ${releaseEpoch}; current epoch ${tick.epoch}.`);
  }

  // For the stub: mark as released. Real impl: broadcast a release tx.
  await db
    .update(stakes)
    .set({ status: "released", releasedAt: new Date(), updatedAt: new Date() })
    .where(eq(stakes.id, stakeId));
  logActivity(db, {
    action: "stake.released",
    actorUserId: userId,
    targetType: "stake",
    targetId: stakeId,
    metadata: { principal: stake.principalQubic.toString() },
  });
  return (await db.select().from(stakes).where(eq(stakes.id, stakeId)).limit(1))[0]!;
}

// ---------- Helpers ----------

async function sha256Hex(s: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(s).digest("hex");
}

// Suppress unused import
void sql;
