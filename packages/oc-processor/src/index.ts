/**
 * @aigarth/oc-processor — public exports.
 *
 * Phase 29 ships ADR 007's mechanism (registry, rate-limit, circuit
 * breaker, signature verify, result signer, work-runtime integration)
 * with the v1 caveat that the 451/676 cryptographic verification is
 * a structural-only check (see signature.ts for the rationale).
 * Phase 30+ will swap in real Ed25519 / Schnorr.
 */

export * from "./types.js";
export {
  stableStringify,
  canonicaliseInvocation,
  messageHash,
} from "./canonicalize.js";
export { verifySignatureBundle, type QubicComputorKey } from "./signature.js";
export {
  RateLimiter,
  DEFAULT_RATE_LIMIT,
  type RateLimitConfig,
  type RateLimitDecision,
} from "./rate-limit.js";
export {
  CircuitBreaker,
  DEFAULT_BREAKER,
  type CircuitBreakerConfig,
  type BreakerState,
} from "./circuit-breaker.js";
export { signResult, verifyResultSignature, type AigarthSigningKey } from "./result-signer.js";
export {
  mapToWorkItem,
  HttpWorkRuntime,
  type WorkRuntimeClient,
  type WorkItemResult,
} from "./work-runtime.js";
export {
  OcProcessorRegistry,
  getOcProcessorRegistry,
  setOcProcessorRegistryForTests,
  __resetOcProcessorRegistryForTests,
  type RegisterAsProcessorInput,
  type InvocationHandler,
} from "./registry.js";
