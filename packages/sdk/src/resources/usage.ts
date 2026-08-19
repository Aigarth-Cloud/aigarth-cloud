import { BaseResource, toQueryString } from "./_base.js";
import type { ListUsageParams, ListUsageResponse } from "../types/usage.js";

/**
 * /v1/usage — per-org usage and billing data.
 */
export class UsageResource extends BaseResource {
  /** Aggregated usage across a window. */
  async list(params: ListUsageParams = {}): Promise<ListUsageResponse> {
    const query = toQueryString({
      start_date: params.start_date,
      end_date: params.end_date,
      limit: params.limit,
      after: params.after,
    });
    return this.request<ListUsageResponse>(`/v1/usage${query}`, { method: "GET" });
  }

  /** Recent individual requests. */
  async recent(limit = 25): Promise<{ data: unknown[] }> {
    return this.request<{ data: unknown[] }>(`/v1/usage/recent?limit=${limit}`, { method: "GET" });
  }
}
