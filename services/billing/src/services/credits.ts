/**
 * Credits.
 *
 * Credits are an internal accounting unit. They are applied at invoice
 * time (not at usage time) to keep the cost model simple. Common kinds:
 *   - "grant"     — free credit issued by the platform (sign-up bonus, support)
 *   - "promo"     — issued via a redeemed coupon
 *   - "refund"    — issued when a payment is refunded
 *   - "earned"    — issued for hitting usage milestones (future)
 *
 * Redemption = marking a credit as the payment method for an invoice
 * (handled in invoices.ts). The credit's `usedQubic` is updated when
 * applied to an invoice.
 */

import { eq, and, desc, sql, lte, gte, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { credits, coupons, couponRedemptions, type Credit, type Coupon } from "../db/schema.js";
import { uid, shortCode } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";

export type { Credit, Coupon };

export const GrantCreditSchema = z.object({
  kind: z.enum(["grant", "promo", "refund", "earned", "referral"]).default("grant"),
  amountQubic: z.string().regex(/^\d+$/, "amount must be a positive integer string"),
  source: z.string().min(1).max(200),
  couponId: z.string().uuid().optional(),
  expiresAt: z.coerce.date().optional(),
});

export interface GrantCreditInput {
  kind?: "grant" | "promo" | "refund" | "earned" | "referral";
  amountQubic: bigint;
  source: string;
  couponId?: string;
  expiresAt?: Date;
}

export async function grantCredit(
  userId: string,
  orgId: string | null,
  input: GrantCreditInput,
): Promise<Credit> {
  const db = getDb();
  const id = uid();
  const inserted = await db
    .insert(credits)
    .values({
      id,
      userId,
      orgId,
      kind: input.kind ?? "grant",
      amountQubic: input.amountQubic,
      usedQubic: 0n,
      source: input.source,
      couponId: input.couponId ?? null,
      expiresAt: input.expiresAt ?? null,
    })
    .returning();
  await logActivity(db, {
    action: "credit.granted",
    actorUserId: userId,
    orgId,
    targetType: "credit",
    targetId: id,
    metadata: { amountQubic: input.amountQubic.toString(), source: input.source },
  });
  return inserted[0]!;
}

export async function listCredits(
  userId: string,
  options: { activeOnly?: boolean } = {},
): Promise<Credit[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(credits)
    .where(eq(credits.userId, userId))
    .orderBy(desc(credits.createdAt));
  if (options.activeOnly) {
    return rows.filter((c) => c.status === "active" && c.amountQubic - c.usedQubic > 0n);
  }
  return rows;
}

export async function getUserActiveCreditTotal(userId: string): Promise<bigint> {
  const db = getDb();
  const rows = await db
    .select()
    .from(credits)
    .where(and(eq(credits.userId, userId), eq(credits.status, "active")));
  let total = 0n;
  for (const c of rows) {
    if (c.expiresAt && c.expiresAt < new Date()) continue;
    total += c.amountQubic - c.usedQubic;
  }
  return total;
}

export async function redeemCoupon(
  userId: string,
  orgId: string | null,
  code: string,
): Promise<Credit> {
  const db = getDb();
  const coupon = (await db.select().from(coupons).where(eq(coupons.code, code)).limit(1))[0];
  if (!coupon) throw new Error("Coupon not found.");
  if (coupon.status !== "active") throw new Error("Coupon is not active.");
  if (coupon.validFrom > new Date()) throw new Error("Coupon is not yet valid.");
  if (coupon.validUntil && coupon.validUntil < new Date()) throw new Error("Coupon has expired.");
  if (coupon.maxRedemptions > 0 && coupon.currentRedemptions >= coupon.maxRedemptions) {
    throw new Error("Coupon redemption limit reached.");
  }

  // Per-user limit
  const userRedemptions = await db
    .select()
    .from(couponRedemptions)
    .where(and(eq(couponRedemptions.couponId, coupon.id), eq(couponRedemptions.userId, userId)));
  if (userRedemptions.length >= coupon.perUserLimit) {
    throw new Error("You have already redeemed this coupon the maximum number of times.");
  }

  // Determine credit amount based on coupon kind
  let creditAmount: bigint;
  let source: string;
  switch (coupon.kind) {
    case "percent_off": {
      // Percent off the next subscription fee. We grant a credit equal
      // to a typical monthly fee (1000 Qu); the invoice engine applies
      // the percentage. For simplicity, grant (value * 1000 / 100) Qu.
      creditAmount = BigInt(coupon.value) * 10n;
      source = `Coupon ${coupon.code}: ${coupon.value}% off`;
      break;
    }
    case "amount_off": {
      // Amount in QUBIC
      creditAmount = BigInt(coupon.value) * 1_000_000n; // value is in Qu; convert to QUBIC
      source = `Coupon ${coupon.code}: ${coupon.value} Qu off`;
      break;
    }
    case "free_period": {
      // value = number of free days
      creditAmount = BigInt(coupon.value) * 1_000_000n * 30n; // 1 Qu/day, 30 days = 30M QUBIC
      source = `Coupon ${coupon.code}: ${coupon.value} free days`;
      break;
    }
  }

  const credit = await grantCredit(userId, orgId, {
    kind: "promo",
    amountQubic: creditAmount,
    source,
    couponId: coupon.id,
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
  });

  // Record redemption
  await db.insert(couponRedemptions).values({
    id: uid(),
    couponId: coupon.id,
    userId,
    creditId: credit.id,
  });

  // Increment redemption counter
  await db
    .update(coupons)
    .set({
      currentRedemptions: sql`${coupons.currentRedemptions} + 1`,
      status: coupon.maxRedemptions > 0 && coupon.currentRedemptions + 1 >= coupon.maxRedemptions
        ? "exhausted"
        : coupon.status,
      updatedAt: new Date(),
    })
    .where(eq(coupons.id, coupon.id));

  await logActivity(db, {
    action: "coupon.redeemed",
    actorUserId: userId,
    targetType: "coupon",
    targetId: coupon.id,
    metadata: { code: coupon.code, creditAmountQubic: creditAmount.toString() },
  });
  return credit;
}

export async function applyCreditToInvoice(creditId: string, amount: bigint): Promise<void> {
  const db = getDb();
  const rows = await db.select().from(credits).where(eq(credits.id, creditId)).limit(1);
  const credit = rows[0];
  if (!credit) throw new Error("Credit not found.");
  const newUsed = credit.usedQubic + amount;
  const newStatus = newUsed >= credit.amountQubic ? "exhausted" : credit.status;
  await db
    .update(credits)
    .set({ usedQubic: newUsed, status: newStatus, updatedAt: new Date() })
    .where(eq(credits.id, creditId));
  if (newStatus === "exhausted") {
    await logActivity(db, {
      action: "credit.exhausted",
      actorUserId: credit.userId,
      targetType: "credit",
      targetId: creditId,
      metadata: { amountQubic: amount.toString() },
    });
  }
}

// ---------- Coupons (admin) ----------

export const CreateCouponSchema = z.object({
  code: z.string().min(3).max(40).optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  kind: z.enum(["percent_off", "amount_off", "free_period"]),
  value: z.number().int().min(1).max(100),
  maxRedemptions: z.number().int().min(0).max(1_000_000).default(0),
  perUserLimit: z.number().int().min(1).max(100).default(1),
  validUntil: z.coerce.date().optional(),
});

export async function createCoupon(
  input: z.infer<typeof CreateCouponSchema>,
  actorUserId: string,
): Promise<Coupon> {
  const db = getDb();
  const code = (input.code ?? shortCode(10)).toUpperCase();
  const id = uid();
  const inserted = await db
    .insert(coupons)
    .values({
      id,
      code,
      name: input.name,
      description: input.description,
      kind: input.kind,
      value: input.value,
      maxRedemptions: input.maxRedemptions,
      perUserLimit: input.perUserLimit,
      validUntil: input.validUntil,
    })
    .returning();
  await logActivity(db, {
    action: "coupon.created",
    actorUserId,
    targetType: "coupon",
    targetId: id,
    metadata: { code, kind: input.kind, value: input.value },
  });
  return inserted[0]!;
}

export async function validateCoupon(code: string): Promise<Coupon | null> {
  const db = getDb();
  const rows = await db.select().from(coupons).where(eq(coupons.code, code.toUpperCase())).limit(1);
  const c = rows[0];
  if (!c) return null;
  if (c.status !== "active") return null;
  if (c.validFrom > new Date()) return null;
  if (c.validUntil && c.validUntil < new Date()) return null;
  if (c.maxRedemptions > 0 && c.currentRedemptions >= c.maxRedemptions) return null;
  return c;
}
