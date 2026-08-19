/**
 * ANN service client (Phase 19C.6).
 *
 * Two implementations:
 *   - `StubAnnClient` — in-memory simulation. Maintains fake
 *     version histories per ANN. Lets 19C.6 be testable end-to-end
 *     without a real ann service.
 *   - `HttpAnnClient` — calls services/ann. Used in production.
 *
 * The factory picks one based on TRAINING_COMPUTE_MODE (shared
 * with the compute client — they have the same stub/http split).
 */

import { randomUUID } from "node:crypto";
import { loadConfig } from "../config/index.js";

// ---------- Shared types ----------

export interface AnnVersionHandle {
  id: string;
  version: string;
  annId: string;
  isLatest: boolean;
}

export interface CreateAnnVersionInput {
  version: string;
  changelog?: string;
  artifactUrl: string;
  artifactSizeBytes: number;
  artifactHash: string;
  trainingComputeJobId?: string;
  trainingDatasetHash?: string;
  hyperparameters: Record<string, unknown>;
  metrics: Record<string, unknown>;
  isLatest: boolean;
}

export interface AnnInfo {
  id: string;
  currentVersionId: string | null;
  currentVersion: string | null;
}

export interface AnnClient {
  readonly mode: "stub" | "http";
  getAnn(annId: string): Promise<AnnInfo | null>;
  createVersion(annId: string, input: CreateAnnVersionInput): Promise<AnnVersionHandle>;
  promoteVersion(annId: string, versionId: string): Promise<void>;
  /**
   * Phase 19D.2 — enqueue a retrain job for an ANN. The ann service
   * calls the training service's `POST /v1/training/jobs` endpoint
   * to actually start the work. We expose this as a method on the
   * ann client so the retrain trigger logic (which lives in the ann
   * service for 19D.2) can stay simple.
   */
  triggerRetrain(
    annId: string,
    input: { reason: "drift" | "low_volume" | "manual"; datasetVersionId?: string | null },
  ): Promise<{ trainingJobId: string }>;
}

// ---------- StubAnnClient ----------

/**
 * In-memory ANN client. Each ANN has a list of versions; the
 * latest one is tracked. Operations are O(1) (Map lookup) plus
 * a small array shift for promotion.
 */
export class StubAnnClient implements AnnClient {
  readonly mode = "stub" as const;
  private anns = new Map<string, AnnInfo>();
  private versions = new Map<string, AnnVersionHandle[]>();

  async getAnn(annId: string): Promise<AnnInfo | null> {
    return this.anns.get(annId) ?? null;
  }

  async createVersion(annId: string, input: CreateAnnVersionInput): Promise<AnnVersionHandle> {
    // If the ANN doesn't exist yet, create a stub entry.
    if (!this.anns.has(annId)) {
      this.anns.set(annId, { id: annId, currentVersionId: null, currentVersion: null });
      this.versions.set(annId, []);
    }
    // If `isLatest`, demote the previous latest.
    if (input.isLatest) {
      const list = this.versions.get(annId) ?? [];
      for (const v of list) v.isLatest = false;
    }
    const handle: AnnVersionHandle = {
      id: randomUUID(),
      version: input.version,
      annId,
      isLatest: input.isLatest,
    };
    const list = this.versions.get(annId) ?? [];
    list.push(handle);
    this.versions.set(annId, list);
    if (input.isLatest) {
      this.anns.set(annId, {
        id: annId,
        currentVersionId: handle.id,
        currentVersion: handle.version,
      });
    }
    // eslint-disable-next-line no-console
    console.log(`[ann:stub] createVersion ann=${annId} version=${handle.version} id=${handle.id}`);
    return handle;
  }

  async promoteVersion(annId: string, versionId: string): Promise<void> {
    const list = this.versions.get(annId) ?? [];
    for (const v of list) v.isLatest = v.id === versionId;
    const promoted = list.find((v) => v.id === versionId);
    if (promoted) {
      this.anns.set(annId, {
        id: annId,
        currentVersionId: promoted.id,
        currentVersion: promoted.version,
      });
    }
    // eslint-disable-next-line no-console
    console.log(`[ann:stub] promoteVersion ann=${annId} version=${promoted?.version}`);
  }

  async triggerRetrain(
    annId: string,
    input: { reason: "drift" | "low_volume" | "manual"; datasetVersionId?: string | null },
  ): Promise<{ trainingJobId: string }> {
    const trainingJobId = randomUUID();
    // eslint-disable-next-line no-console
    console.log(
      `[ann:stub] triggerRetrain ann=${annId} reason=${input.reason} ` +
        `datasetVersionId=${input.datasetVersionId ?? "default"} ` +
        `trainingJobId=${trainingJobId}`,
    );
    return { trainingJobId };
  }

  /** Test-only: list versions for an ANN. */
  __listVersions(annId: string): AnnVersionHandle[] {
    return [...(this.versions.get(annId) ?? [])];
  }
}

// ---------- HttpAnnClient ----------

export class HttpAnnClient implements AnnClient {
  readonly mode = "http" as const;
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.token}`,
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`ann ${init.method ?? "GET"} ${path} -> ${res.status} ${text}`);
    }
    return (await res.json()) as T;
  }

  async getAnn(annId: string): Promise<AnnInfo | null> {
    try {
      const data = await this.request<{ id: string; current_version_id?: string; current_version?: string }>(
        `/v1/anns/${encodeURIComponent(annId)}`,
      );
      return {
        id: data.id,
        currentVersionId: data.current_version_id ?? null,
        currentVersion: data.current_version ?? null,
      };
    } catch (err) {
      if (err instanceof Error && err.message.includes("-> 404")) return null;
      throw err;
    }
  }

  async createVersion(annId: string, input: CreateAnnVersionInput): Promise<AnnVersionHandle> {
    const data = await this.request<{ id: string; version: string; is_latest: boolean }>(
      `/v1/anns/${encodeURIComponent(annId)}/versions`,
      { method: "POST", body: JSON.stringify(input) },
    );
    return { id: data.id, version: data.version, annId, isLatest: data.is_latest };
  }

  async promoteVersion(annId: string, versionId: string): Promise<void> {
    await this.request(
      `/v1/anns/${encodeURIComponent(annId)}/versions/${encodeURIComponent(versionId)}/promote`,
      { method: "POST" },
    );
  }

  async triggerRetrain(
    annId: string,
    input: { reason: "drift" | "low_volume" | "manual"; datasetVersionId?: string | null },
  ): Promise<{ trainingJobId: string }> {
    // In HTTP mode the ann service is actually a caller of the training
    // service (the trigger logic lives in the ann service). This method
    // is here for the symmetric case where training wants to ask ann
    // to enqueue a retrain — but for 19D.2 the direction is ann → training.
    // So this is a no-op stub; the real entry point is the ann service's
    // manual retrain endpoint which calls back into the training service.
    // We log + return a fake id so the contract stays stable.
    // eslint-disable-next-line no-console
    console.log(`[ann:http] triggerRetrain (no-op in http mode) ann=${annId} reason=${input.reason}`);
    return { trainingJobId: `noop-${randomUUID()}` };
  }
}

// ---------- Factory ----------

let cached: AnnClient | null = null;

export function getAnnClient(): AnnClient {
  if (cached) return cached;
  const cfg = loadConfig();
  // Reuse TRAINING_COMPUTE_MODE: the bridge clients are
  // symmetric (same auth pattern, same stub/http split).
  if (cfg.TRAINING_COMPUTE_MODE === "http") {
    cached = new HttpAnnClient(cfg.TRAINING_ANN_BASE_URL, cfg.ANN_INTERNAL_TOKEN);
  } else {
    cached = new StubAnnClient();
  }
  return cached;
}

/** Test-only: clear the cached client. */
export function __resetAnnClientForTests(): void {
  cached = null;
}
