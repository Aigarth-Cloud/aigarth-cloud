/**
 * Dataset types — Phase 19B.6.
 *
 * Mirrors the wire shape returned by `services/dataset`. The dataset
 * service ships the canonical records; the SDK exposes them as
 * typed JS objects.
 */

export type DatasetKind =
  | "tabular"
  | "text"
  | "image"
  | "audio"
  | "time_series"
  | "multimodal"
  | "other";

export type DatasetLicense =
  | "open"
  | "cc_by"
  | "cc_by_sa"
  | "commercial"
  | "custom";

export type DatasetStatus = "draft" | "private" | "public" | "deprecated";

export type DatasetAccessMode = "read" | "derive";

/** A dataset record. The shape returned by /v1/datasets endpoints. */
export interface Dataset {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  owner_user_id: string;
  owner_org_id: string | null;
  kind: DatasetKind;
  license: DatasetLicense;
  source: string | null;
  status: DatasetStatus;
  created_at: string;
  updated_at: string;
}

/** The inferred schema for a dataset version. */
export interface DatasetSchema {
  kind: "tabular" | "text" | "image" | "audio" | "time_series" | "multimodal" | "other";
  columns?: Array<{
    name: string;
    type: "string" | "number" | "boolean" | "date" | "json";
    nullable?: boolean;
  }>;
  sampleUri?: string;
  mimeType?: string;
  encoding?: string;
  notes?: string;
}

/** A content-hashed version of a dataset. */
export interface DatasetVersion {
  id: string;
  dataset_id: string;
  version: string;
  object_key: string;
  content_hash: string;
  size_bytes: number;
  row_count: number | null;
  schema: DatasetSchema;
  changelog: string | null;
  created_at: string;
}

/** A per-grant access row. */
export interface DatasetAccess {
  id: string;
  dataset_id: string;
  grantee_user_id: string | null;
  mode: DatasetAccessMode;
  expires_at: string | null;
  revoked_at: string | null;
  granted_by: string;
  granted_at: string;
}

/** List response shape (matches the service response). */
export interface ListDatasetsResponse {
  data: Dataset[];
  total: number;
  limit: number;
  offset: number;
}

export interface ListDatasetVersionsResponse {
  data: DatasetVersion[];
  total: number;
  limit: number;
  offset: number;
}

export interface ListDatasetsParams {
  limit?: number;
  offset?: number;
  kind?: DatasetKind;
  license?: DatasetLicense;
  status?: DatasetStatus;
  owner?: string;
  search?: string;
  sort?: "newest" | "oldest" | "name";
}

export interface CreateDatasetParams {
  name: string;
  slug?: string;
  description?: string;
  kind: DatasetKind;
  license?: DatasetLicense;
  source?: string;
  status?: DatasetStatus;
  owner_org_id?: string;
}

export interface UpdateDatasetParams {
  name?: string;
  description?: string;
  license?: DatasetLicense;
  source?: string;
}
