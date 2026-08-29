/**
 * Process-wide registry of OC processors.
 *
 *   registerAsProcessor(manifest) — adds (or replaces) a processor.
 *   onInvocation(handler)         — sets the per-processor handler.
 *   handle(invocation)            — internal: dispatches through the
 *                                   full pipeline (rate-limit →
 *                                   circuit-breaker → verify → handler).
 *
 * In v1, the registry is in-process. The Work Runtime
 * (`services/work`) is the source of truth for execution records;
 * this registry is the OC-side mirror.
 */

import { messageHash } from "./canonicalize.js";
import { verifySignatureBundle, type QubicComputorKey } from "./signature.js";
import { RateLimiter, type RateLimitConfig } from "./rate-limit.js";
import { CircuitBreaker, type CircuitBreakerConfig } from "./circuit-breaker.js";
import { signResult, type AigarthSigningKey } from "./result-signer.js";
import {
  OcErrorCode,
  OcProcessorError,
  type OcProcessorManifest,
  type QubicInvocation,
  type QubicResult,
} from "./types.js";
import type { WorkRuntimeClient } from "./work-runtime.js";

export type InvocationHandler = (inv: QubicInvocation) => Promise<{
  status: "verified" | "disputed" | "failed";
  result: Record<string, unknown>;
}>;

interface ProcessorEntry {
  manifest: OcProcessorManifest;
  handler: InvocationHandler;
  signingKey: AigarthSigningKey;
  rateLimiter: RateLimiter;
  breaker: CircuitBreaker;
  /** Cached computor public keys. The real Qubic source is
   *  services/qubic; v1 uses a stub. */
  computorKeys: Map<string, QubicComputorKey>;
}

export interface RegisterAsProcessorInput {
  manifest: OcProcessorManifest;
  signingKey: AigarthSigningKey;
  /** Per-processor handler. Receives the verified invocation,
   *  returns the result envelope that Aigarth will sign. */
  handler: InvocationHandler;
  /** Optional rate-limit override. */
  rateLimit?: Partial<RateLimitConfig>;
  /** Optional circuit-breaker override. */
  circuitBreaker?: Partial<CircuitBreakerConfig>;
  /** Computor public keys. If absent, the processor refuses all
   *  invocations with INVALID_SIG (safe-by-default). */
  computorKeys?: ReadonlyMap<string, QubicComputorKey>;
}

export class OcProcessorRegistry {
  private readonly entries = new Map<string, ProcessorEntry>();
  private workRuntime: WorkRuntimeClient | null = null;

  /** Wire a Work Runtime client (used by the default handler). */
  setWorkRuntime(client: WorkRuntimeClient): void {
    this.workRuntime = client;
  }

  /** Register a processor. Replaces any prior entry with the same id. */
  register(input: RegisterAsProcessorInput): void {
    this.entries.set(input.manifest.processor_id, {
      manifest: input.manifest,
      handler: input.handler,
      signingKey: input.signingKey,
      rateLimiter: new RateLimiter(input.rateLimit),
      breaker: new CircuitBreaker(input.circuitBreaker),
      computorKeys: new Map(input.computorKeys ?? []),
    });
  }

  /** Read-only snapshot for the dashboard. */
  list(): Array<{
    processor_id: string;
    capabilities: string[];
    fee_qubic: string;
    endpoint: string;
    breakerState: "CLOSED" | "OPEN" | "HALF_OPEN";
    errorRate: number;
    samples: number;
  }> {
    const out: Array<{
      processor_id: string;
      capabilities: string[];
      fee_qubic: string;
      endpoint: string;
      breakerState: "CLOSED" | "OPEN" | "HALF_OPEN";
      errorRate: number;
      samples: number;
    }> = [];
    for (const e of this.entries.values()) {
      const snap = e.breaker.snapshot(Date.now());
      out.push({
        processor_id: e.manifest.processor_id,
        capabilities: [...e.manifest.capabilities],
        fee_qubic: e.manifest.fee_qubic,
        endpoint: e.manifest.endpoint,
        breakerState: snap.state,
        errorRate: snap.errorRate,
        samples: snap.samples,
      });
    }
    return out;
  }

  /** Operator pause. */
  pause(processorId: string, nowMs = Date.now()): void {
    const e = this.entries.get(processorId);
    if (!e) throw new OcProcessorError(`Unknown processor '${processorId}'`, OcErrorCode.INTERNAL);
    e.breaker.pause(nowMs);
  }

  /** Operator resume. */
  resume(processorId: string): void {
    const e = this.entries.get(processorId);
    if (!e) throw new OcProcessorError(`Unknown processor '${processorId}'`, OcErrorCode.INTERNAL);
    e.breaker.resume();
  }

  /**
   * The full pipeline. Used by the route layer and tests.
   *
   *   1. Look up the processor entry. Unknown → 404.
   *   2. Circuit breaker allow? No → PROCESSOR_PAUSED.
   *   3. Rate-limit check? No → RATE_LIMITED_*.
   *   4. Verify 451/676 signature bundle.
   *   5. Call the handler.
   *   6. Sign the result with the Aigarth signing key.
   *   7. Return the QubicResult envelope.
   */
  async handle(args: { processorId: string; invocation: QubicInvocation; nowMs?: number }): Promise<QubicResult> {
    const entry = this.entries.get(args.processorId);
    if (!entry) {
      throw new OcProcessorError(`Unknown processor '${args.processorId}'`, OcErrorCode.INTERNAL);
    }
    const nowMs = args.nowMs ?? Date.now();
    if (!entry.breaker.allow(nowMs)) {
      throw new OcProcessorError(
        `Processor '${args.processorId}' is paused`,
        OcErrorCode.PROCESSOR_PAUSED,
      );
    }
    const rl = entry.rateLimiter.check({
      caller: args.invocation.caller,
      processorId: args.processorId,
      epoch: args.invocation.epoch,
      nowMs,
    });
    if (!rl.allowed) {
      const code =
        rl.layer === "caller"
          ? OcErrorCode.RATE_LIMITED_CALLER
          : rl.layer === "processor"
            ? OcErrorCode.RATE_LIMITED_PROCESSOR
            : OcErrorCode.RATE_LIMITED_EPOCH;
      throw new OcProcessorError(`Rate limited (${rl.layer})`, code, rl.retryAfterSec);
    }
    // 451/676 signature verify.
    verifySignatureBundle(args.invocation, entry.computorKeys);

    // Run the handler.
    let handlerResult: { status: "verified" | "disputed" | "failed"; result: Record<string, unknown> };
    try {
      handlerResult = await entry.handler(args.invocation);
    } catch (err) {
      entry.breaker.recordFailure(nowMs);
      throw new OcProcessorError(
        `Handler failed: ${err instanceof Error ? err.message : String(err)}`,
        OcErrorCode.HANDLER_FAILED,
      );
    }

    // Sign + return.
    const workId = (handlerResult.result as { work_id?: string }).work_id ?? "wki_unknown";
    const invHash = messageHash(args.invocation);
    const signature = signResult({
      signingKey: entry.signingKey,
      invocationHash: invHash,
      workId,
      status: handlerResult.status,
      result: handlerResult.result,
    });
    entry.breaker.recordSuccess(nowMs);
    return {
      kind: "result",
      invocation_hash: invHash,
      work_id: workId,
      status: handlerResult.status,
      result: handlerResult.result,
      aigarth_signature: signature,
      aigarth_pubkey: entry.signingKey.publicKeyHex,
      timestamp_ms: nowMs,
    };
  }
}

/** Process-wide singleton. */
let cached: OcProcessorRegistry | null = null;

export function getOcProcessorRegistry(): OcProcessorRegistry {
  if (cached) return cached;
  cached = new OcProcessorRegistry();
  return cached;
}

export function setOcProcessorRegistryForTests(r: OcProcessorRegistry): void {
  cached = r;
}

export function __resetOcProcessorRegistryForTests(): void {
  cached = null;
}
