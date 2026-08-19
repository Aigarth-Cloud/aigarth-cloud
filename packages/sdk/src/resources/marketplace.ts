import { BaseResource, toQueryString } from "./_base.js";
import type {
  Listing,
  ListListingsResponse,
  CapacityKind,
  ListingStatus,
  ListingVisibility,
  Offer,
  OfferStatus,
  Auction,
  AuctionKind,
  AuctionStatus,
  Bid,
  BidStatus,
  Review,
  ReviewTargetType,
  Purchase,
  PurchaseStatus,
} from "../types/marketplace.js";
import type {
  TissueListing,
  ListTissueListingsResponse,
  ListTissueListingsParams,
  TissueListingStatus,
} from "../types/tissueListing.js";
import type { TissueAccess } from "../types/tissue.js";

/**
 * /v1/* — compute marketplace service.
 *
 *   const listings = await client.marketplace.listings.list({ kind: "spot" });
 *   const offer = await client.marketplace.offers.create({ listing_id: "...", amount_qubic: "1000" });
 *   const auction = await client.marketplace.auctions.create({ kind: "dutch", ... });
 *
 * The marketplace supports three pricing models:
 *  - Listings: spot / reserved / futures
 *  - Offers: buyer-initiated bids on listings
 *  - Auctions: Dutch (descending), English (ascending), sealed-bid
 *
 * 2.5% platform fee is auto-deducted from completed purchases.
 *
 * Phase 18E also added `tissueListings` — a separate listing type
 * that sells per-decision access to a tissue (trinary decision API).
 */
export class MarketplaceResource extends BaseResource {
  // ============================================================================
  // Listings
  // ============================================================================

  readonly listings = {
    list: (params?: {
      kind?: CapacityKind;
      status?: ListingStatus;
      visibility?: ListingVisibility;
      regionId?: string;
      clusterId?: string;
      seller?: string;
      search?: string;
      limit?: number;
      offset?: number;
    }): Promise<ListListingsResponse> => {
      const query = toQueryString(params ?? {});
      return this.request<ListListingsResponse>(`/v1/listings${query}`, { method: "GET" });
    },

    retrieve: (idOrSlug: string): Promise<Listing> =>
      this.request<Listing>(`/v1/listings/${encodeURIComponent(idOrSlug)}`, { method: "GET" }),

    create: (params: {
      title: string;
      slug?: string;
      description: string;
      kind: CapacityKind;
      region_id: string;
      cluster_id: string;
      capacity_amount_qubic: string;
      price_per_unit_qubic: string;
      duration_seconds: number;
      min_purchase_qubic?: string;
      visibility?: ListingVisibility;
      icon?: string;
      tags?: string[];
    }): Promise<Listing> =>
      this.request<Listing>("/v1/listings", {
        method: "POST",
        body: JSON.stringify(params),
      }),

    update: (
      id: string,
      params: Partial<{
        title: string;
        description: string;
        price_per_unit_qubic: string;
        min_purchase_qubic: string;
        visibility: ListingVisibility;
        icon: string;
        tags: string[];
      }>,
    ): Promise<Listing> =>
      this.request<Listing>(`/v1/listings/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(params),
      }),

    close: (id: string): Promise<Listing> =>
      this.request<Listing>(`/v1/listings/${encodeURIComponent(id)}/close`, { method: "POST" }),

    listOffers: (idOrSlug: string): Promise<{ data: Offer[] }> =>
      this.request<{ data: Offer[] }>(
        `/v1/listings/${encodeURIComponent(idOrSlug)}/offers`,
        { method: "GET" },
      ),
  };

  // ============================================================================
  // Offers
  // ============================================================================

  readonly offers = {
    create: (params: {
      listing_id: string;
      amount_qubic: string;
      message?: string;
      expires_in_hours?: number;
    }): Promise<Offer> =>
      this.request<Offer>("/v1/offers", {
        method: "POST",
        body: JSON.stringify(params),
      }),

    accept: (id: string): Promise<Offer> =>
      this.request<Offer>(`/v1/offers/${encodeURIComponent(id)}/accept`, { method: "POST" }),

    reject: (id: string, reason?: string): Promise<Offer> =>
      this.request<Offer>(`/v1/offers/${encodeURIComponent(id)}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),

    cancel: (id: string): Promise<Offer> =>
      this.request<Offer>(`/v1/offers/${encodeURIComponent(id)}/cancel`, { method: "POST" }),
  };

  // ============================================================================
  // Auctions
  // ============================================================================

  readonly auctions = {
    list: (params?: {
      kind?: AuctionKind;
      status?: AuctionStatus;
      seller?: string;
    }): Promise<{ data: Auction[] }> => {
      const query = toQueryString(params ?? {});
      return this.request<{ data: Auction[] }>(`/v1/auctions${query}`, { method: "GET" });
    },

    /** Settle-on-read: refreshes Dutch price + settles if ended. */
    retrieve: (idOrSlug: string): Promise<Auction> =>
      this.request<Auction>(`/v1/auctions/${encodeURIComponent(idOrSlug)}`, { method: "GET" }),

    create: (params:
      | {
          kind: "dutch";
          title: string;
          slug?: string;
          description: string;
          region_id: string;
          cluster_id: string;
          capacity_amount_qubic: string;
          start_price_qubic: string;
          min_price_qubic: string;
          decrement_per_tick_qubic: string;
          tick_interval_seconds: number;
          duration_seconds: number;
          icon?: string;
          tags?: string[];
        }
      | {
          kind: "english";
          title: string;
          slug?: string;
          description: string;
          region_id: string;
          cluster_id: string;
          capacity_amount_qubic: string;
          start_price_qubic: string;
          min_price_qubic: string;
          reserve_price_qubic?: string;
          duration_seconds: number;
          icon?: string;
          tags?: string[];
        }
      | {
          kind: "sealed_bid";
          title: string;
          slug?: string;
          description: string;
          region_id: string;
          cluster_id: string;
          capacity_amount_qubic: string;
          start_price_qubic: string;
          min_price_qubic: string;
          duration_seconds: number;
          icon?: string;
          tags?: string[];
        }
    ): Promise<Auction> =>
      this.request<Auction>("/v1/auctions", {
        method: "POST",
        body: JSON.stringify(params),
      }),

    listBids: (idOrSlug: string): Promise<{ data: Bid[] }> =>
      this.request<{ data: Bid[] }>(`/v1/auctions/${encodeURIComponent(idOrSlug)}/bids`, {
        method: "GET",
      }),

    placeBid: (
      id: string,
      params: { amount_qubic: string },
    ): Promise<Bid> =>
      this.request<Bid>(`/v1/auctions/${encodeURIComponent(id)}/bid`, {
        method: "POST",
        body: JSON.stringify(params),
      }),
  };

  // ============================================================================
  // Reviews
  // ============================================================================

  readonly reviews = {
    list: (params: { targetType: ReviewTargetType; targetId: string }): Promise<{ data: Review[] }> => {
      const query = toQueryString(params);
      return this.request<{ data: Review[] }>(`/v1/reviews${query}`, { method: "GET" });
    },

    create: (params: {
      targetType: ReviewTargetType;
      targetId: string;
      rating: number;
      review: string;
    }): Promise<Review> =>
      this.request<Review>("/v1/reviews", {
        method: "POST",
        body: JSON.stringify(params),
      }),
  };

  // ============================================================================
  // Purchases (my)
  // ============================================================================

  readonly purchases = {
    list: (params?: { status?: PurchaseStatus; limit?: number }): Promise<{ data: Purchase[] }> => {
      const query = toQueryString(params ?? {});
      return this.request<{ data: Purchase[] }>(`/v1/me/purchases${query}`, { method: "GET" });
    },
  };

  // ============================================================================
  // Tissue listings (Phase 18E — Trinary Intelligence product)
  // ============================================================================

  readonly tissueListings = {
    list: (params: ListTissueListingsParams = {}): Promise<ListTissueListingsResponse> => {
      const query = toQueryString({
        q: params.q,
        status: params.status,
        visibility: params.visibility,
        seller: params.seller,
        tissueSlug: params.tissueSlug,
        access: params.access,
        sort: params.sort,
        limit: params.limit,
        offset: params.offset,
      });
      return this.request<ListTissueListingsResponse>(`/v1/tissue-listings${query}`, {
        method: "GET",
      });
    },

    retrieve: (idOrSlug: string): Promise<TissueListing> =>
      this.request<TissueListing>(
        `/v1/tissue-listings/${encodeURIComponent(idOrSlug)}`,
        { method: "GET" },
      ),

    create: (params: {
      title: string;
      description?: string;
      icon?: string;
      tags?: string[];
      tissueSlug: string;
      tissueVersion?: string;
      tissueName: string;
      pricePerDecisionQubic: string;
      access?: TissueAccess;
      visibility?: "public" | "unlisted";
    }): Promise<TissueListing> =>
      this.request<TissueListing>("/v1/tissue-listings", {
        method: "POST",
        body: JSON.stringify({
          title: params.title,
          description: params.description,
          icon: params.icon,
          tags: params.tags,
          tissue_slug: params.tissueSlug,
          tissue_version: params.tissueVersion,
          tissue_name: params.tissueName,
          price_per_decision_qubic: params.pricePerDecisionQubic,
          access: params.access,
          visibility: params.visibility,
        }),
      }),

    update: (
      id: string,
      params: Partial<{
        title: string;
        description: string;
        icon: string;
        tags: string[];
        pricePerDecisionQubic: string;
        access: TissueAccess;
        visibility: "public" | "unlisted";
        status: TissueListingStatus;
      }>,
    ): Promise<TissueListing> =>
      this.request<TissueListing>(`/v1/tissue-listings/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: params.title,
          description: params.description,
          icon: params.icon,
          tags: params.tags,
          price_per_decision_qubic: params.pricePerDecisionQubic,
          access: params.access,
          visibility: params.visibility,
          status: params.status,
        }),
      }),

    close: (id: string): Promise<TissueListing> =>
      this.request<TissueListing>(`/v1/tissue-listings/${encodeURIComponent(id)}/close`, {
        method: "POST",
      }),
  };
}
