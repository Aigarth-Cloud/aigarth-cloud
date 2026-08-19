/**
 * /v1/datasets — Aigarth dataset registry.
 *
 *   Phase 19B.6. Surfaces the dataset service (port 7009) to SDK
 *   consumers. Used by the dashboard catalog browse, the marketing
 *   /datasets page, the training service (19C), and any external
 *   consumer that wants to register / list / license a dataset.
 *
 *   const catalog = await client.datasets.catalog({ kind: "tabular" });
 *   const d = await client.datasets.create({ name: "Crop Yields 2024", kind: "tabular" });
 *   await client.datasets.uploadVersion(d.id, "1.0.0", file);
 */
import { BaseResource, toQueryString } from "./_base.js";
import type {
  Dataset,
  DatasetVersion,
  DatasetStatus,
  ListDatasetsParams,
  ListDatasetsResponse,
  ListDatasetVersionsResponse,
  CreateDatasetParams,
  UpdateDatasetParams,
} from "../types/dataset.js";

export class Datasets extends BaseResource {
  // ---------- Public ----------

  /** List datasets (with optional filters). Use the public catalog
   *  endpoint for the user-facing catalog page. */
  async list(params: ListDatasetsParams = {}): Promise<ListDatasetsResponse> {
    const query = toQueryString({
      kind: params.kind,
      license: params.license,
      status: params.status,
      owner: params.owner,
      search: params.search,
      sort: params.sort,
      limit: params.limit,
      offset: params.offset,
    });
    return this.request<ListDatasetsResponse>(`/v1/datasets${query}`, { method: "GET" });
  }

  /** The public catalog — equivalent to list({ status: "public" }). */
  async catalog(params: Omit<ListDatasetsParams, "status" | "owner"> = {}): Promise<ListDatasetsResponse> {
    const query = toQueryString({
      kind: params.kind,
      license: params.license,
      search: params.search,
      sort: params.sort,
      limit: params.limit,
      offset: params.offset,
    });
    return this.request<ListDatasetsResponse>(`/v1/datasets/catalog${query}`, { method: "GET" });
  }

  async retrieve(idOrSlug: string): Promise<Dataset> {
    return this.request<Dataset>(`/v1/datasets/${encodeURIComponent(idOrSlug)}`, { method: "GET" });
  }

  async listVersions(
    idOrSlug: string,
    params: { limit?: number; offset?: number } = {},
  ): Promise<ListDatasetVersionsResponse> {
    const query = toQueryString({ limit: params.limit, offset: params.offset });
    return this.request<ListDatasetVersionsResponse>(
      `/v1/datasets/${encodeURIComponent(idOrSlug)}/versions${query}`,
      { method: "GET" },
    );
  }

  // ---------- Authenticated (mutation) ----------

  async create(params: CreateDatasetParams): Promise<Dataset> {
    return this.request<Dataset>("/v1/datasets", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async update(idOrSlug: string, params: UpdateDatasetParams): Promise<Dataset> {
    return this.request<Dataset>(`/v1/datasets/${encodeURIComponent(idOrSlug)}`, {
      method: "PATCH",
      body: JSON.stringify(params),
    });
  }

  async changeStatus(idOrSlug: string, status: DatasetStatus): Promise<Dataset> {
    return this.request<Dataset>(`/v1/datasets/${encodeURIComponent(idOrSlug)}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
  }

  /**
   * Upload a new version of a dataset.
   *
   * `file` is a File (browser) or a Blob / Buffer (Node) — the
   * service accepts anything multipart-compatible. `version` must
   * be semver. If the same (dataset, version) pair already exists
   * with the same content hash, the existing version is returned
   * (idempotent re-upload). A different content hash on the same
   * version is rejected with 409.
   */
  async uploadVersion(
    idOrSlug: string,
    args: { version: string; file: Blob | File | ArrayBuffer; changelog?: string },
  ): Promise<DatasetVersion> {
    const form = new FormData();
    form.set("version", args.version);
    if (args.changelog) form.set("changelog", args.changelog);
    const blob =
      args.file instanceof Blob
        ? args.file
        : new Blob([args.file as ArrayBuffer]);
    form.set("file", blob, "dataset");
    return this.request<DatasetVersion>(
      `/v1/datasets/${encodeURIComponent(idOrSlug)}/versions`,
      { method: "POST", body: form },
    );
  }
}
