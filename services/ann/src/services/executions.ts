/**
 * Execution service — the route-facing wrapper around the
 * Execution Router. Handles:
 *
 *   - The `/v1/anns/:idOrSlug/execute` request
 *   - The `/v1/anns/:idOrSlug/executions` and `/:execId` queries
 *   - Resolution of an ANN slug/uuid to an internal id
 *   - The publish-stub route (`/v1/anns/:id/publish`) that
 *     returns "not configured" until the GitHub App flow is wired
 *
 * The actual executor lives in `services/execution/`. This file
 * is the boundary between the route layer and the executor layer,
 * so the route file is small and the executors are testable in
 * isolation.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db/index.js";
import {
  annExecutions,
  anns,
  annRepositories,
  annVersions,
  type AnnExecution,
  type AnnRepository,
} from "../db/schema.js";
import { getExecutionRouter } from "./execution/router.js";
import { AnnExecutorError } from "./execution/types.js";
import type { ANNExecutionRequest } from "./execution/types.js";
import { parseAnnManifest } from "../types/ann-manifest.js";

// ---------- Errors ----------

export class AnnNotFoundForExecutionError extends Error {
  public override readonly name = "AnnNotFoundForExecutionError";
  constructor(idOrSlug: string) {
    super(`ANN '${idOrSlug}' not found.`);
  }
}

export class AnnNoPublishedVersionError extends Error {
  public override readonly name = "AnnNoPublishedVersionError";
  constructor(idOrSlug: string) {
    super(`ANN '${idOrSlug}' has no published version.`);
  }
}

export class AnnManifestMismatchError extends Error {
  public override readonly name = "AnnManifestMismatchError";
  constructor(provided: string, expected: string) {
    super(`Provided manifest_hash '${provided}' does not match the version's manifest_hash '${expected}'.`);
  }
}

// ---------- DTOs ----------

export interface ExecuteAnnInput {
  /** Caller's manifest hash. Must match the version's manifest. */
  manifestHash: string;
  /** Semver (vX.Y.Z). */
  version: string;
  /** The executor to use. */
  target: "local" | "qubic_oc";
  /** Caller's request id. */
  requestId: string;
  /** The input payload. */
  input: Record<string, unknown>;
  /** Optional execution parameters. */
  parameters?: {
    timeoutMs?: number;
    replicas?: number;
    deterministic?: boolean;
    rewardQubic?: string;
  };
  /** JWT sub of the caller. */
  requestedByUserId?: string;
}

export interface ListExecutionsInput {
  status?: "queued" | "running" | "completed" | "failed";
  target?: "local" | "qubic_oc";
  limit?: number;
  offset?: number;
}

// ---------- ANN + version resolution ----------

async function resolveAnnId(idOrSlug: string): Promise<{ annId: string; versionId: string; version: string }> {
  const db = getDb();
  const annRows = await db
    .select({ id: anns.id })
    .from(anns)
    .where(sql`${anns.id}::text = ${idOrSlug} OR ${anns.slug} = ${idOrSlug}`)
    .limit(1);
  if (!annRows[0]) {
    throw new AnnNotFoundForExecutionError(idOrSlug);
  }
  const annId = annRows[0].id;
  // Pick the latest published version (or the one matching the caller's
  // request, if the caller didn't pin it). For the v1 endpoint, the
  // caller always pins via `version`.
  return { annId, versionId: "", version: "" };
}

async function resolveAnnVersion(
  annId: string,
  version: string,
  expectedManifestHash: string,
): Promise<{ versionId: string; version: string }> {
  const db = getDb();
  const rows = await db
    .select({ id: annVersions.id, version: annVersions.version })
    .from(annVersions)
    .where(and(eq(annVersions.annId, annId), eq(annVersions.version, version)))
    .limit(1);
  if (!rows[0]) {
    throw new AnnNoPublishedVersionError(annId);
  }
  // The version row's stored manifest_hash is on ann_repositories;
  // verify by looking up the repository for (annId, versionId).
  const repo = await db
    .select({ manifestHash: annRepositories.manifestHash })
    .from(annRepositories)
    .where(and(eq(annRepositories.annId, annId), eq(annRepositories.annVersionId, rows[0].id)))
    .limit(1);
  const storedHash = repo[0]?.manifestHash;
  if (!storedHash) {
    throw new AnnManifestMismatchError(expectedManifestHash, "<no repository row>");
  }
  if (storedHash !== expectedManifestHash) {
    throw new AnnManifestMismatchError(expectedManifestHash, storedHash);
  }
  return { versionId: rows[0].id, version: rows[0].version };
}

// ---------- Submit ----------

export async function submitExecution(
  idOrSlug: string,
  input: ExecuteAnnInput,
): Promise<{ executionId: string; status: string }> {
  const ann = await resolveAnnId(idOrSlug);
  const ver = await resolveAnnVersion(ann.annId, input.version, input.manifestHash);

  // Build the canonical request. The `parameters.architecture` is
  // looked up from the ann_repositories row (so the executor can find
  // the adapter). For v1, the architecture is stored in the
  // manifest_hash's source — we re-derive it from the repository's
  // stored description metadata. Phase 30+: store the manifest body
  // (or a compact projection) on the repository row.
  const db = getDb();
  const repoRows = await db
    .select()
    .from(annRepositories)
    .where(
      and(
        eq(annRepositories.annId, ann.annId),
        eq(annRepositories.annVersionId, ver.versionId),
      ),
    )
    .limit(1);
  const repo = repoRows[0];
  if (!repo) {
    throw new AnnManifestMismatchError(input.manifestHash, "<no repository row>");
  }

  // The architecture lives in the manifest body, but the v1 DB row
  // does not store the full manifest. We extract it from the
  // repository's `releaseUrl` if present (the seed encodes the
  // architecture in the releaseUrl pattern). For unseeded ANNs we
  // fall back to "deterministic-stub".
  const architecture = deriveArchitectureFromRepository(repo);

  const request: ANNExecutionRequest = {
    annId: ann.annId,
    annVersion: ver.version,
    manifestHash: input.manifestHash,
    requestId: input.requestId,
    target: input.target,
    input: input.input,
    parameters: {
      architecture,
      ...(input.parameters?.timeoutMs ? { timeoutMs: input.parameters.timeoutMs } : {}),
      ...(input.parameters?.replicas ? { replicas: input.parameters.replicas } : {}),
      ...(input.parameters?.deterministic !== undefined
        ? { deterministic: input.parameters.deterministic }
        : {}),
      ...(input.parameters?.rewardQubic ? { rewardQubic: BigInt(input.parameters.rewardQubic) } : {}),
    },
    requestedByUserId: input.requestedByUserId,
  };

  // Dispatch. The router/executor persists the row itself; this
  // service just returns the execution id. Note: for OC, the
  // executor may still be in "running" status when this returns
  // (the polling continues in the background). The caller can poll
  // /v1/anns/:id/executions/:execId to fetch the final state.
  const router = getExecutionRouter();
  const result = await router.execute(request);

  return { executionId: result.executionId, status: result.status };
}

function deriveArchitectureFromRepository(repo: AnnRepository): string {
  // The seed sets releaseUrl to `local://manifest/<arch>` for the
  // demo BTC predictor. We use this as the v1 channel.
  if (repo.releaseUrl && repo.releaseUrl.startsWith("local://manifest/")) {
    return repo.releaseUrl.slice("local://manifest/".length);
  }
  return "deterministic-stub";
}

// ---------- List + get ----------

export async function listExecutions(
  idOrSlug: string,
  filter: ListExecutionsInput,
): Promise<{ data: AnnExecution[]; total: number; limit: number; offset: number }> {
  const db = getDb();
  const ann = await resolveAnnId(idOrSlug);
  const conditions = [eq(annExecutions.annId, ann.annId)];
  if (filter.status) conditions.push(eq(annExecutions.status, filter.status));
  if (filter.target) conditions.push(eq(annExecutions.target, filter.target));
  const where = and(...conditions);
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const offset = Math.max(filter.offset ?? 0, 0);
  const [data, totalRow] = await Promise.all([
    db
      .select()
      .from(annExecutions)
      .where(where)
      .orderBy(desc(annExecutions.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: sql<number>`count(*)::int` }).from(annExecutions).where(where),
  ]);
  return { data, total: totalRow[0]?.value ?? 0, limit, offset };
}

export async function getExecution(
  idOrSlug: string,
  execIdOrAxeId: string,
): Promise<AnnExecution | null> {
  const db = getDb();
  const ann = await resolveAnnId(idOrSlug);
  // Resolve either the database row id (uuid) or the public axe_ id.
  const rows = await db
    .select()
    .from(annExecutions)
    .where(
      and(
        eq(annExecutions.annId, ann.annId),
        sql`(${annExecutions.id}::text = ${execIdOrAxeId} OR ${annExecutions.executionId} = ${execIdOrAxeId})`,
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

// ---------- Repositories ----------

export interface AttachRepositoryInput {
  annId: string;
  annVersionId: string;
  repoOwner: string;
  repoName: string;
  commitSha: string;
  manifestHash: string;
  releaseTag?: string;
  releaseUrl?: string;
  publicationKind?: "seed" | "github_app";
}

/** Idempotent: re-attach with the same (repo, commit, manifest) is a no-op. */
export async function attachRepository(input: AttachRepositoryInput): Promise<AnnRepository> {
  const db = getDb();
  const existing = await db
    .select()
    .from(annRepositories)
    .where(
      and(
        eq(annRepositories.repoOwner, input.repoOwner),
        eq(annRepositories.repoName, input.repoName),
        eq(annRepositories.commitSha, input.commitSha),
        eq(annRepositories.manifestHash, input.manifestHash),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0];
  const [row] = await db
    .insert(annRepositories)
    .values({
      annId: input.annId,
      annVersionId: input.annVersionId,
      repoOwner: input.repoOwner,
      repoName: input.repoName,
      commitSha: input.commitSha,
      manifestHash: input.manifestHash,
      releaseTag: input.releaseTag ?? null,
      releaseUrl: input.releaseUrl ?? null,
      publicationKind: input.publicationKind ?? "seed",
    })
    .returning();
  if (!row) throw new Error("attachRepository: failed to insert row");
  return row;
}

export async function listRepositories(idOrSlug: string): Promise<AnnRepository[]> {
  const db = getDb();
  const ann = await resolveAnnId(idOrSlug);
  return db
    .select()
    .from(annRepositories)
    .where(eq(annRepositories.annId, ann.annId))
    .orderBy(desc(annRepositories.publishedAt));
}

// ---------- Publish (stub) ----------
//
// Per the user-scope decision: GitHub publishing is OUT of scope for
// this session. The route returns a clear "not_configured" response so
// the UI can surface a friendly message.

export interface PublishAnnInput {
  version: string;
  repoOwner: string;
  repoName: string;
  commitSha: string;
  releaseTag?: string;
}

export async function publishAnnStub(
  idOrSlug: string,
  input: PublishAnnInput,
): Promise<{ status: "not_configured"; message: string }> {
  void idOrSlug;
  void input;
  return {
    status: "not_configured",
    message:
      "GitHub publishing is deferred. Set GITHUB_APP_ID + GITHUB_PRIVATE_KEY + GITHUB_INSTALLATION_ID in the operator .env, then enable the publishing flow in services/ann/src/services/github/publish.ts.",
  };
}

// ---------- Serializer (matches the existing /v1/anns response shape) ----------

export function serializeExecution(row: AnnExecution): Record<string, unknown> {
  return {
    execution_id: row.executionId,
    ann_id: row.annId,
    ann_version_id: row.annVersionId,
    ann_version: row.annVersion,
    manifest_hash: row.manifestHash,
    request_id: row.requestId,
    target: row.target,
    status: row.status,
    input_hash: row.inputHash,
    input_uri: row.inputUri,
    input_size_bytes: row.inputSizeBytes.toString(),
    output: row.outputJson,
    result_hash: row.resultHash,
    work_id: row.workId,
    completed_by: row.completedBy,
    verification_status: row.verificationStatus,
    error: row.error,
    requested_by_user_id: row.requestedByUserId,
    started_at: row.startedAt.toISOString(),
    completed_at: row.completedAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function serializeRepository(row: AnnRepository): Record<string, unknown> {
  return {
    id: row.id,
    ann_id: row.annId,
    ann_version_id: row.annVersionId,
    repo_owner: row.repoOwner,
    repo_name: row.repoName,
    commit_sha: row.commitSha,
    manifest_hash: row.manifestHash,
    release_tag: row.releaseTag,
    release_url: row.releaseUrl,
    publication_kind: row.publicationKind,
    published_at: row.publishedAt.toISOString(),
  };
}

// Re-export for the route layer
export { AnnExecutorError };
export { parseAnnManifest };
// Re-export for test convenience
export const __test_helpers = { resolveAnnId, resolveAnnVersion, attachRepository };
