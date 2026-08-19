/**
 * Reservation service.
 *
 * A reservation locks QUBIC for a fixed number of Qubic epochs in
 * exchange for capacity credits. The user can submit jobs against
 * the credit; the credit is debited at job completion.
 *
 * Lifecycle:
 *   active -> released  (user released early, partial refund)
 *   active -> expired   (epoch ended, no refund)
 *   active -> cancelled (cancelled before broadcast, full refund)
 *
 * For Phase 2, the broadcast to Qubic is a no-op (synthetic tx hash).
 * Phase 3 / services/qubic will wire the real broadcast.
 */

import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { reservations, type Reservation, type ReservationStatus } from "../db/schema.js";
export type { ReservationStatus };
import { uid } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";
import { loadConfig } from "../config/index.js";

// ---------- Schemas ----------

export const CreateReservationSchema = z.object({
  /** Principal to lock in QUBIC (smallest unit). */
  principalQubic: z.string().regex(/^\d+$/, "must be a positive integer string"),
  /** How many Qubic epochs to lock for. */
  epochs: z.number().int().min(1).max(52).default(1),
  /** Starting epoch (defaults to current Qubic epoch; for the test we use a fixed value). */
  startEpoch: z.number().int().min(0).optional(),
  /** Optional reference to a Qubic wallet (from services/qubic). */
  qubicWalletId: z.string().uuid().optional(),
  /** Override the platform fee (basis points). Defaults from config. */
  feeBps: z.number().int().min(0).max(10_000).optional(),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

// ---------- Create ----------

function calculateFee(principal: bigint, feeBps: number): bigint {
  // fee = principal * feeBps / 10_000
  return (principal * BigInt(feeBps)) / 10_000n;
}

export async function createReservation(
  userId: string,
  input: CreateReservationInput,
): Promise<Reservation> {
  const db = getDb();
  const cfg = loadConfig();
  const principal = BigInt(input.principalQubic);
  if (principal <= 0n) throw new Error("Principal must be positive.");
  const feeBps = input.feeBps ?? cfg.RESERVATION_FEE_BPS;
  const fee = calculateFee(principal, feeBps);
  const credit = principal - fee;

  const startEpoch = input.startEpoch ?? 0; // 0 means "as of now" — worker can set the real one
  const endEpoch = startEpoch + input.epochs;

  const id = uid();
  // Synthetic tx hash (real impl: services/qubic.broadcastStake or a new reservation RPC)
  const { createHash } = await import("node:crypto");
  const txHash = createHash("sha256")
    .update(`${userId}:${principal.toString()}:${Date.now()}`)
    .digest("hex")
    .slice(0, 60)
    .toUpperCase()
    .padEnd(60, "A");

  const inserted = await db
    .insert(reservations)
    .values({
      id,
      userId,
      qubicWalletId: input.qubicWalletId ?? null,
      principalQubic: principal,
      feeBps,
      creditQubic: credit,
      usedQubic: 0n,
      epochs: input.epochs,
      startEpoch,
      endEpoch,
      status: "active",
      txHash,
    })
    .returning();

  logActivity(db, {
    action: "reservation.created",
    actorUserId: userId,
    targetType: "reservation",
    targetId: id,
    metadata: {
      principalQubic: principal.toString(),
      creditQubic: credit.toString(),
      epochs: input.epochs,
    },
  });
  return inserted[0]!;
}

// ---------- Read ----------

export async function listReservations(
  userId: string,
  options: { status?: ReservationStatus; limit?: number } = {},
): Promise<Reservation[]> {
  const db = getDb();
  const conditions = [eq(reservations.userId, userId)];
  if (options.status) conditions.push(eq(reservations.status, options.status));
  return db
    .select()
    .from(reservations)
    .where(and(...conditions))
    .orderBy(desc(reservations.createdAt))
    .limit(Math.min(options.limit ?? 50, 200));
}

export async function getReservation(userId: string, id: string): Promise<Reservation | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(reservations)
    .where(and(eq(reservations.id, id), eq(reservations.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

// ---------- Release ----------

export interface ReleaseResult {
  reservation: Reservation;
  /** QUBIC returned to user (creditQubic - usedQubic), minus a 0.1% early-release penalty. */
  refundQubic: bigint;
  /** Penalty burned (0.1% of remaining). */
  penaltyQubic: bigint;
}

export async function releaseReservation(
  userId: string,
  id: string,
): Promise<ReleaseResult> {
  const db = getDb();
  const rows = await db
    .select()
    .from(reservations)
    .where(and(eq(reservations.id, id), eq(reservations.userId, userId)))
    .limit(1);
  const r = rows[0];
  if (!r) throw new Error("Reservation not found.");
  if (r.status !== "active") {
    throw new Error(`Reservation is in status '${r.status}', cannot release.`);
  }
  const remaining = r.creditQubic - r.usedQubic;
  if (remaining < 0n) throw new Error("Reservation credit is negative — investigate.");
  // 0.1% early-release penalty
  const penalty = remaining / 1000n;
  const refund = remaining - penalty;

  const updated = await db
    .update(reservations)
    .set({ status: "released", releasedAt: new Date(), updatedAt: new Date() })
    .where(eq(reservations.id, id))
    .returning();

  logActivity(db, {
    action: "reservation.released",
    actorUserId: userId,
    targetType: "reservation",
    targetId: id,
    metadata: { refundQubic: refund.toString(), penaltyQubic: penalty.toString() },
  });

  return { reservation: updated[0]!, refundQubic: refund, penaltyQubic: penalty };
}
