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

  // -----------------------------------------------------------------
  // Phase 29 — Execution Router (see services/ann/src/services/execution/)
  // -----------------------------------------------------------------

  async execute(
    idOrSlug: string,
    params: {
      manifestHash: string;
      version: string;
      target: "local" | "qubic_oc";
      requestId: string;
      input: Record<string, unknown>;
      parameters?: {
        timeoutMs?: number;
        replicas?: number;
        deterministic?: boolean;
        rewardQubic?: string;
      };
    },
  ): Promise<{ execution_id: string; status: string }> {
    return this.request(`/v1/anns/${encodeURIComponent(idOrSlug)}/execute`, {
      method: "POST",
      body: JSON.stringify({
        manifest_hash: params.manifestHash,
        version: params.version,
        target: params.target,
        request_id: params.requestId,
        input: params.input,
        ...(params.parameters
          ? {
              parameters: {
                ...(params.parameters.timeoutMs !== undefined
                  ? { timeout_ms: params.parameters.timeoutMs }
                  : {}),
                ...(params.parameters.replicas !== undefined
                  ? { replicas: params.parameters.replicas }
                  : {}),
                ...(params.parameters.deterministic !== undefined
                  ? { deterministic: params.parameters.deterministic }
                  : {}),
                ...(params.parameters.rewardQubic
                  ? { reward_qubic: params.parameters.rewardQubic }
                  : {}),
              },
            }
          : {}),
      }),
    });
  }

  async listExecutions(
    idOrSlug: string,
    params: { status?: "queued" | "running" | "completed" | "failed"; target?: "local" | "qubic_oc"; limit?: number; offset?: number } = {},
  ): Promise<{
    data: Array<{
      execution_id: string;
      ann_id: string;
      ann_version: string;
      manifest_hash: string;
      request_id: string;
      target: "local" | "qubic_oc";
      status: "queued" | "running" | "completed" | "failed";
      result_hash: string | null;
      work_id: string | null;
      verification_status: string;
      error: string | null;
      started_at: string;
      completed_at: string | null;
    }>;
    total: number;
    limit: number;
    offset: number;
  }> {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.target) query.set("target", params.target);
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    if (params.offset !== undefined) query.set("offset", String(params.offset));
    const q = query.toString();
    return this.request(`/v1/anns/${encodeURIComponent(idOrSlug)}/executions${q ? `?${q}` : ""}`, { method: "GET" });
  }

  async getExecution(
    idOrSlug: string,
    executionId: string,
  ): Promise<{
    execution_id: string;
    ann_id: string;
    ann_version: string;
    manifest_hash: string;
    target: "local" | "qubic_oc";
    status: "queued" | "running" | "completed" | "failed";
    output: Record<string, unknown> | null;
    result_hash: string | null;
    work_id: string | null;
    verification_status: string;
    error: string | null;
    started_at: string;
    completed_at: string | null;
  }> {
    return this.request(
      `/v1/anns/${encodeURIComponent(idOrSlug)}/executions/${encodeURIComponent(executionId)}`,
      { method: "GET" },
    );
  }

  async listRepositories(idOrSlug: string): Promise<{
    data: Array<{
      id: string;
      ann_id: string;
      ann_version_id: string;
      repo_owner: string;
      repo_name: string;
      commit_sha: string;
      manifest_hash: string;
      release_tag: string | null;
      release_url: string | null;
      publication_kind: "seed" | "github_app";
      published_at: string;
    }>;
  }> {
    return this.request(`/v1/anns/${encodeURIComponent(idOrSlug)}/repositories`, { method: "GET" });
  }
}