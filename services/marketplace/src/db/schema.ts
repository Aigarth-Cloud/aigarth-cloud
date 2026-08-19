/**
 * Marketplace service — Drizzle schema.
 *
 *   listings             — compute capacity listings (spot / reserved / futures)
 *   tissue_listings      — tissue decision listings (per-call, signed envelopes)
 *   offers               — buyer's offer on a listing
 *   purchases            — successful transactions
 *   auctions             — capacity auctions (Dutch / English / sealed-bid)
 *   bids                 — bids on an auction
 *   reviews              — peer reviews on listings / auctions / users
 *   mkt_audit_logs       — service-local audit log
 *
 *   All enums prefixed with `mkt_` to avoid collisions with other services.
 *   All bigint amounts omit defaults (drizzle-kit can't serialize BigInt literals).
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
import { sql } from "drizzle-orm";

// ---------- Enums ----------

export const mktCapacityKind = pgEnum("mkt_capacity_kind", ["spot", "reserved", "futures"]);

export const mktListingStatus = pgEnum("mkt_listing_status", [
  "draft",
  "active",
  "paused",
  "sold_out",
  "closed",
]);

export const mktListingVisibility = pgEnum("mkt_listing_visibility", ["public", "unlisted"]);

export const mktOfferStatus = pgEnum("mkt_offer_status", [
  "pending",
  "accepted",
  "rejected",
  "cancelled",
  "expired",
]);

export const mktPurchaseStatus = pgEnum("mkt_purchase_status", [
  "pending",
  "completed",
  "refunded",
  "cancelled",
]);

export const mktAuctionKind = pgEnum("mkt_auction_kind", ["dutch", "english", "sealed_bid"]);

export const mktAuctionStatus = pgEnum("mkt_auction_status", [
  "scheduled",
  "live",
  "ended",
  "settled",
  "cancelled",
]);

export const mktBidStatus = pgEnum("mkt_bid_status", [
  "active",
  "winning",
  "outbid",
  "won",
  "lost",
  "refunded",
]);

export const mktReviewTarget = pgEnum("mkt_review_target", ["listing", "auction", "user"]);

/** Phase 18E — Tissue listings share an enum with compute listings. */
export const mktTissueListingStatus = mktListingStatus;
export const mktTissueListingVisibility = mktListingVisibility;

/** Phase 18E — whether the tissue is open-call or licensed-only. */
export const mktTissueAccess = pgEnum("mkt_tissue_access", ["open", "licensed"]);

/** Wave 3 / Phase B (Task 5) — Organism listing access model. */
export const mktOrganismAccess = pgEnum("mkt_organism_access", ["open", "licensed"]);

// ---------- Listings ----------

export const listings = pgTable(
  "mkt_listings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    icon: text("icon"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),

    sellerUserId: uuid("seller_user_id").notNull(),
    sellerOrgId: uuid("seller_org_id"),
    sellerName: text("seller_name").notNull(),

    /** Cross-service refs to services/compute (region + cluster). */
    regionId: uuid("region_id"),
    clusterId: uuid("cluster_id"),

    kind: mktCapacityKind("kind").notNull(),
    /** Total capacity offered (in QUBIC of compute). */
    capacityAmountQubic: bigint("capacity_amount_qubic", { mode: "bigint" }).notNull(),
    /** Remaining capacity. Decrements as offers are accepted. */
    capacityRemainingQubic: bigint("capacity_remaining_qubic", { mode: "bigint" }).notNull(),
    /** Price per QUBIC of compute, in QUBIC. */
    pricePerUnitQubic: bigint("price_per_unit_qubic", { mode: "bigint" }).notNull(),
    /** Duration the capacity is reserved for, in seconds. */
    durationSeconds: bigint("duration_seconds", { mode: "bigint" }).notNull(),
    /** Minimum order size, in QUBIC. */
    minPurchaseQubic: bigint("min_purchase_qubic", { mode: "bigint" }).notNull(),

    status: mktListingStatus("status").notNull().default("draft"),
    visibility: mktListingVisibility("visibility").notNull().default("public"),

    /** Denormalized aggregates. */
    totalOffers: integer("total_offers").notNull().default(0),
    totalPurchases: integer("total_purchases").notNull().default(0),
    totalRevenueQubic: bigint("total_revenue_qubic", { mode: "bigint" }).notNull(),
    ratingAverage: text("rating_average"),
    ratingCount: integer("rating_count").notNull().default(0),

    /** For futures: when the capacity unlocks. */
    unlocksAt: timestamp("unlocks_at", { withTimezone: true }),

    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex("mkt_listings_slug_idx").on(t.slug),
    statusIdx: index("mkt_listings_status_idx").on(t.status),
    visibilityIdx: index("mkt_listings_visibility_idx").on(t.visibility),
    kindIdx: index("mkt_listings_kind_idx").on(t.kind),
    sellerIdx: index("mkt_listings_seller_idx").on(t.sellerUserId),
  }),
);

// ---------- Tissue listings (Phase 18E) ----------

/**
 * Phase 18E — A separate table for tissue-based listings. The
 * product here is per-decision (signed envelope), not per-capacity.
 * A listing binds a tissue to a price-per-decision + access model.
 *
 * Why a separate table?
 *   - Tissue listings have different shape (no region/cluster, no
 *     capacity/duration, no offer/bid lifecycle — each call is its
 *     own micro-transaction).
 *   - Compute listings and tissue listings are searched and
 *     filtered differently.
 *   - Keeps existing compute listings schema unchanged (no risky
 *     nullable migration across a busy table).
 */
export const tissueListings = pgTable(
  "mkt_tissue_listings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    icon: text("icon"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),

    sellerUserId: uuid("seller_user_id").notNull(),
    sellerOrgId: uuid("seller_org_id"),
    sellerName: text("seller_name").notNull(),

    /**
     * Cross-service refs to services/tissue. No FK because the
     * tissue service is a different DB. Slug is the join key;
     * the tissue_id is resolved on first call and cached.
     */
    tissueSlug: text("tissue_slug").notNull(),
    tissueId: uuid("tissue_id"),
    /** Snapshot at listing time — what version of the tissue we list. */
    tissueVersion: text("tissue_version").notNull(),
    /** Denormalized name for catalog display. */
    tissueName: text("tissue_name").notNull(),

    /**
     * Pricing. Same fee for all 3 states (+1/0/-1) so there's no
     * perverse incentive for the tissue to force non-zero
     * answers. Phase 18C gateway-level decision.
     */
    pricePerDecisionQubic: bigint("price_per_decision_qubic", { mode: "bigint" }).notNull(),

    /** Access: open (anyone can call) or licensed (must have a grant). */
    access: mktTissueAccess("access").notNull().default("open"),

    status: mktTissueListingStatus("status").notNull().default("draft"),
    visibility: mktTissueListingVisibility("visibility").notNull().default("public"),

    /** Denormalized aggregates. */
    totalDecisions: bigint("total_decisions", { mode: "bigint" }).notNull().default(sql`0`),
    totalRevenueQubic: bigint("total_revenue_qubic", { mode: "bigint" }).notNull().default(sql`0`),
    ratingAverage: text("rating_average"),
    ratingCount: integer("rating_count").notNull().default(0),

    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex("mkt_tissue_listings_slug_idx").on(t.slug),
    statusIdx: index("mkt_tissue_listings_status_idx").on(t.status),
    visibilityIdx: index("mkt_tissue_listings_visibility_idx").on(t.visibility),
    sellerIdx: index("mkt_tissue_listings_seller_idx").on(t.sellerUserId),
    tissueSlugIdx: index("mkt_tissue_listings_tissue_slug_idx").on(t.tissueSlug),
    accessIdx: index("mkt_tissue_listings_access_idx").on(t.access),
  }),
);

// ---------- Organism listings (Wave 3 / Phase B, Task 5) ----------
//
//   Phase 26.C — A separate table for Organism-based listings. The
//   product here is per-Organism (a lineaged, stateful intelligence
//   with mutable genome + episodic memory + tracked fitness).
//
//   Mirrors the tissue_listings shape: title, description, seller,
//   per-Organism price (this time per-fork, not per-decision), access
//   model, listing metadata, and lifecycle (draft/active/paused/closed).
//
//   Cross-service ref to services/ann: organism_slug is the natural
//   join key (the ann service indexes organisms by slug). No FK because
//   the ann service is a different DB; the slug is resolved lazily.

export const organismListings = pgTable(
  "mkt_organism_listings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    icon: text("icon"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),

    sellerUserId: uuid("seller_user_id").notNull(),
    sellerOrgId: uuid("seller_org_id"),
    sellerName: text("seller_name").notNull(),

    /**
     * Cross-service refs to services/ann. No FK — the ann service is
     * a different DB. The slug is the join key; the organism_id is
     * resolved on first call and cached.
     */
    organismSlug: text("organism_slug").notNull(),
    organismId: uuid("organism_id"),
    /** Snapshot at listing time — which generation the listing is for. */
    organismGeneration: integer("organism_generation").notNull().default(0),
    /** Denormalized name for catalog display. */
    organismName: text("organism_name").notNull(),
    /** Snapshot of the organism kind: researcher/optimizer/predictor/synthetist/custom. */
    organismKind: text("organism_kind").notNull(),

    /**
     * Pricing. Per-fork (one QUBIC unit per child organism the buyer
     * forks from this listing). Mirrors the tissue_listings pattern.
     */
    pricePerForkQubic: bigint("price_per_fork_qubic", { mode: "bigint" }).notNull(),

    /** Access: open (anyone can fork) or licensed (must have a grant). */
    access: mktOrganismAccess("access").notNull().default("open"),

    status: mktTissueListingStatus("status").notNull().default("draft"),
    visibility: mktTissueListingVisibility("visibility").notNull().default("public"),

    /** Denormalized aggregates. */
    totalForks: bigint("total_forks", { mode: "bigint" }).notNull().default(sql`0`),
    totalRevenueQubic: bigint("total_revenue_qubic", { mode: "bigint" }).notNull().default(sql`0`),
    ratingAverage: text("rating_average"),
    ratingCount: integer("rating_count").notNull().default(0),

    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex("mkt_organism_listings_slug_idx").on(t.slug),
    statusIdx: index("mkt_organism_listings_status_idx").on(t.status),
    visibilityIdx: index("mkt_organism_listings_visibility_idx").on(t.visibility),
    sellerIdx: index("mkt_organism_listings_seller_idx").on(t.sellerUserId),
    organismSlugIdx: index("mkt_organism_listings_organism_slug_idx").on(t.organismSlug),
    accessIdx: index("mkt_organism_listings_access_idx").on(t.access),
  }),
);

// ---------- Offers ----------

export const offers = pgTable(
  "mkt_offers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    buyerUserId: uuid("buyer_user_id").notNull(),
    buyerOrgId: uuid("buyer_org_id"),
    buyerName: text("buyer_name").notNull(),

    /** Amount of capacity the buyer wants (in QUBIC of compute). */
    amountQubic: bigint("amount_qubic", { mode: "bigint" }).notNull(),
    /** Total price the buyer pays (amount * price_per_unit). */
    totalPriceQubic: bigint("total_price_qubic", { mode: "bigint" }).notNull(),

    status: mktOfferStatus("status").notNull().default("pending"),
    message: text("message"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    listingIdx: index("mkt_offers_listing_idx").on(t.listingId),
    buyerIdx: index("mkt_offers_buyer_idx").on(t.buyerUserId),
    statusIdx: index("mkt_offers_status_idx").on(t.status),
  }),
);

// ---------- Purchases ----------

export const purchases = pgTable(
  "mkt_purchases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "set null" }),
    offerId: uuid("offer_id").references(() => offers.id, { onDelete: "set null" }),

    buyerUserId: uuid("buyer_user_id").notNull(),
    buyerOrgId: uuid("buyer_org_id"),
    sellerUserId: uuid("seller_user_id").notNull(),

    amountQubic: bigint("amount_qubic", { mode: "bigint" }).notNull(),
    totalPriceQubic: bigint("total_price_qubic", { mode: "bigint" }).notNull(),
    platformFeeQubic: bigint("platform_fee_qubic", { mode: "bigint" }).notNull(),

    status: mktPurchaseStatus("status").notNull().default("pending"),
    /** Cross-service refs. */
    invoiceId: uuid("invoice_id"),
    computeJobId: uuid("compute_job_id"),

    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    listingIdx: index("mkt_purchases_listing_idx").on(t.listingId),
    buyerIdx: index("mkt_purchases_buyer_idx").on(t.buyerUserId),
    sellerIdx: index("mkt_purchases_seller_idx").on(t.sellerUserId),
    statusIdx: index("mkt_purchases_status_idx").on(t.status),
  }),
);

// ---------- Auctions ----------

export const auctions = pgTable(
  "mkt_auctions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    icon: text("icon"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),

    sellerUserId: uuid("seller_user_id").notNull(),
    sellerOrgId: uuid("seller_org_id"),
    sellerName: text("seller_name").notNull(),

    regionId: uuid("region_id"),
    clusterId: uuid("cluster_id"),

    kind: mktAuctionKind("kind").notNull(),

    capacityAmountQubic: bigint("capacity_amount_qubic", { mode: "bigint" }).notNull(),

    /** Dutch: starts here. English/sealed: not used (min_price is the floor). */
    startPriceQubic: bigint("start_price_qubic", { mode: "bigint" }).notNull(),
    /** Dutch: ends here. English/sealed: minimum acceptable bid. */
    minPriceQubic: bigint("min_price_qubic", { mode: "bigint" }).notNull(),
    /** Dutch only: how much to drop per tick. */
    decrementPerTickQubic: bigint("decrement_per_tick_qubic", { mode: "bigint" }),
    /** Dutch only: seconds between decrements. */
    tickIntervalSeconds: integer("tick_interval_seconds"),
    /** Optional minimum acceptable price (for all kinds). */
    reservePriceQubic: bigint("reserve_price_qubic", { mode: "bigint" }),

    /** Dutch only: the current price, computed at query time. */
    currentPriceQubic: bigint("current_price_qubic", { mode: "bigint" }),

    /** English only: the current winning bid. */
    currentWinningBidQubic: bigint("current_winning_bid_qubic", { mode: "bigint" }),

    status: mktAuctionStatus("status").notNull().default("scheduled"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),

    settledAt: timestamp("settled_at", { withTimezone: true }),
    winnerUserId: uuid("winner_user_id"),
    winningBidQubic: bigint("winning_bid_qubic", { mode: "bigint" }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex("mkt_auctions_slug_idx").on(t.slug),
    statusIdx: index("mkt_auctions_status_idx").on(t.status),
    kindIdx: index("mkt_auctions_kind_idx").on(t.kind),
    sellerIdx: index("mkt_auctions_seller_idx").on(t.sellerUserId),
    endsIdx: index("mkt_auctions_ends_idx").on(t.endsAt),
  }),
);

// ---------- Bids ----------

export const bids = pgTable(
  "mkt_bids",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    auctionId: uuid("auction_id")
      .notNull()
      .references(() => auctions.id, { onDelete: "cascade" }),
    bidderUserId: uuid("bidder_user_id").notNull(),
    bidderOrgId: uuid("bidder_org_id"),
    bidderName: text("bidder_name").notNull(),

    amountQubic: bigint("amount_qubic", { mode: "bigint" }).notNull(),
    status: mktBidStatus("status").notNull().default("active"),
    /** Convenience flag: is this the current winning bid? */
    isWinning: boolean("is_winning").notNull().default(false),

    sealedAt: timestamp("sealed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    auctionIdx: index("mkt_bids_auction_idx").on(t.auctionId),
    bidderIdx: index("mkt_bids_bidder_idx").on(t.bidderUserId),
    winningIdx: index("mkt_bids_winning_idx").on(t.auctionId, t.isWinning),
  }),
);

// ---------- Reviews ----------

export const reviews = pgTable(
  "mkt_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    targetType: mktReviewTarget("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    reviewerUserId: uuid("reviewer_user_id").notNull(),
    reviewerName: text("reviewer_name").notNull(),
    rating: integer("rating").notNull(),
    review: text("review"),
    verifiedPurchase: boolean("verified_purchase").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    targetUserIdx: uniqueIndex("mkt_reviews_target_user_idx").on(t.targetType, t.targetId, t.reviewerUserId),
    targetIdx: index("mkt_reviews_target_idx").on(t.targetType, t.targetId),
  }),
);

// ---------- Audit log ----------

export const auditLogs = pgTable(
  "mkt_audit_logs",
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
    actorIdx: index("mkt_audit_logs_actor_idx").on(t.actorUserId),
    actionIdx: index("mkt_audit_logs_action_idx").on(t.action),
    createdIdx: index("mkt_audit_logs_created_idx").on(t.createdAt),
  }),
);

// ---------- Type exports ----------

export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
export type Offer = typeof offers.$inferSelect;
export type NewOffer = typeof offers.$inferInsert;
export type Purchase = typeof purchases.$inferSelect;
export type NewPurchase = typeof purchases.$inferInsert;
export type Auction = typeof auctions.$inferSelect;
export type NewAuction = typeof auctions.$inferInsert;
export type Bid = typeof bids.$inferSelect;
export type NewBid = typeof bids.$inferInsert;
export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type CapacityKind = (typeof mktCapacityKind.enumValues)[number];
export type AuctionKind = (typeof mktAuctionKind.enumValues)[number];
export type ListingStatus = (typeof mktListingStatus.enumValues)[number];
export type AuctionStatus = (typeof mktAuctionStatus.enumValues)[number];

// Phase 18E — tissue listing types
export type TissueListing = typeof tissueListings.$inferSelect;
export type NewTissueListing = typeof tissueListings.$inferInsert;
export type TissueListingStatus = (typeof mktTissueListingStatus.enumValues)[number];
export type TissueListingVisibility = (typeof mktTissueListingVisibility.enumValues)[number];
export type TissueAccess = (typeof mktTissueAccess.enumValues)[number];

// Wave 3 / Phase B (Task 5) — organism listing types
export type OrganismListing = typeof organismListings.$inferSelect;
export type NewOrganismListing = typeof organismListings.$inferInsert;
export type OrganismAccess = (typeof mktOrganismAccess.enumValues)[number];
