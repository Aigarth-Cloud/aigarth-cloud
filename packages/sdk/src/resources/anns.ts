import { BaseResource, toQueryString } from "./_base.js";
import type { Ann, AnnReview, ListAnnsParams, ListAnnsResponse } from "../types/ann.js";

/**
 * /v1/anns + /v1/reviews + /v1/anns/:id/deploy — Aigarth ANN registry.
 *
 *   const anns = await client.anns.list({ category: "language" });
 *   const a = await client.anns.retrieve("lex-reasoner");
 *   const reviews = await client.anns.listReviews("lex-reasoner");
 *
 * ANNs (Artificial Neural Networks) are the first-class deployment
 * unit on the Aigarth network. A registered ANN can be deployed
 * onto compute clusters and routed via the gateway.
 */
export class Anns extends BaseResource {
  // ---------- Public ----------

  async list(params: ListAnnsParams = {}): Promise<ListAnnsResponse> {
    const query = toQueryString({
      category: params.category,
      license: params.license,
      search: params.search,
      sort: params.sort,
      fuzzy: params.fuzzy ? "true" : undefined,
      after: params.after,
      limit: params.limit,
    });
    return this.request<ListAnnsResponse>(`/v1/anns${query}`, { method: "GET" });
  }

  async retrieve(idOrSlug: string): Promise<Ann> {
    return this.request<Ann>(`/v1/anns/${encodeURIComponent(idOrSlug)}`, { method: "GET" });
  }

  async listReviews(idOrSlug: string): Promise<{ data: AnnReview[] }> {
    return this.request<{ data: AnnReview[] }>(
      `/v1/anns/${encodeURIComponent(idOrSlug)}/reviews`,
      { method: "GET" },
    );
  }

  // ---------- Authenticated (mutation) ----------

  async create(params: {
    name: string;
    slug?: string;
    tagline: string;
    description: string;
    category: string;
    tags?: string[];
    license?: "open" | "commercial" | "restricted" | "custom";
    visibility?: "public" | "unlisted" | "private";
    homepageUrl?: string;
    repoUrl?: string;
  }): Promise<Ann> {
    return this.request<Ann>("/v1/anns", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async update(idOrSlug: string, params: Partial<{
    name: string;
    tagline: string;
    description: string;
    category: string;
    tags: string[];
    visibility: "public" | "unlisted" | "private";
    homepageUrl: string;
    repoUrl: string;
  }>): Promise<Ann> {
    return this.request<Ann>(`/v1/anns/${encodeURIComponent(idOrSlug)}`, {
      method: "PATCH",
      body: JSON.stringify(params),
    });
  }

  async publish(idOrSlug: string): Promise<Ann> {
    return this.request<Ann>(`/v1/anns/${encodeURIComponent(idOrSlug)}/publish`, {
      method: "POST",
    });
  }

  async deprecate(idOrSlug: string): Promise<Ann> {
    return this.request<Ann>(`/v1/anns/${encodeURIComponent(idOrSlug)}/deprecate`, {
      method: "POST",
    });
  }

  async addReview(
    idOrSlug: string,
    params: { rating: number; review: string },
  ): Promise<AnnReview> {
    return this.request<AnnReview>(`/v1/anns/${encodeURIComponent(idOrSlug)}/reviews`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async deploy(
    idOrSlug: string,
    params: { regionId: string; clusterId: string; priority?: number; replicas?: number },
  ): Promise<{ job_id: string; status: string; estimated_cost_qubic: string; remaining_credit_qubic: string }> {
    return this.request(`/v1/anns/${encodeURIComponent(idOrSlug)}/deploy`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async analytics(idOrSlug: string): Promise<{
    ann_id: string;
    deployment_status_breakdown: Record<string, number>;
    rating_distribution: Record<string, number>;
    average_rating: number;
    total_deploys: number;
    total_calls: number;
    total_revenue_qubic: string;
    latest_benchmarks: { name: string; score: number; unit: string }[];
  }> {
    return this.request(`/v1/anns/${encodeURIComponent(idOrSlug)}/analytics`, {
      method: "GET",
    });
  }

  // Phase 19D.1 — public accuracy rollup (success rate + outcome count).
  // Used by the Garden and the marketplace listing to show the
  // actual (real-world) success rate next to the lab-benchmarked
  // predicted accuracy. No auth required.
  async stats(idOrSlug: string): Promise<{
    ann_id: string;
    slug: string;
    predicted_accuracy: string | null;
    latency_p50_ms: number | null;
    rating_average: string | null;
    total_outcomes: number;
    success_rate: number | null;
    recent_success_rate: number | null;
    avg_confidence_in_label: number | null;
    last_recorded_at: string | null;
  }> {
    return this.request(`/v1/anns/${encodeURIComponent(idOrSlug)}/stats`, {
      method: "GET",
    });
  }
}
