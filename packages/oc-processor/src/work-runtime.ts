/**
 * Work Runtime integration (ADR 006).
 *
 * The OC processor delegates the actual execution to the
 * Aigarth Work Runtime (`services/work`, port 7012). The
 * integration is a thin HTTP client that:
 *
 *   1. Maps a `QubicInvocation` to a `SubmitWorkItem` envelope
 *      (deterministic — see `mapToWorkItem`).
 *   2. POSTs to the work service's INTERNAL endpoint
 *      (`POST /v1/internal/work/items`, INTERNAL_TOKEN-guarded).
 *   3. Polls `GET /v1/internal/work/items/:work_id` until the
 *      work item reaches a terminal state (verified / disputed /
 *      failed) or the timeout elapses.
 *   4. Returns the terminal `WorkItemResult`.
 *
 * The HTTP client is a **fetch** wrapper. It does not depend on
 * any SDK; the OC processor is intentionally lightweight.
 */

import type { QubicInvocation } from "./types.js";
import { messageHash } from "./canonicalize.js";

export interface WorkItemResult {
  work_id: string;
  status: "verified" | "disputed" | "failed" | "running" | "queued";
  payload_hash: string | null;
  completed_by: string | null;
  completed_at: string | null;
  replicas_agreed: string | null;
}

export interface WorkRuntimeClient {
  /**
   * Submit a work item and poll until terminal. Throws on
   * unrecoverable failure (network down, submission rejected).
   */
  execute(args: {
    invocation: QubicInvocation;
    timeoutMs: number;
    pollIntervalMs: number;
  }): Promise<WorkItemResult>;
}

const POLL_INTERVAL_MS = 2_000;
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Map a `QubicInvocation` to the work service's `SubmitWorkItem`
 * envelope. Deterministic — the same invocation always produces
 * the same envelope.
 *
 *   payload.algorithm.name      → algorithm.name
 *   payload.input               → input.payload_hash + input.payload_uri
 *   payload.fee_qubic           → reward.amount
 *   caller                      → reward.payer
 *
 * The `work_id` is a fresh ULID, allocated by the work service.
 */
export function mapToWorkItem(args: {
  invocation: QubicInvocation;
}): Record<string, unknown> {
  const { invocation } = args;
  const payload = invocation.payload as {
    algorithm?: string;
    algorithm_version?: string;
    algorithm_container?: string;
    algorithm_deterministic?: boolean;
    input?: { payload_hash: string; payload_uri: string; payload_size_bytes: number };
    requirements?: {
      cpu_cores?: number;
      memory_gb?: number;
      gpu?: "none" | "optional" | "required";
      gpu_kind?: "any" | "rtx_4090" | "h100";
      estimated_runtime_s?: number;
    };
    verification?: { method?: "replication" | "challenge" | "deterministic"; replicas?: number };
  };

  const algoName = payload.algorithm ?? "aigarth-oc-algorithm";
  const algoVersion = payload.algorithm_version ?? "v1.0.0";
  const algoContainer = payload.algorithm_container ?? "aigarth-cloud/ann-executor:v1.0.0";
  const algoDet = payload.algorithm_deterministic ?? true;

  const inp = payload.input ?? {
    payload_hash: messageHash(invocation),
    payload_uri: "data:application/octet-stream;base64,",
    payload_size_bytes: 0,
  };

  const reqs = payload.requirements ?? {};
  const ver = payload.verification ?? {};

  return {
    type: `oc.${algoName}`,
    spec_version: 1,
    input: {
      payload_hash: inp.payload_hash,
      payload_uri: inp.payload_uri,
      payload_size_bytes: inp.payload_size_bytes,
    },
    algorithm: {
      name: algoName,
      version: algoVersion,
      container: algoContainer,
      deterministic: algoDet,
    },
    requirements: {
      cpu_cores: reqs.cpu_cores ?? 1,
      memory_gb: reqs.memory_gb ?? 1,
      gpu: reqs.gpu ?? "none",
      gpu_kind: reqs.gpu_kind ?? "any",
      estimated_runtime_s: reqs.estimated_runtime_s ?? 60,
    },
    verification: {
      method: ver.method ?? (algoDet ? "deterministic" : "replication"),
      replicas: ver.replicas ?? (algoDet ? 1 : 3),
    },
    reward: {
      currency: "QUBIC",
      amount: invocation.fee_paid_qubit,
      payer: invocation.payer,
    },
  };
}

/** HTTP-based Work Runtime client. Used by default. */
export class HttpWorkRuntime implements WorkRuntimeClient {
  constructor(
    private readonly baseUrl: string,
    private readonly internalToken: string | undefined,
  ) {}

  async execute(args: {
    invocation: QubicInvocation;
    timeoutMs: number;
    pollIntervalMs: number;
  }): Promise<WorkItemResult> {
    const submitBody = mapToWorkItem({ invocation: args.invocation });
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.internalToken) headers.Authorization = `Bearer ${this.internalToken}`;

    const submitRes = await fetch(`${this.baseUrl}/v1/internal/work/items`, {
      method: "POST",
      headers,
      body: JSON.stringify(submitBody),
    });
    if (!submitRes.ok) {
      const detail = await submitRes.text().catch(() => "");
      throw new Error(
        `work service rejected submission: ${submitRes.status} ${submitRes.statusText} — ${detail.slice(0, 500)}`,
      );
    }
    const submitted = (await submitRes.json()) as { work_id: string; status: string };
    const deadline = Date.now() + args.timeoutMs;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, args.pollIntervalMs));
      const getRes = await fetch(
        `${this.baseUrl}/v1/internal/work/items/${encodeURIComponent(submitted.work_id)}`,
        {
          method: "GET",
          headers: this.internalToken ? { Authorization: `Bearer ${this.internalToken}` } : {},
        },
      );
      if (!getRes.ok) continue;
      const got = (await getRes.json()) as {
        work_id: string;
        status: string;
        result: null | {
          payload_hash: string;
          completed_by: string | null;
          completed_at: string | null;
          replicas_agreed: string | null;
        };
      };
      if (got.status === "verified" || got.status === "disputed" || got.status === "failed") {
        return {
          work_id: got.work_id,
          status: got.status,
          payload_hash: got.result?.payload_hash ?? null,
          completed_by: got.result?.completed_by ?? null,
          completed_at: got.result?.completed_at ?? null,
          replicas_agreed: got.result?.replicas_agreed ?? null,
        };
      }
    }
    return {
      work_id: submitted.work_id,
      status: "running",
      payload_hash: null,
      completed_by: null,
      completed_at: null,
      replicas_agreed: null,
    };
  }
}

export { DEFAULT_TIMEOUT_MS, POLL_INTERVAL_MS };
