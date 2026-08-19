/**
 * Treasury service.
 *
 * Manages the platform's Qubic treasury wallet. The treasury is a
 * multi-sig (M-of-N) arrangement; movement requests gather signatures
 * and are broadcast once the threshold is met.
 *
 *   signers_required  : threshold
 *   signers_approved  : how many have signed so far
 *
 * For now the "signing" is collected server-side (we never see
 * production private keys; the real impl uses HSMs or threshold sigs).
 */

import { eq, desc, sql, and } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import {
  treasuryMovements,
  validators,
  type TreasuryMovement,
  type Validator,
} from "../db/schema.js";
import { uid } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";
import { loadConfig } from "../config/index.js";

// ---------- Schemas ----------

export const CreateTreasuryMovementSchema = z.object({
  kind: z.enum(["stake_fee", "unstake_payout", "reward_payout", "deposit", "withdrawal"]),
  amountQubic: z.string().regex(/^\d+$/),
  counterparty: z.string().max(120).optional(),
  signersRequired: z.number().int().min(1).max(20).optional(),
});

export const SignTreasuryMovementSchema = z.object({
  /** The signer's address (must be in TREASURY_SIGNERS). */
  signer: z.string().regex(/^[A-Z]{60}$/),
  signature: z.string().min(16).max(2048),
});

// ---------- Create movement ----------

export async function createMovement(
  input: z.infer<typeof CreateTreasuryMovementSchema>,
  actorUserId: string,
): Promise<TreasuryMovement> {
  const cfg = loadConfig();
  const db = getDb();

  const signersRequired = input.signersRequired ?? cfg.TREASURY_THRESHOLD;

  const id = uid();
  const amount = BigInt(input.amountQubic);
  const inserted = await db
    .insert(treasuryMovements)
    .values({
      id,
      kind: input.kind,
      amountQubic: amount,
      counterparty: input.counterparty,
      signersApproved: 0,
      signersRequired,
      payload: { signatures: [] },
    })
    .returning();
  logActivity(db, {
    action: "treasury.movement",
    actorUserId,
    targetType: "treasury_movement",
    targetId: id,
    metadata: { kind: input.kind, amount: amount.toString() },
  });
  return inserted[0]!;
}

export async function signMovement(
  movementId: string,
  input: z.infer<typeof SignTreasuryMovementSchema>,
  actorUserId: string,
): Promise<TreasuryMovement> {
  const cfg = loadConfig();
  const db = getDb();
  const signers = cfg.TREASURY_SIGNERS.split(",").map((s) => s.trim()).filter(Boolean);
  if (!signers.includes(input.signer)) {
    throw new Error("Signer is not authorized.");
  }
  const rows = await db.select().from(treasuryMovements).where(eq(treasuryMovements.id, movementId)).limit(1);
  const movement = rows[0];
  if (!movement) throw new Error("Movement not found.");
  if (movement.executedAt) throw new Error("Movement already executed.");

  // Read existing signatures from payload
  const payload = (movement.payload ?? {}) as { signatures: Array<{ signer: string; signature: string; at: string }> };
  const sigs = payload.signatures ?? [];
  if (sigs.some((s) => s.signer === input.signer)) {
    throw new Error("Signer has already signed.");
  }
  sigs.push({ signer: input.signer, signature: input.signature, at: new Date().toISOString() });
  const newCount = sigs.length;

  await db
    .update(treasuryMovements)
    .set({
      signersApproved: newCount,
      payload: { ...payload, signatures: sigs },
    })
    .where(eq(treasuryMovements.id, movementId));

  logActivity(db, {
    action: "treasury.signed",
    actorUserId,
    targetType: "treasury_movement",
    targetId: movementId,
    metadata: { signer: input.signer, approved: newCount, required: movement.signersRequired },
  });

  const updated = await db.select().from(treasuryMovements).where(eq(treasuryMovements.id, movementId)).limit(1);
  return updated[0]!;
}

export async function executeMovement(movementId: string, txHash: string): Promise<TreasuryMovement> {
  const db = getDb();
  await db
    .update(treasuryMovements)
    .set({ executedAt: new Date(), txHash })
    .where(eq(treasuryMovements.id, movementId));
  return (await db.select().from(treasuryMovements).where(eq(treasuryMovements.id, movementId)).limit(1))[0]!;
}

export async function listMovements(options: { limit?: number } = {}): Promise<TreasuryMovement[]> {
  const db = getDb();
  return db
    .select()
    .from(treasuryMovements)
    .orderBy(desc(treasuryMovements.createdAt))
    .limit(Math.min(options.limit ?? 50, 200));
}

// ---------- Validators ----------

export async function listValidators(options: { limit?: number } = {}): Promise<Validator[]> {
  const db = getDb();
  // Always refresh from Qubic, but cache for 1h
  const cached = await db.select().from(validators).orderBy(desc(validators.createdAt)).limit(1);
  const last = cached[0];
  const isStale = !last || (Date.now() - last.createdAt.getTime() > 60 * 60 * 1000);
  if (isStale) {
    try {
      const { getQubicClient } = await import("../client/index.js");
      const client = getQubicClient();
      const live = await client.listComputors({ limit: 676 });
      // Upsert
      for (const c of live) {
        const existing = await db
          .select()
          .from(validators)
          .where(eq(validators.computorIndex, c.computorIndex))
          .limit(1);
        if (existing[0]) {
          await db
            .update(validators)
            .set({
              qubicAddress: c.qubicAddress,
              alias: c.alias,
              isActive: c.isActive,
              performanceScore: c.performanceScore,
              stakeQubic: c.stakeQubic,
              lastSeenAt: new Date(),
            })
            .where(eq(validators.id, existing[0].id));
        } else {
          await db.insert(validators).values({
            computorIndex: c.computorIndex,
            qubicAddress: c.qubicAddress,
            alias: c.alias,
            isActive: c.isActive,
            performanceScore: c.performanceScore,
            stakeQubic: c.stakeQubic,
            lastSeenAt: new Date(),
          });
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[treasury] failed to refresh validators: ${err instanceof Error ? err.message : err}`);
    }
  }
  return db.select().from(validators).limit(Math.min(options.limit ?? 50, 676));
}

export async function onboardValidator(
  computorIndex: number,
  actorUserId: string,
): Promise<Validator> {
  const db = getDb();
  const { getQubicClient } = await import("../client/index.js");
  const live = await getQubicClient().getComputor(computorIndex);
  if (!live) throw new Error(`Computor ${computorIndex} not found.`);
  const id = uid();
  const inserted = await db
    .insert(validators)
    .values({
      id,
      computorIndex: live.computorIndex,
      qubicAddress: live.qubicAddress,
      alias: live.alias,
      isActive: true,
      performanceScore: live.performanceScore,
      stakeQubic: live.stakeQubic,
      lastSeenAt: new Date(),
    })
    .onConflictDoUpdate({
      target: validators.computorIndex,
      set: {
        qubicAddress: live.qubicAddress,
        alias: live.alias,
        isActive: true,
        performanceScore: live.performanceScore,
        stakeQubic: live.stakeQubic,
        lastSeenAt: new Date(),
      },
    })
    .returning();
  logActivity(db, {
    action: "validator.onboarded",
    actorUserId,
    targetType: "validator",
    targetId: id,
    metadata: { computorIndex, address: live.qubicAddress },
  });
  return inserted[0]!;
}

// Suppress unused
void sql;
void and;
