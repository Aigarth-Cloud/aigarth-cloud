import type { Usage } from "./common.js";

export interface UsageRecord {
  id: string;
  org_id: string;
  date: string; // YYYY-MM-DD
  model: string;
  ann_id?: string;
  requests: number;
  usage: Usage;
  /** Cost in USD-cents. */
  cost_cents: number;
}

export interface ListUsageParams {
  start_date?: string;
  end_date?: string;
  limit?: number;
  after?: string;
}

export interface ListUsageResponse {
  object: "list";
  data: UsageRecord[];
  has_more: boolean;
}
