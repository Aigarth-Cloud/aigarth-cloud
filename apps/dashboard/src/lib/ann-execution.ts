/**
 * ANN Execution adapter for the internal dashboard.
 *
 *   Wraps the SDK calls to services/ann's new execution routes
 *   (/v1/anns/:idOrSlug/executions, /v1/anns/:idOrSlug/repositories)
 *   into the flat shape the dashboard view expects. All network
 *   errors are caught and surfaced as empty arrays so the page
 *   remains readable even when the ANN service is down.
 */

import { Aigarth } from "../../../../packages/sdk/dist/index.js";

const services = {
  identity:    process.env.AIGARTH_IDENTITY_URL    ?? "http://localhost:7001",
  qubic:       process.env.AIGARTH_QUBIC_URL       ?? "http://localhost:7002",
  compute:     process.env.AIGARTH_COMPUTE_URL     ?? "http://localhost:7003",
  gateway:     process.env.AIGARTH_GATEWAY_URL     ?? "http://localhost:7004",
  billing:     process.env.AIGARTH_BILLING_URL     ?? "http://localhost:7005",
  ann:         process.env.AIGARTH_ANN_URL         ?? "http://localhost:7006",
  marketplace: process.env.AIGARTH_MARKETPLACE_URL ?? "http://localhost:7007",
  tissue:      process.env.AIGARTH_TISSUE_URL      ?? "http://localhost:7008",
  dataset:     process.env.AIGARTH_DATASET_URL     ?? "http://localhost:7009",
};

const SYSTEM_TOKEN = process.env.AIGARTH_DASHBOARD_SYSTEM_TOKEN;

export interface DashboardAnn {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  status: string;
  architecture: string;
  manifestHash: string | null;
  repository: { owner: string; name: string; commitSha: string; publishedAt: string } | null;
  currentVersion: string;
  publishedAt: string | null;
  accuracy: string | null;
  latencyP50Ms: number | null;
}

export interface DashboardExecution {
  executionId: string;
  annSlug: string;
  annVersion: string;
  manifestHash: string;
  target: "local" | "qubic_oc";
  status: "queued" | "running" | "completed" | "failed";
  resultHash: string | null;
  workId: string | null;
  verificationStatus: string;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
}

function getClient(): Aigarth | null {
  // The dashboard pages are public (no auth gate). The ANN service
  // accepts a system token via Authorization header for internal
  // callers. If the token is unset, we fall back to an anonymous
  // call which services/ann's read-only routes will accept.
  const apiKey = SYSTEM_TOKEN ?? "dashboard-anon";
  return new Aigarth({ apiKey, services });
}

export async function loadAnnsWithExecutionInfo(): Promise<DashboardAnn[]> {
  const c = getClient();
  if (!c) return [];
  try {
    const list = (await c.request<{ data: Array<Record<string, unknown>> }>(
      "/v1/anns?limit=100",
      { method: "GET" },
      services.ann,
    ));
    const out: DashboardAnn[] = [];
    for (const ann of list.data ?? []) {
      const slug = (ann.slug as string) ?? (ann.id as string);
      let manifestHash: string | null = null;
      let repository: DashboardAnn["repository"] = null;
      let architecture = "deterministic-stub";
      try {
        const r = (await c.request<{ data: Array<Record<string, unknown>> }>(
          `/v1/anns/${encodeURIComponent(slug)}/repositories`,
          { method: "GET" },
          services.ann,
        ));
        const repo = (r.data ?? [])[0];
        if (repo) {
          manifestHash = (repo.manifest_hash as string) ?? null;
          const url = repo.release_url as string | undefined;
          if (url && url.startsWith("local://manifest/")) {
            architecture = url.slice("local://manifest/".length);
          }
          repository = {
            owner: repo.repo_owner as string,
            name: repo.repo_name as string,
            commitSha: (repo.commit_sha as string) ?? "",
            publishedAt: (repo.published_at as string) ?? "",
          };
        }
      } catch {
        // No repository row — fine.
      }
      out.push({
        id: (ann.id as string) ?? slug,
        slug,
        name: (ann.name as string) ?? slug,
        tagline: (ann.tagline as string) ?? "",
        status: (ann.status as string) ?? "draft",
        architecture,
        manifestHash,
        repository,
        currentVersion: (ann.current_version as string) ?? "v1.0.0",
        publishedAt: (ann.published_at as string) ?? null,
        accuracy: (ann.accuracy as string) ?? null,
        latencyP50Ms: (ann.latency_p50_ms as number) ?? null,
      });
    }
    return out;
  } catch (err) {
    console.error("[dashboard] loadAnnsWithExecutionInfo failed:", err);
    return [];
  }
}

export async function loadRecentExecutions(limit = 50): Promise<DashboardExecution[]> {
  const anns = await loadAnnsWithExecutionInfo();
  const c = getClient();
  if (!c) return [];
  const out: DashboardExecution[] = [];
  for (const ann of anns) {
    try {
      const r = (await c.request<{ data: Array<Record<string, unknown>> }>(
        `/v1/anns/${encodeURIComponent(ann.slug)}/executions?limit=${Math.min(limit, 50)}`,
        { method: "GET" },
        services.ann,
      ));
      for (const row of r.data ?? []) {
        out.push({
          executionId: (row.execution_id as string) ?? "",
          annSlug: ann.slug,
          annVersion: (row.ann_version as string) ?? "",
          manifestHash: (row.manifest_hash as string) ?? "",
          target: (row.target as "local" | "qubic_oc") ?? "local",
          status: (row.status as DashboardExecution["status"]) ?? "queued",
          resultHash: (row.result_hash as string) ?? null,
          workId: (row.work_id as string) ?? null,
          verificationStatus: (row.verification_status as string) ?? "pending",
          error: (row.error as string) ?? null,
          startedAt: (row.started_at as string) ?? "",
          completedAt: (row.completed_at as string) ?? null,
        });
      }
    } catch {
      // No executions for this ANN — fine.
    }
  }
  // Sort newest-first.
  out.sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));
  return out.slice(0, limit);
}

export async function loadExecutionsForAnn(slug: string, limit = 25): Promise<DashboardExecution[]> {
  const c = getClient();
  if (!c) return [];
  try {
    const r = (await c.request<{ data: Array<Record<string, unknown>> }>(
      `/v1/anns/${encodeURIComponent(slug)}/executions?limit=${limit}`,
      { method: "GET" },
      services.ann,
    ));
    return (r.data ?? []).map((row) => ({
      executionId: (row.execution_id as string) ?? "",
      annSlug: slug,
      annVersion: (row.ann_version as string) ?? "",
      manifestHash: (row.manifest_hash as string) ?? "",
      target: (row.target as "local" | "qubic_oc") ?? "local",
      status: (row.status as DashboardExecution["status"]) ?? "queued",
      resultHash: (row.result_hash as string) ?? null,
      workId: (row.work_id as string) ?? null,
      verificationStatus: (row.verification_status as string) ?? "pending",
      error: (row.error as string) ?? null,
      startedAt: (row.started_at as string) ?? "",
      completedAt: (row.completed_at as string) ?? null,
    }));
  } catch (err) {
    console.error(`[dashboard] loadExecutionsForAnn(${slug}) failed:`, err);
    return [];
  }
}
