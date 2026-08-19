/**
 * Marketplace tissue-listing types — Phase 18E.
 *
 *   A `TissueListing` is a marketplace wrapper that binds a tissue
 *   to a price-per-decision and an access model (open / licensed).
 */

import type { TissueAccess } from "./tissue.js";

export type TissueListingStatus = "draft" | "active" | "paused" | "sold_out" | "closed";
export type TissueListingVisibility = "public" | "unlisted";

export interface TissueListing {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  icon: string | null;
  tags: string[];
  seller_user_id: string;
  seller_org_id: string | null;
  seller_name: string;
  tissue_slug: string;
  tissue_id: string | null;
  tissue_version: string;
  tissue_name: string;
  price_per_decision_qubic: string;
  access: TissueAccess;
  status: TissueListingStatus;
  visibility: TissueListingVisibility;
  total_decisions: string;
  total_revenue_qubic: string;
  rating_average: string | null;
  rating_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListTissueListingsParams {
  q?: string;
  status?: TissueListingStatus;
  visibility?: TissueListingVisibility;
  seller?: string;
  tissueSlug?: string;
  access?: TissueAccess;
  sort?: "newest" | "oldest" | "price_asc" | "price_desc" | "rating";
  limit?: number;
  offset?: number;
}

export interface ListTissueListingsResponse {
  data: TissueListing[];
  total: number;
  limit: number;
  offset: number;
}
