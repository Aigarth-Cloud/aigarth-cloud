/**
 * Billing service — Drizzle schema.
 *
 * Mirrors the Stripe metered-billing + credit-burndown model, adapted
 * for Aigarth. All amounts are in QUBIC (smallest unit).
 *
 *   plans                       — product catalog (free, pro, team, enterprise)
 *   subscriptions                — a user's plan + billing state
 *   invoices                     — billable period, with line items
 *   invoice_items                — line items on an invoice (subscription fee, overage, credit)
 *   payments                     — record of paying an invoice
 *   credits                      — promotional / grant / earned credits
 *   coupons                      — promo code definitions
 *   coupon_redemptions           — usage log of a coupon
 *   billing_audit_logs           — service-local audit log
 *
 * Design notes:
 *   - All bigint columns omit defaults (drizzle-kit can't serialize BigInt literals).
 *   - All enum columns are prefixed with `billing_` to avoid collision with other services.
 *   - Audit log is prefixed with `billing_` to match.
 *   - Cross-service refs (user_id, subscription_id) are stored as uuid without FK
 *     to avoid coupling schema across services.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  bigint,
  integer,
  boolean,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ---------- Enums ----------

export const planTier = pgEnum("billing_plan_tier", [
  "free",
  "pro",
  "team",
  "enterprise",
]);

export const subscriptionStatus = pgEnum("billing_subscription_status", [
  "trialing",
  "active",
  "past_due",
  "cancelled",
  "expired",
]);

export const paymentMethod = pgEnum("billing_payment_method", [
  "qubic",
  "credits",
  "fiat",
]);

export const invoiceStatus = pgEnum("billing_invoice_status", [
  "draft",
  "open",
  "paid",
  "void",
  "uncollectible",
  "overdue",
]);

export const paymentStatus = pgEnum("billing_payment_status", [
  "pending",
  "succeeded",
  "failed",
  "refunded",
]);

export const creditKind = pgEnum("billing_credit_kind", [
  "promo",
  "grant",
  "referral",
  "refund",
  "earned",
]);

export const creditStatus = pgEnum("billing_credit_status", [
  "active",
  "exhausted",
  "expired",
  "void",
]);

export const couponKind = pgEnum("billing_coupon_kind", [
  "percent_off",
  "amount_off",
  "free_period",
]);

export const couponStatus = pgEnum("billing_coupon_status", [
  "active",
  "exhausted",
  "expired",
  "disabled",
]);

// ---------- Tissue usage events (Phase 18E) ----------
//
//   Append-only log of every tissue /decide call. The tissue
//   service POSTs these to the billing service. The billing
//   service aggregates them per period and rolls the total into
//   the invoice preview.
//
//   v1: events are kept forever (cheap, useful for replay/debug).
//   v2: add a 90-day retention cron or partition by month.

export const tissueUsageEvents = pgTable(
  "billing_tissue_usage_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    orgId: uuid("org_id"),
    tissueSlug: text("tissue_slug").notNull(),
    tissueVersion: text("tissue_version").notNull(),
    /** Optional: which marketplace listing generated this call. */
    tissueListingId: uuid("tissue_listing_id"),
    /** Trinary state: -1, 0, +1. */
    state: integer("state").notNull(),
    costQubic: bigint("cost_qubic", { mode: "bigint" }).notNull(),
    /** Caller-supplied request id for cross-service tracing. */
    requestId: text("request_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("billing_tissue_usage_user_idx").on(t.userId),
    userTimeIdx: index("billing_tissue_usage_user_time_idx").on(t.userId, t.occurredAt),
    requestIdx: index("billing_tissue_usage_request_idx").on(t.requestId),
    tissueSlugIdx: index("billing_tissue_usage_tissue_slug_idx").on(t.tissueSlug),
  }),
);

// ---------- Organism usage events (Wave 3 / Phase B, Task 5) ----------
//
//   Append-only log of every per-Organism billable event (forks
//   of a marketplace listing). Mirrors tissue_usage_events: the
//   marketplace POSTs these on every successful fork from an
//   organism listing. The billing service aggregates them per
//   period and rolls the total into the invoice preview.
//
//   We do NOT mutate the user's credit balance on each fork —
//   billing is still period-based (monthly invoice). The event
//   log is the authoritative source for invoice math.
//
//   v1: events are kept forever (cheap, useful for replay/debug).

export const organismUsageEvents = pgTable(
  "billing_organism_usage_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    orgId: uuid("org_id"),
    /** The listed organism being forked. */
    organismSlug: text("organism_slug").notNull(),
    /** Optional: the marketplace listing id. */
    organismListingId: uuid("organism_listing_id"),
    /** The resulting child organism's slug, if known at billing time. */
    childOrganismSlug: text("child_organism_slug"),
    /** Generation of the parent at fork time. */
    parentGeneration: integer("parent_generation").notNull().default(0),
    /** Cost in QUBIC for this fork (the listing's price_per_fork_qubic). */
    costQubic: bigint("cost_qubic", { mode: "bigint" }).notNull(),
    /** Caller-supplied request id for cross-service tracing. */
    requestId: text("request_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("billing_organism_usage_user_idx").on(t.userId),
    userTimeIdx: index("billing_organism_usage_user_time_idx").on(
      t.userId,
      t.occurredAt,
    ),
    requestIdx: index("billing_organism_usage_request_idx").on(t.requestId),
    organismSlugIdx: index("billing_organism_usage_organism_slug_idx").on(
      t.organismSlug,
    ),
    listingIdx: index("billing_organism_usage_listing_idx").on(
      t.organismListingId,
    ),
  }),
);

// ---------- Plans ----------

export const plans = pgTable(
  "billing_plans",
  {
    id: text("id").primaryKey(), // e.g. "free", "pro", "team", "enterprise"
    name: text("name").notNull(),
    description: text("description"),
    tier: planTier("tier").notNull(),
    /** Monthly base price in QUBIC (smallest unit). 0 for free. */
    monthlyPriceQubic: bigint("monthly_price_qubic", { mode: "bigint" }).notNull(),
    /** Included tokens per month. -1 = unlimited. */
    includedTokens: bigint("included_tokens", { mode: "bigint" }).notNull(),
    /** Overage rate per 1K tokens in QUBIC. */
    overageRateQubicPer1k: bigint("overage_rate_qubic_per_1k", { mode: "bigint" }).notNull(),
    /** Free credits granted on subscribe. */
    signupCreditsQubic: bigint("signup_credits_qubic", { mode: "bigint" }).notNull(),
    /** Feature flags. */
    features: jsonb("features").$type<string[]>().notNull().default([]),
    /** Whether new users can subscribe. */
    isActive: boolean("is_active").notNull().default(true),
    /** Display order. */
    sortOrder: integer("sort_order").notNull().default(100),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tierIdx: index("billing_plans_tier_idx").on(t.tier),
    activeIdx: index("billing_plans_active_idx").on(t.isActive),
  }),
);

// ---------- Subscriptions ----------

export const subscriptions = pgTable(
  "billing_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    orgId: uuid("org_id"),
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id),
    status: subscriptionStatus("status").notNull().default("active"),
    paymentMethod: paymentMethod("payment_method").notNull().default("qubic"),
    /** Trial end (if status = trialing). */
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    /** When the current period started. */
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
    /** When the current period ends. */
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
    /** User opted to cancel at end of period. */
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    /** When cancellation was requested. */
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    /** Optional Qubic wallet for Qu payments. */
    qubicWalletId: uuid("qubic_wallet_id"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("billing_subscriptions_user_idx").on(t.userId),
    statusIdx: index("billing_subscriptions_status_idx").on(t.status),
    planIdx: index("billing_subscriptions_plan_idx").on(t.planId),
  }),
);

// ---------- Invoices ----------

export const invoices = pgTable(
  "billing_invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    orgId: uuid("org_id"),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
    /** Period index (0 = first period of this subscription). */
    periodIndex: integer("period_index").notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    status: invoiceStatus("status").notNull().default("open"),
    subtotalQubic: bigint("subtotal_qubic", { mode: "bigint" }).notNull(),
    creditAppliedQubic: bigint("credit_applied_qubic", { mode: "bigint" }).notNull(),
    taxQubic: bigint("tax_qubic", { mode: "bigint" }).notNull(),
    totalQubic: bigint("total_qubic", { mode: "bigint" }).notNull(),
    /** Paid amount (sum of succeeded payments). */
    paidQubic: bigint("paid_qubic", { mode: "bigint" }).notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    /** Public invoice number (e.g. "INV-2026-0001"). */
    number: text("number"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("billing_invoices_user_idx").on(t.userId),
    statusIdx: index("billing_invoices_status_idx").on(t.status),
    subIdx: index("billing_invoices_sub_idx").on(t.subscriptionId),
    numberIdx: uniqueIndex("billing_invoices_number_idx").on(t.number),
  }),
);

export const invoiceItems = pgTable(
  "billing_invoice_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // "subscription", "overage_chat", "overage_embed", "overage_image", "credit_grant", "credit_redemption"
    description: text("description").notNull(),
    quantity: bigint("quantity", { mode: "bigint" }).notNull(),
    unitPriceQubic: bigint("unit_price_qubic", { mode: "bigint" }).notNull(),
    amountQubic: bigint("amount_qubic", { mode: "bigint" }).notNull(),
    /** Metadata (e.g. period, model, token counts). */
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    invoiceIdx: index("billing_invoice_items_invoice_idx").on(t.invoiceId),
    kindIdx: index("billing_invoice_items_kind_idx").on(t.kind),
  }),
);

// ---------- Payments ----------

export const payments = pgTable(
  "billing_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    orgId: uuid("org_id"),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    method: paymentMethod("method").notNull(),
    status: paymentStatus("status").notNull().default("pending"),
    amountQubic: bigint("amount_qubic", { mode: "bigint" }).notNull(),
    /** For Qu payments: the Qubic tx hash. */
    txHash: text("tx_hash"),
    /** For credit payments: the credit id used. */
    creditId: uuid("credit_id"),
    /** For fiat payments: external payment id (Stripe etc.). */
    externalId: text("external_id"),
    failureReason: text("failure_reason"),
    refundedAmountQubic: bigint("refunded_amount_qubic", { mode: "bigint" }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("billing_payments_user_idx").on(t.userId),
    invoiceIdx: index("billing_payments_invoice_idx").on(t.invoiceId),
    statusIdx: index("billing_payments_status_idx").on(t.status),
  }),
);

// ---------- Credits ----------

export const credits = pgTable(
  "billing_credits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    orgId: uuid("org_id"),
    kind: creditKind("kind").notNull(),
    /** Original amount in QUBIC. */
    amountQubic: bigint("amount_qubic", { mode: "bigint" }).notNull(),
    usedQubic: bigint("used_qubic", { mode: "bigint" }).notNull(),
    /** Source description (e.g. "Sign-up bonus", "Promo code LAUNCH50"). */
    source: text("source").notNull(),
    /** Optional coupon that issued this credit. */
    couponId: uuid("coupon_id"),
    status: creditStatus("status").notNull().default("active"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("billing_credits_user_idx").on(t.userId),
    statusIdx: index("billing_credits_status_idx").on(t.status),
  }),
);

// ---------- Coupons ----------

export const coupons = pgTable(
  "billing_coupons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    kind: couponKind("kind").notNull(),
    /** Percentage (0-100) for percent_off, amount in QUBIC for amount_off, period count for free_period. */
    value: integer("value").notNull(),
    /** Max total redemptions. */
    maxRedemptions: integer("max_redemptions").notNull().default(0), // 0 = unlimited
    currentRedemptions: integer("current_redemptions").notNull().default(0),
    /** Per-user redemption limit. */
    perUserLimit: integer("per_user_limit").notNull().default(1),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    status: couponStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    codeIdx: uniqueIndex("billing_coupons_code_idx").on(t.code),
    statusIdx: index("billing_coupons_status_idx").on(t.status),
  }),
);

export const couponRedemptions = pgTable(
  "billing_coupon_redemptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    couponId: uuid("coupon_id")
      .notNull()
      .references(() => coupons.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    creditId: uuid("credit_id").references(() => credits.id, { onDelete: "set null" }),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    couponIdx: index("billing_coupon_redemptions_coupon_idx").on(t.couponId),
    userIdx: index("billing_coupon_redemptions_user_idx").on(t.userId),
  }),
);

// ---------- Audit log ----------

export const auditLogs = pgTable(
  "billing_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id"),
    orgId: uuid("org_id"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    actorIdx: index("billing_audit_logs_actor_idx").on(t.actorUserId),
    actionIdx: index("billing_audit_logs_action_idx").on(t.action),
    createdIdx: index("billing_audit_logs_created_idx").on(t.createdAt),
  }),
);

// ---------- Type exports ----------

export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type SubscriptionStatus = (typeof subscriptionStatus.enumValues)[number];
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type PaymentStatus = (typeof paymentStatus.enumValues)[number];
export type Credit = typeof credits.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type TissueUsageEventRow = typeof tissueUsageEvents.$inferSelect;

// Wave 3 / Phase B (Task 5) — organism usage event row
export type OrganismUsageEventRow = typeof organismUsageEvents.$inferSelect;
