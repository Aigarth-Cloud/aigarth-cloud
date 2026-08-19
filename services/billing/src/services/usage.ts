/**
 * Cross-service usage aggregation.
 *
 * Reads from:
 *   - services/gateway  → /v1/usage  (aggregated)
 *   - services/compute  → /v1/compute/stats  (per-user)
 *
 * For Phase 4, we use simple HTTP calls. Cross-service direct DB
 * access is tempting but breaks the service boundary.
 *
 * Failure mode: if a service is down, we return what we can (with a
 * flag indicating partial data). The invoice is still generated.
 */

import { loadConfig } from "../config/index.js";

export interface GatewayUsage {
  totalRequests: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCostQubic: bigint;
  byModel: Array<{ model: string; requests: number; tokens: number; cost: bigint }>;
  byEndpoint: Array<{ endpoint: string; requests: number; cost: bigint }>;
  source: "live" | "unavailable";
}

export interface ComputeUsage {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  cancelledJobs: number;
  totalSpentQubic: bigint;
  source: "live" | "unavailable";
}

export async function getGatewayUsage(userId: string, jwt: string, since?: Date): Promise<GatewayUsage> {
  const cfg = loadConfig();
  try {
    const qs = since ? `?since=${since.toISOString()}` : "";
    const res = await fetch(`${cfg.GATEWAY_SERVICE_URL}/v1/usage${qs}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
    const data = (await res.json()) as {
      total_requests: number;
      total_tokens: number;
      prompt_tokens: number;
      completion_tokens: number;
      total_cost_qubic: string;
      by_model: Array<{ model: string; requests: number; tokens: number; cost: string }>;
      by_endpoint: Array<{ endpoint: string; requests: number; cost: string }>;
    };
    return {
      totalRequests: data.total_requests,
      totalTokens: data.total_tokens,
      promptTokens: data.prompt_tokens,
      completionTokens: data.completion_tokens,
      totalCostQubic: BigInt(data.total_cost_qubic),
      byModel: data.by_model.map((m) => ({ ...m, cost: BigInt(m.cost) })),
      byEndpoint: data.by_endpoint.map((e) => ({ ...e, cost: BigInt(e.cost) })),
      source: "live",
    };
  } catch {
    return {
      totalRequests: 0,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalCostQubic: 0n,
      byModel: [],
      byEndpoint: [],
      source: "unavailable",
    };
  }
}

export async function getComputeUsage(userId: string, jwt: string, since?: Date): Promise<ComputeUsage> {
  const cfg = loadConfig();
  try {
    const res = await fetch(`${cfg.COMPUTE_SERVICE_URL}/v1/compute/stats`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) throw new Error(`Compute returned ${res.status}`);
    const data = (await res.json()) as {
      total_jobs: number;
      active_jobs: number;
      completed_jobs: number;
      failed_jobs: number;
      cancelled_jobs: number;
      total_spent_qubic: string;
    };
    return {
      totalJobs: data.total_jobs,
      activeJobs: data.active_jobs,
      completedJobs: data.completed_jobs,
      failedJobs: data.failed_jobs,
      cancelledJobs: data.cancelled_jobs,
      totalSpentQubic: BigInt(data.total_spent_qubic),
      source: "live",
    };
  } catch {
    return {
      totalJobs: 0,
      activeJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      cancelledJobs: 0,
      totalSpentQubic: 0n,
      source: "unavailable",
    };
  }
  void since;
}
