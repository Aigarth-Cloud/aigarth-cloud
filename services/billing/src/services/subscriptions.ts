/**
 * Subscriptions.
 *
 * A subscription = (user, plan, period). Periods are rolling 30-day
 * windows anchored to the subscription start. On subscribe:
 *   1. Create the subscription row
 *   2. Grant the plan's signup credit (if any)
 *   3. (No invoice yet — invoice is generated at the end of the period)
 *
 * Change plan = create a new subscription, mark the old as expired.
 * Cancel = set cancel_at_period_end = true (subscription remains
 * active until period_end, then becomes cancelled).
 */

import { eq, and, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import {
  subscriptions,
  plans,
  type Subscription,
  type SubscriptionStatus,
} from "../db/schema.js";
import { uid } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";
import { loadConfig } from "../config/index.js";
import { grantCredit } from "./credits.js";

export type { Subscription };

export const SubscribeSchema = z.object({
  planId: z.string().min(1).max(60),
  paymentMethod: z.enum(["qubic", "credits", "fiat"]).default("qubic"),
  qubicWalletId: z.string().uuid().optional(),
  trial: z.boolean().optional().default(false),
});

export const ChangePlanSchema = z.object({
  planId: z.string().min(1).max(60),
});

export async function subscribe(
  userId: string,
  orgId: string | null,
  input: z.infer<typeof SubscribeSchema>,
): Promise<Subscription> {
  const db = getDb();
  const cfg = loadConfig();

  // Verify the plan exists and is active
  const plan = (
    await db.select().from(plans).where(eq(plans.id, input.planId)).limit(1)
  )[0];
  if (!plan) throw new Error("Plan not found.");
  if (!plan.isActive) throw new Error("Plan is not available for new subscriptions.");

  // Check if user already has an active subscription
  const existing = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        inArray(subscriptions.status, ["trialing", "active"]),
      ),
    );
  if (existing[0]) {
    throw new Error("User already has an active subscription. Cancel it first or change the plan.");
  }

  const now = new Date();
  const periodEnd = new Date(now.getTime() + cfg.BILLING_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  const trialEnd = input.trial ? new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) : null;

  const id = uid();
  const inserted = await db
    .insert(subscriptions)
    .values({
      id,
      userId,
      orgId,
      planId: plan.id,
      status: trialEnd ? "trialing" : "active",
      paymentMethod: input.paymentMethod,
      trialEndsAt: trialEnd,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      qubicWalletId: input.qubicWalletId ?? null,
    })
    .returning();

  // Grant signup credit
  if (plan.signupCreditsQubic > 0n) {
    await grantCredit(userId, orgId, {
      kind: "grant",
      amountQubic: plan.signupCreditsQubic,
      source: `Sign-up bonus for ${plan.name}`,
    });
  }

  await logActivity(db, {
    action: "subscription.created",
    actorUserId: userId,
    orgId,
    targetType: "subscription",
    targetId: id,
    metadata: { planId: plan.id, paymentMethod: input.paymentMethod, trial: !!trialEnd },
  });
  return inserted[0]!;
}

export async function changePlan(
  userId: string,
  subId: string,
  input: z.infer<typeof ChangePlanSchema>,
): Promise<Subscription> {
  const db = getDb();
  const sub = await getSubscription(userId, subId);
  if (!sub) throw new Error("Subscription not found.");
  if (sub.status === "cancelled" || sub.status === "expired") {
    throw new Error("Cannot change a cancelled or expired subscription.");
  }
  const newPlan = (await db.select().from(plans).where(eq(plans.id, input.planId)).limit(1))[0];
  if (!newPlan) throw new Error("Plan not found.");
  if (!newPlan.isActive) throw new Error("Plan is not available.");

  const updated = await db
    .update(subscriptions)
    .set({ planId: input.planId, updatedAt: new Date() })
    .where(eq(subscriptions.id, subId))
    .returning();
  await logActivity(db, {
    action: "subscription.changed",
    actorUserId: userId,
    targetType: "subscription",
    targetId: subId,
    metadata: { fromPlan: sub.planId, toPlan: input.planId },
  });
  return updated[0]!;
}

export async function setCancelAtPeriodEnd(userId: string, subId: string): Promise<Subscription> {
  const db = getDb();
  const sub = await getSubscription(userId, subId);
  if (!sub) throw new Error("Subscription not found.");
  if (sub.status === "cancelled" || sub.status === "expired") {
    throw new Error("Subscription is already cancelled or expired.");
  }
  const updated = await db
    .update(subscriptions)
    .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
    .where(eq(subscriptions.id, subId))
    .returning();
  await logActivity(db, {
    action: "subscription.changed",
    actorUserId: userId,
    targetType: "subscription",
    targetId: subId,
    metadata: { cancelAtPeriodEnd: true },
  });
  return updated[0]!;
}

export async function cancelImmediately(userId: string, subId: string): Promise<Subscription> {
  const db = getDb();
  const sub = await getSubscription(userId, subId);
  if (!sub) throw new Error("Subscription not found.");
  const updated = await db
    .update(subscriptions)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subId))
    .returning();
  await logActivity(db, {
    action: "subscription.cancelled",
    actorUserId: userId,
    targetType: "subscription",
    targetId: subId,
  });
  return updated[0]!;
}

export async function getSubscription(userId: string, subId: string): Promise<Subscription | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.id, subId), eq(subscriptions.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listSubscriptions(
  userId: string,
  options: { status?: SubscriptionStatus | SubscriptionStatus[] } = {},
): Promise<Subscription[]> {
  const db = getDb();
  const conditions = [eq(subscriptions.userId, userId)];
  if (options.status) {
    const statuses = Array.isArray(options.status) ? options.status : [options.status];
    conditions.push(inArray(subscriptions.status, statuses));
  }
  return db
    .select()
    .from(subscriptions)
    .where(and(...conditions))
    .orderBy(desc(subscriptions.createdAt));
}
