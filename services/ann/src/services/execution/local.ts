/**
 * LocalANNExecutor — the in-process, deterministic executor.
 *
 * The local executor runs the ANN's adapter in the current process.
 * No network call, no OC layer. Same input + same manifest + same
 * architecture always produces the same output. The result hash is
 * deterministic.
 *
 * If no adapter is registered for the manifest's architecture, the
 * executor falls back to a **clearly labelled** deterministic stub.
 * The stub does not pretend to be a real model — its output carries
 * a `fixture: true` flag so a UI or auditor can see at a glance that
 * the result is a development fixture.
 *
 * The local executor never claims to be Qubic OC. The result
 * `target` is always `"local"` and the `verificationStatus` is
 * always `"local_deterministic"`.
 */

import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { AnnExecutor, ANNExecutionRequest, ANNExecutionResult } from "./types.js";
import { AnnExecutorError } from "./types.js";
import { getAnnAdapter } from "./adapters/registry.js";
import { inputHash, resultHash } from "./result-hash.js";
import type { AnnManifest } from "../../types/ann-manifest.js";
import { executionId } from "../../lib/ids.js";
import { getDb } from "../../db/index.js";
import { annExecutions, type AnnExecution } from "../../db/schema.js";
import { logActivity, auditAction } from "../../lib/audit.js";

const STUB_INFO = { id: "local", model: "deterministic-stub", version: "1.0.0" } as const;

export class LocalANNExecutor implements AnnExecutor {
  info() {
    return STUB_INFO;
  }

  async execute(request: ANNExecutionRequest): Promise<ANNExecutionResult> {
    const startedAt = new Date();

    // 1. Resolve the manifest. The caller is expected to have passed
    //    a manifest hash that already matches a known version. We
    //    don't re-fetch the manifest here; the manifest hash is
    //    the identity. The adapter reads `manifest.architecture` from
    //    the request (which the router populates before dispatch).
    const architecture = (request.parameters as { architecture?: string } | undefined)?.architecture;
    if (!architecture) {
      throw new AnnExecutorError(
        "LocalANNExecutor: missing architecture in request.parameters (router bug?)",
        "internal",
      );
    }

    // 2. Persist a queued row.
    const executionRow = await this.persistQueuedRow(request, startedAt);

    // 3. Run the adapter (or fall back to the stub).
    const output = await this.runInference(architecture, request, executionRow);

    // 4. Compute the deterministic result hash.
    const hash = resultHash({
      manifestHash: request.manifestHash,
      annVersion: request.annVersion,
      input: request.input,
      target: "local",
      output,
    });

    // 5. Mark the row complete.
    const completedAt = new Date();
    await this.markCompleted(executionRow.id, {
      outputJson: output,
      resultHash: hash,
      verificationStatus: "local_deterministic",
      completedAt,
    });

    return {
      executionId: executionRow.executionId,
      annId: request.annId,
      annVersion: request.annVersion,
      manifestHash: request.manifestHash,
      target: "local",
      status: "completed",
      output,
      resultHash: hash,
      verificationStatus: "local_deterministic",
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
    };
  }

  // ----- internals -----

  private async persistQueuedRow(
    request: ANNExecutionRequest,
    startedAt: Date,
  ): Promise<AnnExecution> {
    const db = getDb();
    const annVersionId = await this.resolveAnnVersionId(request.annId, request.annVersion);
    const id = executionId();
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
        target: "local",
        status: "running",
        inputHash: iHash,
        inputUri: "in-memory://input",
        inputSizeBytes: BigInt(JSON.stringify(request.input).length),
        requestedByUserId: request.requestedByUserId ?? null,
        startedAt,
        verificationStatus: "pending",
      })
      .returning();
    if (!row) throw new AnnExecutorError("LocalANNExecutor: failed to persist execution row", "internal");
    await logActivity(db, {
      actorUserId: request.requestedByUserId ?? null,
      action: auditAction.executionSubmitted ?? "ann.execution.submitted",
      targetType: "ann_execution",
      targetId: id,
      metadata: { annId: request.annId, executionId: id, target: "local", annVersion: request.annVersion },
    });
    return row;
  }

  private async markCompleted(
    id: string,
    fields: {
      outputJson: Record<string, unknown>;
      resultHash: string;
      verificationStatus: "local_deterministic";
      completedAt: Date;
    },
  ): Promise<void> {
    const db = getDb();
    await db
      .update(annExecutions)
      .set({
        status: "completed",
        outputJson: fields.outputJson,
        resultHash: fields.resultHash,
        verificationStatus: fields.verificationStatus,
        completedAt: fields.completedAt,
        updatedAt: new Date(),
      })
      .where(eq(annExecutions.id, id));
  }

  private async runInference(
    architecture: string,
    request: ANNExecutionRequest,
    _row: AnnExecution,
  ): Promise<Record<string, unknown>> {
    const adapter = getAnnAdapter(architecture);
    if (adapter) {
      try {
        return await adapter.infer(request.input, this.placeholderManifest(request, architecture));
      } catch (err) {
        throw new AnnExecutorError(
          `LocalANNExecutor: adapter '${architecture}' failed — ${err instanceof Error ? err.message : String(err)}`,
          "invalid_input",
        );
      }
    }
    // No adapter: deterministic stub. The output is *clearly* labelled
    // as a fixture so no caller can mistake it for a real inference.
    return deterministicStubOutput(architecture, request);
  }

  /**
   * The executor doesn't carry the full manifest (it only needs
   * `architecture` for adapter lookup). The adapter receives a
   * stub manifest that exposes the fields it actually reads. This
   * is a placeholder, NOT the real manifest — adapters that need
   * the full manifest should be refactored to receive it
   * explicitly in a future version.
   */
  private placeholderManifest(request: ANNExecutionRequest, architecture: string): AnnManifest {
    return {
      id: request.annId,
      name: request.annId,
      version: request.annVersion,
      creator: "unknown",
      architecture,
      modelHash: request.manifestHash,
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    };
  }

  private async resolveAnnVersionId(annId: string, version: string): Promise<string> {
    const db = getDb();
    const rows = await db.execute<{ id: string }>(
      sql`SELECT id FROM ann_versions WHERE ann_id = ${annId}::uuid AND version = ${version} LIMIT 1`,
    );
    const id = (rows as unknown as { rows: { id: string }[] }).rows?.[0]?.id;
    if (!id) {
      throw new AnnExecutorError(
        `LocalANNExecutor: ANN version not found (ann_id=${annId}, version=${version})`,
        "ann_not_found",
      );
    }
    return id;
  }
}

/**
 * Deterministic stub output. Used when no adapter is registered.
 * The output is content-addressed: same input always produces the
 * same output, and the output carries a `fixture: true` flag so it
 * can never be confused with a real inference.
 */
export function deterministicStubOutput(
  architecture: string,
  request: ANNExecutionRequest,
): Record<string, unknown> {
  const seedSource = `${request.manifestHash}|${request.annVersion}|${JSON.stringify(request.input)}`;
  const hash = `sha256:${createHash("sha256").update(seedSource).digest("hex")}`;
  // Take the first 4 hex chars as a pseudo-score in [0,1].
  const score = parseInt(hash.slice(7, 9), 16) / 255;
  return {
    fixture: true,
    fixture_kind: "deterministic-stub",
    architecture,
    ann_id: request.annId,
    ann_version: request.annVersion,
    manifest_hash: request.manifestHash,
    input_keys: Object.keys(request.input),
    score: Number(score.toFixed(4)),
    note:
      "No adapter registered for this architecture. Output is a deterministic stub. " +
      "Register an adapter in services/ann/src/services/execution/adapters/ to get real inference.",
  };
}
