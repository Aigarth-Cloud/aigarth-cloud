/**
 * QubicOCExecutor — submits the ANN execution workload to the
 * Outsourced Computation engine (services/work, port 7012) and
 * polls until the work item reaches a terminal state.
 *
 * Flow:
 *
 *   1. POST /v1/internal/work/items on services/work with the
 *      standard SubmitWorkItemSchema. The work service schedules
 *      the item, registers the algorithm (aigarth-oc-algorithm by
 *      default), assigns a worker, runs the container, verifies
 *      the result (replication or deterministic re-run), and
 *      marks the work item `verified` / `disputed` / `failed`.
 *
 *   2. The executor records the work_id on the ann_executions row
 *      and persists the row as `status: "running"`.
 *
 *   3. The executor polls GET /v1/internal/work/items/:work_id
 *      every ~2 s until the work item reaches a terminal status
 *      (verified, disputed, failed) or the timeout elapses.
 *
 *   4. On terminal status, the executor updates the ann_executions
 *      row with the output, result hash, and verification status.
 *      The result returned to the caller reflects the terminal
 *      state. If the work item is still running past the timeout,
 *      the executor returns a `status: "running"` result and the
 *      caller is expected to call `getExecution(executionId)`
 *      to fetch the final state.
 *
 * Failure modes (per superprompt §24):
 *   - services/work is down → AnnExecutorError(executor_unavailable)
 *   - submission rejected → AnnExecutorError(invalid_input)
 *   - timeout → result with status "running", error message
 *   - work item disputed → verificationStatus "disputed"
 *   - work item failed → status "failed"
 *   - 451/676 signature bundle (future Qubic-side OC) → we
 *     record the invocation hash on the ann_execution row
 *
 * The executor NEVER falls back to local execution. A failed
 * decentralized execution must remain visibly failed (per
 * superprompt §24 — "Never silently fall back from Qubic OC to
 * Local").
 */

import { eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { AnnExecutor, ANNExecutionRequest, ANNExecutionResult, ExecutionParameters } from "./types.js";
import { AnnExecutorError } from "./types.js";
import { inputHash, resultHash } from "./result-hash.js";
import { loadConfig } from "../../config/index.js";
import { getDb } from "../../db/index.js";
import { annExecutions, type AnnExecution } from "../../db/schema.js";
import { executionId as newExecutionId } from "../../lib/ids.js";
import { logActivity, auditAction } from "../../lib/audit.js";
import { stableStringify } from "../../lib/serialize.js";

const POLL_INTERVAL_MS = 2_000;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 600_000; // 10 min hard cap

const INFO = { id: "qubic_oc", model: "services/work@aigarth-oc-algorithm", version: "1.0.0" } as const;

/** Stable JSON stringify with sorted keys. */
function canon(value: unknown): string {
  return stableStringify(value);
}

interface WorkSubmitResponse {
  work_id: string;
  status: string;
  type: string;
}

interface WorkGetResponse extends WorkSubmitResponse {
  input_hash: string;
  input_uri: string;
  algorithm_name: string;
  algorithm_version: string;
  verification_method: string;
  result: null | {
    payload_hash: string;
    completed_by: string | null;
    completed_at: string | null;
    replicas_agreed: string | null;
  };
}

export class QubicOCExecutor implements AnnExecutor {
  info() {
    return INFO;
  }

  async execute(request: ANNExecutionRequest): Promise<ANNExecutionResult> {
    const cfg = loadConfig();
    const startedAt = new Date();

    // 1. Persist a queued row.
    const row = await this.persistQueuedRow(request, startedAt);

    // 2. Submit the work item.
    let workId: string;
    try {
      const submitted = await this.submitWorkItem(request, cfg.WORK_SERVICE_URL, cfg.INTERNAL_TOKEN ?? process.env.INTERNAL_TOKEN);
      workId = submitted.work_id;
    } catch (err) {
      await this.markFailed(row.id, {
        error: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      });
      throw err;
    }

    // 3. Update the row with the work_id.
    await this.attachWorkId(row.id, workId);

    // 4. Poll until terminal or timeout.
    const timeoutMs = Math.min(
      request.parameters?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      MAX_TIMEOUT_MS,
    );
    const deadline = Date.now() + timeoutMs;
    let lastSeen: WorkGetResponse | null = null;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      try {
        lastSeen = await this.getWorkItem(workId, cfg.WORK_SERVICE_URL, cfg.INTERNAL_TOKEN ?? process.env.INTERNAL_TOKEN);
      } catch (err) {
        // Network blip — keep polling until the deadline.
        lastSeen = null;
        continue;
      }
      if (isTerminal(lastSeen.status)) {
        return await this.finalize(row.id, request, lastSeen, startedAt);
      }
    }
    // Timeout. Return a "still running" result.
    return {
      executionId: row.executionId,
      annId: request.annId,
      annVersion: request.annVersion,
      manifestHash: request.manifestHash,
      target: "qubic_oc",
      status: "running",
      workId,
      verificationStatus: "pending",
      error: lastSeen ? undefined : "Polling failed; work service unreachable",
      startedAt: startedAt.toISOString(),
    };
  }

  // ---------- HTTP ----------

  private async submitWorkItem(
    request: ANNExecutionRequest,
    baseUrl: string,
    internalToken: string | undefined,
  ): Promise<WorkSubmitResponse> {
    const params = request.parameters ?? {};
    const submitBody = this.buildSubmitBody(request, params);
    const res = await fetch(`${baseUrl}/v1/internal/work/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(internalToken ? { Authorization: `Bearer ${internalToken}` } : {}),
        "X-Caller-User": request.requestedByUserId ?? "service:ann",
      },
      body: JSON.stringify(submitBody),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new AnnExecutorError(
        `QubicOCExecutor: work service rejected submission — ${res.status} ${res.statusText} — ${detail.slice(0, 500)}`,
        "executor_unavailable",
      );
    }
    return (await res.json()) as WorkSubmitResponse;
  }

  private async getWorkItem(
    workId: string,
    baseUrl: string,
    internalToken: string | undefined,
  ): Promise<WorkGetResponse> {
    const res = await fetch(`${baseUrl}/v1/internal/work/items/${encodeURIComponent(workId)}`, {
      method: "GET",
      headers: internalToken ? { Authorization: `Bearer ${internalToken}` } : {},
    });
    if (!res.ok) {
      throw new AnnExecutorError(
        `QubicOCExecutor: failed to fetch work item — ${res.status} ${res.statusText}`,
        "executor_unavailable",
      );
    }
    return (await res.json()) as WorkGetResponse;
  }

  /**
   * Map an ANN execution request to a SubmitWorkItem envelope. The
   * algorithm slug is `aigarth-oc-algorithm` (registered by
   * services/work at startup) and the verification method is
   * `deterministic` if the request asks for it, otherwise
   * `replication` with 3 replicas.
   *
   * The input payload is uploaded to the OC service's input_uri.
   * For Phase 29, we ship the input inline as a data URL; the
   * work service treats it as opaque and the worker (a stub
   * Docker container) can parse it. v2 will switch to MinIO +
   * signed GET.
   */
  private buildSubmitBody(
    request: ANNExecutionRequest,
    params: ExecutionParameters,
  ): Record<string, unknown> {
    const payloadString = canon(request.input);
    const payloadHash = inputHash(request.input);
    const dataUri = `data:application/json;base64,${Buffer.from(payloadString, "utf-8").toString("base64")}`;
    const deterministic = params.deterministic ?? true;
    return {
      type: "ann_execution",
      spec_version: 1,
      input: {
        payload_hash: payloadHash,
        payload_uri: dataUri,
        payload_size_bytes: Buffer.byteLength(payloadString, "utf-8"),
      },
      algorithm: {
        name: "aigarth-oc-algorithm",
        version: "v1.0.0",
        container: "aigarth-cloud/ann-executor:v1.0.0",
        deterministic,
      },
      requirements: {
        cpu_cores: 1,
        memory_gb: 1,
        gpu: "none",
        gpu_kind: "any",
        estimated_runtime_s: Math.max(1, Math.ceil((params.timeoutMs ?? DEFAULT_TIMEOUT_MS) / 1000)),
      },
      verification: {
        method: deterministic ? "deterministic" : "replication",
        replicas: deterministic ? 1 : Math.max(2, Math.min(5, params.replicas ?? 3)),
      },
      reward: {
        currency: "QUBIC",
        amount: (params.rewardQubic ?? BigInt(0)).toString(),
        payer: request.requestedByUserId ?? "service:ann",
      },
    };
  }

  // ---------- DB ----------

  private async persistQueuedRow(
    request: ANNExecutionRequest,
    startedAt: Date,
  ): Promise<AnnExecution> {
    const db = getDb();
    const annVersionId = await this.resolveAnnVersionId(request.annId, request.annVersion);
    const id = newExecutionId();
    const iHash = inputHash(request.input);
    const [row] = await db
      .insert(annExecutions)
      .values({
        executionId: id,
        annId: request.annId,
        annVersionId,
        annVersion: request.annVersion,
        manifestHash: request.manifestHash,
        requestId: request.requestId,
        target: "qubic_oc",
        status: "running",
        inputHash: iHash,
        inputUri: "in-memory://input",
        inputSizeBytes: BigInt(canon(request.input).length),
        requestedByUserId: request.requestedByUserId ?? null,
        startedAt,
        verificationStatus: "pending",
      })
      .returning();
    if (!row) throw new AnnExecutorError("QubicOCExecutor: failed to persist execution row", "internal");
    await logActivity(db, {
      actorUserId: request.requestedByUserId ?? null,
      action: auditAction.executionSubmitted,
      targetType: "ann_execution",
      targetId: id,
      metadata: { annId: request.annId, executionId: id, target: "qubic_oc", annVersion: request.annVersion },
    });
    return row;
  }

  private async attachWorkId(rowId: string, workId: string): Promise<void> {
    const db = getDb();
    await db
      .update(annExecutions)
      .set({ workId, updatedAt: new Date() })
      .where(eq(annExecutions.id, rowId));
  }

  private async markFailed(rowId: string, fields: { error: string; completedAt: Date }): Promise<void> {
    const db = getDb();
    await db
      .update(annExecutions)
      .set({
        status: "failed",
        error: fields.error,
        completedAt: fields.completedAt,
        verificationStatus: "failed",
        updatedAt: new Date(),
      })
      .where(eq(annExecutions.id, rowId));
  }

  private async finalize(
    rowId: string,
    request: ANNExecutionRequest,
    work: WorkGetResponse,
    startedAt: Date,
  ): Promise<ANNExecutionResult> {
    const db = getDb();
    const completedAt = new Date();
    const isVerified = work.status === "verified";
    const isDisputed = work.status === "disputed";
    const isFailed = work.status === "failed";

    // The OC result carries only a payload_hash. For the deterministic
    // result hash we need the *output* object. The work service does
    // not return the output body in the GET — only the hash. We
    // reconstruct a synthetic output from the hash + work id so the
    // result hash is reproducible, and we mark `output.body` as
    // "available at <workId>" so the caller can fetch it via the
    // work service if they need the raw payload.
    const syntheticOutput: Record<string, unknown> = {
      source: "qubic_oc",
      work_id: work.work_id,
      status: work.status,
      payload_hash: work.result?.payload_hash ?? null,
      replicas_agreed: work.result?.replicas_agreed ?? null,
      completed_by: work.result?.completed_by ?? null,
      completed_at: work.result?.completed_at ?? null,
      note:
        "The OC engine returns a payload_hash, not the raw output body. " +
        "Fetch the output via GET /v1/internal/work/items/:work_id or " +
        "the work service's public GET /v1/work/items/:work_id.",
    };
    const hash = resultHash({
      manifestHash: request.manifestHash,
      annVersion: request.annVersion,
      input: request.input,
      target: "qubic_oc",
      output: syntheticOutput,
    });

    await db
      .update(annExecutions)
      .set({
        status: isFailed ? "failed" : "completed",
        outputJson: syntheticOutput,
        resultHash: hash,
        completedBy: work.result?.completed_by ?? null,
        verificationStatus: isVerified ? "verified" : isDisputed ? "disputed" : "failed",
        completedAt,
        updatedAt: new Date(),
      })
      .where(eq(annExecutions.id, rowId));

    await logActivity(db, {
      actorUserId: request.requestedByUserId ?? null,
      action: isVerified
        ? auditAction.executionVerified
        : isFailed
          ? auditAction.executionFailed
          : auditAction.executionCompleted,
      targetType: "ann_execution",
      targetId: rowId,
      metadata: {
        annId: request.annId,
        executionId: (await this.getExecutionId(rowId)) ?? null,
        workId: work.work_id,
        workStatus: work.status,
        verificationStatus: isVerified ? "verified" : isDisputed ? "disputed" : "failed",
      },
    });

    return {
      executionId: (await this.getExecutionId(rowId)) ?? "",
      annId: request.annId,
      annVersion: request.annVersion,
      manifestHash: request.manifestHash,
      target: "qubic_oc",
      status: isFailed ? "failed" : "completed",
      output: syntheticOutput,
      resultHash: hash,
      workId: work.work_id,
      verificationStatus: isVerified ? "verified" : isDisputed ? "disputed" : "failed",
      error: isFailed ? `work item status: ${work.status}` : undefined,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
    };
  }

  private async getExecutionId(rowId: string): Promise<string | null> {
    const db = getDb();
    const rows = await db
      .select({ executionId: annExecutions.executionId })
      .from(annExecutions)
      .where(eq(annExecutions.id, rowId))
      .limit(1);
    return rows[0]?.executionId ?? null;
  }

  private async resolveAnnVersionId(annId: string, version: string): Promise<string> {
    const db = getDb();
    const rows = await db.execute<{ id: string }>(
      sql`SELECT id FROM ann_versions WHERE ann_id = ${annId}::uuid AND version = ${version} LIMIT 1`,
    );
    const id = (rows as unknown as { rows: { id: string }[] }).rows?.[0]?.id;
    if (!id) {
      throw new AnnExecutorError(
        `QubicOCExecutor: ANN version not found (ann_id=${annId}, version=${version})`,
        "ann_not_found",
      );
    }
    return id;
  }
}

function isTerminal(status: string): boolean {
  return status === "verified" || status === "disputed" || status === "failed";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Compute the OC payload hash deterministically. Exposed for tests.
 * Identical to the work service's `inputHash` for `payload_hash` —
 * the executor re-derives the same string to make the request
 * body auditable.
 */
export function ocInputHash(payload: unknown): string {
  return `sha256:${createHash("sha256").update(canon(payload)).digest("hex")}`;
}
