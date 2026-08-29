/**
 * Execution Router — public types.
 *
 * The Execution Router is the abstraction that lets the same ANN
 * be run locally (in-process, deterministic) or through Qubic OC
 * (submitted to services/work). It mirrors the existing
 * `TrinaryBackend` factory pattern at `services/ann/src/backends/`
 * but operates on ANN artifacts, not trinary prompts.
 *
 *   ANN
 *     ↓
 *   ANNExecutionRequest
 *     ↓
 *   ExecutionRouter
 *     ├── LocalANNExecutor        (in-process, deterministic)
 *     └── QubicOCExecutor         (wraps services/work, async poll)
 *
 * Both executors return an `ANNExecutionResult` with a deterministic
 * `resultHash` so the caller (and any later auditor) can prove which
 * ANN version produced which output.
 *
 * The router is **stateless**. Per-ANN configuration (which adapter
 * to use for the local executor, which algorithm to register for the
 * OC executor) lives in the ANN's manifest, not in the router.
 */

import type { AnnExecutionTarget, AnnExecutionStatus, AnnVerificationStatus } from "../../db/schema.js";

/** A single ANN execution request. */
export interface ANNExecutionRequest {
  /** The ANN's slug or uuid. The router resolves it to a manifest. */
  annId: string;
  /** The semver string ("v1.0.0"). Pinned at request time. */
  annVersion: string;
  /** SHA-256 of the canonical manifest. The execution identity. */
  manifestHash: string;
  /** Caller-supplied request id (e.g. ULID or external tracing id). */
  requestId: string;
  /** Which executor to use. */
  target: AnnExecutionTarget;
  /** The input payload. The shape is validated against manifest.inputSchema. */
  input: Record<string, unknown>;
  /** Optional execution parameters (timeout, replicas, ...). */
  parameters?: ExecutionParameters;
  /** The JWT sub of the user who initiated the run (for audit). */
  requestedByUserId?: string;
}

export interface ExecutionParameters {
  /** Per-call timeout in ms. Default 30 000. */
  timeoutMs?: number;
  /** Replica count for OC verification. Default 3. */
  replicas?: number;
  /** Whether the algorithm is deterministic. Default false. */
  deterministic?: boolean;
  /** Optional reward amount in Qu-bit. Default 0 (free execution). */
  rewardQubic?: bigint;
  /**
   * Optional override of the architecture id. The route layer
   * populates this from the ann_repositories row's `releaseUrl`
   * (`local://manifest/<arch>`) so the local executor can find the
   * right adapter. Tests pass it directly.
   */
  architecture?: string;
}

/** The public execution-id format (`axe_<ulid>`). */
export type ExecutionId = string;

/** A single ANN execution result. */
export interface ANNExecutionResult {
  executionId: ExecutionId;
  annId: string;
  annVersion: string;
  manifestHash: string;
  target: AnnExecutionTarget;
  status: AnnExecutionStatus;
  output?: Record<string, unknown>;
  resultHash?: string;
  workId?: string;
  verificationStatus: AnnVerificationStatus;
  error?: string;
  startedAt: string; // ISO 8601
  completedAt?: string;
}

/**
 * The executor contract. Every executor implements `execute`. The
 * `LocalANNExecutor` returns synchronously (the `ANNExecutionResult`
 * is fully populated by the time `execute` resolves). The
 * `QubicOCExecutor` is **also** synchronous in shape but the inner
 * work item may still be running on the OC side; the result row is
 * `status: "running"` until the polling loop finishes, and the
 * caller is expected to call `getExecution(executionId)` to fetch
 * the final state.
 */
export interface AnnExecutor {
  /** Backend identity — short id + display model/version. */
  info(): { id: string; model: string; version: string };
  execute(request: ANNExecutionRequest): Promise<ANNExecutionResult>;
}

/** Errors thrown by executors. */
export class AnnExecutorError extends Error {
  public override readonly name = "AnnExecutorError";
  constructor(
    message: string,
    public readonly code:
      | "invalid_input"
      | "ann_not_found"
      | "manifest_hash_mismatch"
      | "unsupported_target"
      | "executor_unavailable"
      | "timeout"
      | "verification_failed"
      | "internal",
  ) {
    super(message);
  }
}
