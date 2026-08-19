/**
 * Invoices.
 *
 * Invoice = a billable period. Generated from:
 *   - Subscription fee (plan.monthlyPriceQubic)
 *   - Overage on metered usage (gateway + compute)
 *
 * Credits are NOT applied at invoice generation. They are applied at
 * payment time via `payInvoice({ method: "credits" })`. This matches
 * Stripe's model: an invoice's `total` is the full subtotal; the
 * customer's credit balance is debited only when a `credits` payment
 * is made. This avoids the "credit double-applied" failure mode and
 * keeps the invoice total stable for accounting.
 *
 * Status flow:
 *   draft → open → paid (or void / uncollectible)
 *
 * For Phase 4, invoices are generated on-demand (via /v1/invoices/generate
 * or the /v1/billing/upcoming preview). Auto-generation on period end is a future cron.
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import {
  invoices,
  invoiceItems,
  subscriptions,
  plans,
  type Invoice,
  type InvoiceItem,
} from "../db/schema.js";
import { uid } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";
import { addDays } from "../lib/period.js";
import { getGatewayUsage, getComputeUsage } from "./usage.js";
import { getTissueUsage } from "./tissueUsage.js";
import { getUserActiveCreditTotal } from "./credits.js";
import { loadConfig } from "../config/index.js";

export { payInvoice, PayInvoiceSchema } from "./payments.js";
export type { Invoice, InvoiceItem };

// ---------- Generate invoice (preview or actual) ----------

export interface InvoicePreview {
  subscriptionId: string;
  periodStart: Date;
  periodEnd: Date;
  planId: string;
  planName: string;
  baseFeeQubic: bigint;
  overageChatQubic: bigint;
  overageEmbedQubic: bigint;
  overageImageQubic: bigint;
  overageComputeQubic: bigint;
  overageTissueQubic: bigint;
  subtotalQubic: bigint;
  /** Credit that WOULD be applied if the user pays with `method=credits`. 0 on the actual invoice. */
  creditAppliedQubic: bigint;
  totalQubic: bigint;
  tokensIncluded: bigint;
  tokensUsed: bigint;
  tissueDecisions: number;
  dataSource: "live" | "partial" | "unavailable";
}

async function buildPreview(
  userId: string,
  jwt: string,
  subscriptionId: string,
  options: { asActual?: boolean; number?: string } = {},
): Promise<InvoicePreview | null> {
  const db = getDb();
  const subRows = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.userId, userId)))
    .limit(1);
  const sub = subRows[0];
  if (!sub) return null;
  const plan = (await db.select().from(plans).where(eq(plans.id, sub.planId)).limit(1))[0];
  if (!plan) return null;

  // Get usage for the current period
  const [gateway, compute, tissue] = await Promise.all([
    getGatewayUsage(userId, jwt, sub.currentPeriodStart),
    getComputeUsage(userId, jwt, sub.currentPeriodStart),
    getTissueUsage(userId, sub.currentPeriodStart),
  ]);
  const dataSource =
    gateway.source === "unavailable" && compute.source === "unavailable" && tissue.source === "unavailable"
      ? "unavailable"
      : gateway.source === "unavailable" || compute.source === "unavailable" || tissue.source === "unavailable"
        ? "partial"
        : "live";

  // Overage calculation
  const tokensUsed = BigInt(gateway.totalTokens);
  const tokensIncluded = plan.includedTokens;
  const overageTokens = tokensUsed > tokensIncluded ? tokensUsed - tokensIncluded : 0n;
  const overageUnits = overageTokens / 1000n + (overageTokens % 1000n > 0n ? 1n : 0n);
  const overageQubic = overageUnits * plan.overageRateQubicPer1k;

  // Per-endpoint breakdowns (best-effort)
  let overageChatQubic = 0n;
  let overageEmbedQubic = 0n;
  let overageImageQubic = 0n;
  for (const e of gateway.byEndpoint) {
    // Naive split: chat by total tokens, embed flat, image flat.
    if (e.endpoint === "chat.completions") {
      // ~70% of chat usage is input/output
      overageChatQubic = (e.cost * overageQubic) / (gateway.totalCostQubic || 1n);
    } else if (e.endpoint === "embeddings") {
      overageEmbedQubic = (e.cost * overageQubic) / (gateway.totalCostQubic || 1n);
    } else if (e.endpoint === "images.generations") {
      overageImageQubic = (e.cost * overageQubic) / (gateway.totalCostQubic || 1n);
    }
  }

  const subtotalQubic =
    plan.monthlyPriceQubic + overageQubic + compute.totalSpentQubic + tissue.totalCostQubic;
  // Compute what the credit WOULD be IF the user paid with `method=credits`.
  // This is shown in previews and the upcoming endpoint for transparency.
  // The actual invoice does NOT deduct this from the total — credits are
  // only consumed at payment time.
  const availableCredit = await getUserActiveCreditTotal(userId);
  const creditWouldApplyQubic = availableCredit < subtotalQubic ? availableCredit : subtotalQubic;
  // For actual invoices, no credit is applied at generation.
  // For previews, show what would be applied so the user knows the discounted total.
  const creditAppliedQubic = options.asActual ? 0n : creditWouldApplyQubic;
  const totalQubic = subtotalQubic - creditAppliedQubic;

  if (options.asActual) {
    // Create the actual invoice + items
    const id = uid();
    const cfg = loadConfig();
    const dueAt = addDays(new Date(), cfg.INVOICE_DUE_DAYS);
    const inserted = await db
      .insert(invoices)
      .values({
        id,
        userId,
        orgId: sub.orgId,
        subscriptionId,
        periodIndex: 0, // single-period invoices for now
        periodStart: sub.currentPeriodStart,
        periodEnd: sub.currentPeriodEnd,
        status: "open",
        subtotalQubic,
        creditAppliedQubic,
        taxQubic: 0n,
        totalQubic,
        paidQubic: 0n,
        dueAt,
        number: options.number,
      })
      .returning();

    const items: Array<{ kind: string; description: string; quantity: bigint; unitPriceQubic: bigint; amountQubic: bigint; metadata: Record<string, unknown> }> = [];
    if (plan.monthlyPriceQubic > 0n) {
      items.push({
        kind: "subscription",
        description: `${plan.name} monthly subscription`,
        quantity: 1n,
        unitPriceQubic: plan.monthlyPriceQubic,
        amountQubic: plan.monthlyPriceQubic,
        metadata: { planId: plan.id, periodStart: sub.currentPeriodStart, periodEnd: sub.currentPeriodEnd },
      });
    }
    if (overageChatQubic > 0n) {
      items.push({
        kind: "overage_chat",
        description: `Chat overage: ${overageTokens.toString()} tokens beyond included ${tokensIncluded.toString()}`,
        quantity: overageUnits,
        unitPriceQubic: plan.overageRateQubicPer1k,
        amountQubic: overageChatQubic,
        metadata: { model: "aigarth-meridian-*", tokens: overageTokens.toString() },
      });
    }
    if (overageEmbedQubic > 0n) {
      items.push({
        kind: "overage_embed",
        description: `Embedding overage`,
        quantity: overageUnits,
        unitPriceQubic: plan.overageRateQubicPer1k,
        amountQubic: overageEmbedQubic,
        metadata: { model: "aigarth-embed-1" },
      });
    }
    if (overageImageQubic > 0n) {
      items.push({
        kind: "overage_image",
        description: `Image generation overage`,
        quantity: overageUnits,
        unitPriceQubic: plan.overageRateQubicPer1k,
        amountQubic: overageImageQubic,
        metadata: { model: "aigarth-image-1" },
      });
    }
    if (compute.totalSpentQubic > 0n) {
      items.push({
        kind: "overage_compute",
        description: `Compute job spend (stub mode)`,
        quantity: 1n,
        unitPriceQubic: compute.totalSpentQubic,
        amountQubic: compute.totalSpentQubic,
        metadata: { jobs: compute.totalJobs, completedJobs: compute.completedJobs },
      });
    }
    if (tissue.totalCostQubic > 0n) {
      items.push({
        kind: "overage_tissue",
        description: `Tissue decisions: ${tissue.totalDecisions} calls`,
        quantity: BigInt(tissue.totalDecisions),
        unitPriceQubic: tissue.totalDecisions > 0n
          ? tissue.totalCostQubic / BigInt(tissue.totalDecisions)
          : 0n,
        amountQubic: tissue.totalCostQubic,
        metadata: {
          decisions: tissue.totalDecisions,
          by_tissue: tissue.byTissue.map((b) => ({
            tissue_slug: b.tissueSlug,
            decisions: b.decisions,
            cost_qubic: b.costQubic.toString(),
          })),
          by_state: tissue.byState,
        },
      });
    }
    // Note: credit_redemption line item is NOT added at generation.
    // Credits are debited at pay time and the resulting payment is recorded
    // with method=credits. The credit_redemption line item is added then.

    for (const it of items) {
      await db.insert(invoiceItems).values({
        id: uid(),
        invoiceId: id,
        kind: it.kind,
        description: it.description,
        quantity: it.quantity,
        unitPriceQubic: it.unitPriceQubic,
        amountQubic: it.amountQubic,
        metadata: it.metadata,
      });
    }

    await logActivity(db, {
      action: "invoice.generated",
      actorUserId: userId,
      orgId: sub.orgId,
      targetType: "invoice",
      targetId: id,
      metadata: {
        totalQubic: totalQubic.toString(),
        creditAvailableQubic: availableCredit.toString(),
      },
    });

    return {
      subscriptionId,
      periodStart: sub.currentPeriodStart,
      periodEnd: sub.currentPeriodEnd,
      planId: plan.id,
      planName: plan.name,
      baseFeeQubic: plan.monthlyPriceQubic,
      overageChatQubic,
      overageEmbedQubic,
      overageImageQubic,
      overageComputeQubic: compute.totalSpentQubic,
      overageTissueQubic: tissue.totalCostQubic,
      subtotalQubic,
      creditAppliedQubic,
      totalQubic,
      tokensIncluded,
      tokensUsed,
      tissueDecisions: tissue.totalDecisions,
      dataSource,
    };
  }

  return {
    subscriptionId,
    periodStart: sub.currentPeriodStart,
    periodEnd: sub.currentPeriodEnd,
    planId: plan.id,
    planName: plan.name,
    baseFeeQubic: plan.monthlyPriceQubic,
    overageChatQubic,
    overageEmbedQubic,
    overageImageQubic,
    overageComputeQubic: compute.totalSpentQubic,
    overageTissueQubic: tissue.totalCostQubic,
    subtotalQubic,
    creditAppliedQubic,
    totalQubic,
    tokensIncluded,
    tokensUsed,
    tissueDecisions: tissue.totalDecisions,
    dataSource,
  };
}

export async function previewInvoice(userId: string, jwt: string, subscriptionId: string): Promise<InvoicePreview | null> {
  // Preview shows what the upcoming invoice WILL be, including the credit
  // that would be applied if the user pays with `method=credits`. This is
  // a display-only calculation; the actual credit consumption happens at
  // payment time.
  return buildPreview(userId, jwt, subscriptionId, {});
}

export async function generateInvoice(userId: string, jwt: string, subscriptionId: string): Promise<Invoice | null> {
  const db = getDb();
  // Generate a unique invoice number
  const countRow = await db.execute<{ n: number }>(sql`SELECT count(*)::int as n FROM billing_invoices`);
  const count = (countRow.rows?.[0]?.n ?? 0) + 1;
  const year = new Date().getFullYear();
  const number = `INV-${year}-${String(count).padStart(4, "0")}`;

  const preview = await buildPreview(userId, jwt, subscriptionId, { asActual: true, number });
  if (!preview) return null;
  const rows = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.subscriptionId, subscriptionId), eq(invoices.userId, userId)))
    .orderBy(desc(invoices.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

// ---------- Read ----------

export async function listInvoices(userId: string): Promise<Invoice[]> {
  const db = getDb();
  return db
    .select()
    .from(invoices)
    .where(eq(invoices.userId, userId))
    .orderBy(desc(invoices.createdAt));
}

export async function getInvoice(userId: string, id: string): Promise<Invoice | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
  const db = getDb();
  return db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
}

// ---------- Mark paid (used by payments service) ----------

export async function markInvoicePaid(invoiceId: string, amount: bigint): Promise<Invoice | null> {
  const db = getDb();
  const rows = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  const inv = rows[0];
  if (!inv) return null;
  if (inv.status === "paid") return inv;
  const newPaid = inv.paidQubic + amount;
  const status = newPaid >= inv.totalQubic ? "paid" : "open";
  const updated = await db
    .update(invoices)
    .set({
      paidQubic: newPaid,
      status,
      paidAt: status === "paid" ? new Date() : inv.paidAt,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId))
    .returning();
  return updated[0] ?? null;
}

export async function voidInvoice(invoiceId: string): Promise<Invoice | null> {
  const db = getDb();
  const updated = await db
    .update(invoices)
    .set({ status: "void", voidedAt: new Date(), updatedAt: new Date() })
    .where(eq(invoices.id, invoiceId))
    .returning();
  return updated[0] ?? null;
}
