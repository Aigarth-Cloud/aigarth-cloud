/**
 * Serializers — convert DB rows to JSON-safe objects.
 *
 *   All bigints → strings (decimal QUBIC amounts).
 *   All Date → ISO strings.
 */

import type {
  Listing,
  Offer,
  Purchase,
  Auction,
  Bid,
  Review,
  TissueListing,
  OrganismListing,
} from "../db/schema.js";

export function serializeListing(l: Listing): Record<string, unknown> {
  return {
    id: l.id,
    slug: l.slug,
    title: l.title,
    description: l.description,
    icon: l.icon,
    tags: l.tags,
    seller_user_id: l.sellerUserId,
    seller_org_id: l.sellerOrgId,
    seller_name: l.sellerName,
    region_id: l.regionId,
    cluster_id: l.clusterId,
    kind: l.kind,
    capacity_amount_qubic: l.capacityAmountQubic.toString(),
    capacity_remaining_qubic: l.capacityRemainingQubic.toString(),
    price_per_unit_qubic: l.pricePerUnitQubic.toString(),
    duration_seconds: l.durationSeconds.toString(),
    min_purchase_qubic: l.minPurchaseQubic.toString(),
    status: l.status,
    visibility: l.visibility,
    total_offers: l.totalOffers,
    total_purchases: l.totalPurchases,
    total_revenue_qubic: l.totalRevenueQubic.toString(),
    rating_average: l.ratingAverage,
    rating_count: l.ratingCount,
    unlocks_at: l.unlocksAt?.toISOString() ?? null,
    published_at: l.publishedAt?.toISOString() ?? null,
    created_at: l.createdAt.toISOString(),
    updated_at: l.updatedAt.toISOString(),
  };
}

export function serializeOffer(o: Offer): Record<string, unknown> {
  return {
    id: o.id,
    listing_id: o.listingId,
    buyer_user_id: o.buyerUserId,
    buyer_org_id: o.buyerOrgId,
    buyer_name: o.buyerName,
    amount_qubic: o.amountQubic.toString(),
    total_price_qubic: o.totalPriceQubic.toString(),
    status: o.status,
    message: o.message,
    expires_at: o.expiresAt?.toISOString() ?? null,
    responded_at: o.respondedAt?.toISOString() ?? null,
    created_at: o.createdAt.toISOString(),
    updated_at: o.updatedAt.toISOString(),
  };
}

export function serializePurchase(p: Purchase): Record<string, unknown> {
  return {
    id: p.id,
    listing_id: p.listingId,
    offer_id: p.offerId,
    buyer_user_id: p.buyerUserId,
    buyer_org_id: p.buyerOrgId,
    seller_user_id: p.sellerUserId,
    amount_qubic: p.amountQubic.toString(),
    total_price_qubic: p.totalPriceQubic.toString(),
    platform_fee_qubic: p.platformFeeQubic.toString(),
    status: p.status,
    invoice_id: p.invoiceId,
    compute_job_id: p.computeJobId,
    completed_at: p.completedAt?.toISOString() ?? null,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
  };
}

export function serializeAuction(a: Auction): Record<string, unknown> {
  return {
    id: a.id,
    slug: a.slug,
    title: a.title,
    description: a.description,
    icon: a.icon,
    tags: a.tags,
    seller_user_id: a.sellerUserId,
    seller_org_id: a.sellerOrgId,
    seller_name: a.sellerName,
    region_id: a.regionId,
    cluster_id: a.clusterId,
    kind: a.kind,
    capacity_amount_qubic: a.capacityAmountQubic.toString(),
    start_price_qubic: a.startPriceQubic.toString(),
    min_price_qubic: a.minPriceQubic.toString(),
    decrement_per_tick_qubic: a.decrementPerTickQubic?.toString() ?? null,
    tick_interval_seconds: a.tickIntervalSeconds,
    reserve_price_qubic: a.reservePriceQubic?.toString() ?? null,
    current_price_qubic: a.currentPriceQubic?.toString() ?? null,
    current_winning_bid_qubic: a.currentWinningBidQubic?.toString() ?? null,
    status: a.status,
    starts_at: a.startsAt.toISOString(),
    ends_at: a.endsAt.toISOString(),
    settled_at: a.settledAt?.toISOString() ?? null,
    winner_user_id: a.winnerUserId,
    winning_bid_qubic: a.winningBidQubic?.toString() ?? null,
    created_at: a.createdAt.toISOString(),
    updated_at: a.updatedAt.toISOString(),
  };
}

export function serializeBid(b: Bid): Record<string, unknown> {
  return {
    id: b.id,
    auction_id: b.auctionId,
    bidder_user_id: b.bidderUserId,
    bidder_org_id: b.bidderOrgId,
    bidder_name: b.bidderName,
    amount_qubic: b.amountQubic.toString(),
    status: b.status,
    is_winning: b.isWinning,
    sealed_at: b.sealedAt?.toISOString() ?? null,
    created_at: b.createdAt.toISOString(),
    updated_at: b.updatedAt.toISOString(),
  };
}

export function serializeReview(r: Review): Record<string, unknown> {
  return {
    id: r.id,
    target_type: r.targetType,
    target_id: r.targetId,
    reviewer_user_id: r.reviewerUserId,
    reviewer_name: r.reviewerName,
    rating: r.rating,
    review: r.review,
    verified_purchase: r.verifiedPurchase,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  };
}

export function serializeTissueListing(tl: TissueListing): Record<string, unknown> {
  return {
    id: tl.id,
    slug: tl.slug,
    title: tl.title,
    description: tl.description,
    icon: tl.icon,
    tags: tl.tags,
    seller_user_id: tl.sellerUserId,
    seller_org_id: tl.sellerOrgId,
    seller_name: tl.sellerName,
    tissue_slug: tl.tissueSlug,
    tissue_id: tl.tissueId,
    tissue_version: tl.tissueVersion,
    tissue_name: tl.tissueName,
    price_per_decision_qubic: tl.pricePerDecisionQubic.toString(),
    access: tl.access,
    status: tl.status,
    visibility: tl.visibility,
    total_decisions: tl.totalDecisions.toString(),
    total_revenue_qubic: tl.totalRevenueQubic.toString(),
    rating_average: tl.ratingAverage,
    rating_count: tl.ratingCount,
    published_at: tl.publishedAt?.toISOString() ?? null,
    created_at: tl.createdAt.toISOString(),
    updated_at: tl.updatedAt.toISOString(),
  };
}

/**
 * Wave 3 / Phase B (Task 5) — organism listing serializer.
 *
 *   Mirrors serializeTissueListing's shape (snake_case wire format,
 *   bigints → strings, dates → ISO). The `fitness` / `lineage` fields
 *   are intentionally absent: they live in services/ann and the
 *   buyer-facing detail page hydrates them via /v1/organisms/:slug.
 */
export function serializeOrganismListing(
  ol: OrganismListing,
): Record<string, unknown> {
  return {
    id: ol.id,
    slug: ol.slug,
    title: ol.title,
    description: ol.description,
    icon: ol.icon,
    tags: ol.tags,
    seller_user_id: ol.sellerUserId,
    seller_org_id: ol.sellerOrgId,
    seller_name: ol.sellerName,
    organism_slug: ol.organismSlug,
    organism_id: ol.organismId,
    organism_generation: ol.organismGeneration,
    organism_name: ol.organismName,
    organism_kind: ol.organismKind,
    price_per_fork_qubic: ol.pricePerForkQubic.toString(),
    access: ol.access,
    status: ol.status,
    visibility: ol.visibility,
    total_forks: ol.totalForks.toString(),
    total_revenue_qubic: ol.totalRevenueQubic.toString(),
    rating_average: ol.ratingAverage,
    rating_count: ol.ratingCount,
    published_at: ol.publishedAt?.toISOString() ?? null,
    created_at: ol.createdAt.toISOString(),
    updated_at: ol.updatedAt.toISOString(),
  };
}
