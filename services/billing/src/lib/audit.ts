/**
 * Append-only audit log helper for the Billing service.
 *
 * Service-local — uses free-form `action` text.
 */

import type { Database } from "./db-types.js";
import { auditLogs } from "../db/schema.js";
import { uid } from "./ids.js";

export const auditAction = {
  planCreated: "plan.created",
  planUpdated: "plan.updated",
  subscriptionCreated: "subscription.created",
  subscriptionChanged: "subscription.changed",
  subscriptionCancelled: "subscription.cancelled",
  invoiceGenerated: "invoice.generated",
  invoicePaid: "invoice.paid",
  invoiceVoided: "invoice.voided",
  paymentSucceeded: "payment.succeeded",
  paymentFailed: "payment.failed",
  creditGranted: "credit.granted",
  creditRedeemed: "credit.redeemed",
  creditExhausted: "credit.exhausted",
  couponCreated: "coupon.created",
  couponRedeemed: "coupon.redeemed",
} as const;

export interface AuditEvent {
  action: keyof typeof auditAction | (typeof auditAction)[keyof typeof auditAction] | string;
  actorUserId?: string | null;
  orgId?: string | null;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

export async function logActivity(db: Database, event: AuditEvent): Promise<void> {
  await db.insert(auditLogs).values({
    id: uid(),
    action: event.action,
    actorUserId: event.actorUserId ?? null,
    orgId: event.orgId ?? null,
    targetType: event.targetType,
    targetId: event.targetId,
    metadata: event.metadata ?? {},
  });
}
