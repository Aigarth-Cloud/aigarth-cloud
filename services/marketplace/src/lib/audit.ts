/**
 * Append-only audit log helper.
 */

import type { Database } from "./db-types.js";
import { auditLogs } from "../db/schema.js";
import { uid } from "./ids.js";

export const auditAction = {
  listingCreated: "listing.created",
  listingUpdated: "listing.updated",
  listingClosed: "listing.closed",
  offerPlaced: "offer.placed",
  offerAccepted: "offer.accepted",
  offerRejected: "offer.rejected",
  purchaseCompleted: "purchase.completed",
  auctionCreated: "auction.created",
  bidPlaced: "bid.placed",
  bidWon: "bid.won",
  auctionSettled: "auction.settled",
  reviewAdded: "review.added",
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
