/**
 * Aigarth-specific ANN types. ANNs (Artificial Neural Networks) are the
 * first-class deployment unit on the Aigarth network. A model wraps
 * one or more ANN versions; routing is decided per request.
 */

export type AnnCategory =
  | "language"
  | "vision"
  | "speech"
  | "multimodal"
  | "embedding"
  | "agent"
  | "custom";

export type AnnLicense = "open" | "commercial" | "research" | "custom";

export type AnnVisibility = "public" | "unlisted" | "private";
export type AnnStatus = "draft" | "published" | "deprecated" | "suspended";
export type AnnDeploymentStatus = "queued" | "submitted" | "running" | "active" | "draining" | "offline" | "failed";

export interface Ann {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  owner_org_id: string;
  owner_user_id: string;
  category: string;
  license: AnnLicense;
  visibility: AnnVisibility;
  status: AnnStatus;
  latest_version: string;
  versions: AnnVersion[];
  tags: string[];
  homepage_url: string | null;
  repo_url: string | null;
  icon: string | null;
  rating_average: number;
  rating_count: number;
  total_deploys: number;
  total_calls: number;
  total_revenue_qubic: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface AnnVersion {
  id: string;
  ann_id: string;
  version: string;
  description: string;
  /** Hash of the artifact (model weights + manifest). */
  artifact_hash: string;
  /** Pointer to the artifact in object storage. */
  artifact_uri: string;
  /** Where this version is currently deployed. */
  deployments: AnnDeployment[];
  /** Published. */
  published_at: string;
  is_latest: boolean;
  /** Benchmarks. */
  benchmarks?: {
    name: string;
    score: number;
    unit: string;
  }[];
}

export interface AnnDeployment {
  region: string;
  status: AnnDeploymentStatus;
  /** Compute reserved for this deployment, in CUs. */
  reserved_cu: number;
  /** Cost per 1k tokens. */
  cost_per_1k: number;
}

export interface ListAnnsParams {
  /** Filter by category. */
  category?: AnnCategory;
  /** Filter by license. */
  license?: AnnLicense;
  /** Full-text search. */
  search?: string;
  /** Sort: relevance (only with search), newest, popular, rating. */
  sort?: "relevance" | "newest" | "popular" | "rating";
  /** Enable fuzzy (trigram) search. */
  fuzzy?: boolean;
  /** Cursor. */
  after?: string;
  /** Max results. */
  limit?: number;
}

export interface ListAnnsResponse {
  object: "list";
  data: Ann[];
  has_more: boolean;
}

export interface AnnReview {
  id: string;
  target_type: "ann";
  target_id: string;
  reviewer_user_id: string;
  reviewer_name: string;
  rating: number;
  review: string;
  verified_purchase: boolean;
  created_at: string;
  updated_at: string;
}
