/**
 * Marketplace service types — listings, offers, auctions, bids, reviews, purchases.
 */

export type CapacityKind = "spot" | "reserved" | "futures";
export type ListingStatus = "draft" | "published" | "closed" | "archived";
export type ListingVisibility = "public" | "unlisted" | "private";

export interface Listing {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string | null;
  tags: string[];
  seller_user_id: string;
  seller_org_id: string;
  seller_name: string;
  region_id: string;
  cluster_id: string;
  kind: CapacityKind;
  capacity_amount_qubic: string;
  capacity_remaining_qubic: string;
  price_per_unit_qubic: string;
  duration_seconds: string;
  min_purchase_qubic: string;
  status: ListingStatus;
  visibility: ListingVisibility;
  total_offers: number;
  total_purchases: number;
  total_revenue_qubic: string;
  rating_average: number;
  rating_count: number;
  unlocks_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListListingsResponse {
  data: Listing[];
  total: number;
  limit: number;
  offset: number;
}

export type OfferStatus = "pending" | "accepted" | "rejected" | "cancelled" | "expired";

export interface Offer {
  id: string;
  listing_id: string;
  buyer_user_id: string;
  buyer_org_id: string;
  buyer_name: string;
  amount_qubic: string;
  total_price_qubic: string;
  status: OfferStatus;
  message: string | null;
  expires_at: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export type AuctionKind = "dutch" | "english" | "sealed_bid";
export type AuctionStatus = "scheduled" | "live" | "ended" | "settled" | "cancelled";

export interface Auction {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string | null;
  tags: string[];
  seller_user_id: string;
  seller_org_id: string;
  seller_name: string;
  region_id: string;
  cluster_id: string;
  kind: AuctionKind;
  capacity_amount_qubic: string;
  start_price_qubic: string;
  min_price_qubic: string;
  decrement_per_tick_qubic: string | null;
  tick_interval_seconds: number | null;
  reserve_price_qubic: string | null;
  current_price_qubic: string | null;
  current_winning_bid_qubic: string | null;
  status: AuctionStatus;
  starts_at: string;
  ends_at: string;
  settled_at: string | null;
  winner_user_id: string | null;
  winning_bid_qubic: string | null;
  created_at: string;
  updated_at: string;
}

export type BidStatus = "active" | "winning" | "outbid" | "won" | "lost" | "refunded";

export interface Bid {
  id: string;
  auction_id: string;
  bidder_user_id: string;
  bidder_org_id: string;
  bidder_name: string;
  amount_qubic: string;
  status: BidStatus;
  is_winning: boolean;
  sealed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ReviewTargetType = "listing" | "auction" | "user";

export interface Review {
  id: string;
  target_type: ReviewTargetType;
  target_id: string;
  reviewer_user_id: string;
  reviewer_name: string;
  rating: number;
  review: string;
  verified_purchase: boolean;
  created_at: string;
  updated_at: string;
}

export type PurchaseStatus = "pending" | "completed" | "refunded" | "cancelled" | "failed";

export interface Purchase {
  id: string;
  listing_id: string | null;
  offer_id: string | null;
  buyer_user_id: string;
  buyer_org_id: string;
  seller_user_id: string;
  amount_qubic: string;
  total_price_qubic: string;
  platform_fee_qubic: string;
  status: PurchaseStatus;
  invoice_id: string | null;
  compute_job_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}
