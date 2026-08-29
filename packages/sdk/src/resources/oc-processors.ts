import { BaseResource } from "./_base.js";

/**
 * /v1/oc/* — Aigarth-side Qubic OC processor.
 *
 *   const oc = new OcProcessors(client, "http://localhost:7012");
 *   const result = await oc.invoke("aigarth-cloud-ann", invocation);
 *
 * The OC processor is the inbound mirror of the Execution Router
 * in services/ann: it receives signed 451/676 invocations from
 * Qubic computors, maps them to Work Runtime work items, executes
 * them, and returns a signed result.
 *
 * The wire types below mirror `@aigarth/oc-processor` but are
 * re-declared locally so the SDK does not depend on the package's
 * built `dist/` (Phase 29 ships the package source-only; the types
 * are the contract, not the runtime).
 */

export interface OcProcessorManifest {
  processor_id: string;
  capabilities: string[];
  fee_qubic: string;
  endpoint: string;
  result_pubkey: string;
  description?: string;
}

export interface QubicInvocation {
  kind: "invocation";
  contract_index: number;
  procedure: string;
  caller: string;
  payer: string;
  fee_paid_qubit: string;
  epoch: number;
  nonce: string;
  payload: Record<string, unknown>;
  signatures: {
    computors: string[];
    sigs: string[];
    message_hash: string;
  };
}

export interface QubicResult {
  kind: "result";
  invocation_hash: string;
  work_id: string;
  status: "verified" | "disputed" | "failed";
  result: Record<string, unknown>;
  aigarth_signature: string;
  aigarth_pubkey: string;
  timestamp_ms: number;
}

export interface OcProcessorSummary {
  processor_id: string;
  capabilities: string[];
  fee_qubic: string;
  endpoint: string;
  breaker_state: "CLOSED" | "OPEN" | "HALF_OPEN";
  error_rate: number;
  samples: number;
}

export class OcProcessors extends BaseResource {
  /** List registered OC processors. */
  async list(): Promise<{ data: OcProcessorSummary[] }> {
    return this.request("/v1/oc/processors", { method: "GET" });
  }

  /** Fetch a single processor's manifest + state. */
  async retrieve(processorId: string): Promise<{ manifest: OcProcessorManifest; state: OcProcessorSummary }> {
    return this.request(`/v1/oc/processors/${encodeURIComponent(processorId)}`, { method: "GET" });
  }

  /**
   * Submit a single invocation. The route layer applies the
   * rate-limit, circuit-breaker, and signature-verify checks
   * before calling the handler.
   *
   * In Phase 29 this is the public surface for the OC test
   * surface (ocmock.qubic.org); production mainnet exposure is
   * gated on ADR 007's acceptance criteria.
   */
  async invoke(processorId: string, invocation: QubicInvocation): Promise<QubicResult> {
    return this.request(`/oc/${encodeURIComponent(processorId)}/invocation`, {
      method: "POST",
      body: JSON.stringify(invocation),
    });
  }

  /** Operator pause. */
  async pause(processorId: string, reason: string): Promise<{ state: "OPEN"; paused_at: string }> {
    return this.request(`/v1/oc/processors/${encodeURIComponent(processorId)}/pause`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }

  /** Operator resume. */
  async resume(processorId: string): Promise<{ state: "HALF_OPEN"; resumed_at: string }> {
    return this.request(`/v1/oc/processors/${encodeURIComponent(processorId)}/resume`, {
      method: "POST",
    });
  }

  /** Health check (public, no auth). */
  async health(processorId: string): Promise<{ status: "ready" | "paused"; epoch?: number; last_invocation_at?: string | null }> {
    return this.request(`/oc/${encodeURIComponent(processorId)}/health`, { method: "GET" });
  }

  /** Public manifest fetch. */
  async manifest(processorId: string): Promise<OcProcessorManifest> {
    return this.request(`/oc/${encodeURIComponent(processorId)}/manifest`, { method: "GET" });
  }
}
