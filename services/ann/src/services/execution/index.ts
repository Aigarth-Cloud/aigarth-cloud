/**
 * Public exports for the Execution Router layer.
 *
 * Use `getExecutionRouter()` as the single entry point from
 * routes / services. The individual executors are exported for
 * tests and for callers that need to bypass the router (e.g. the
 * OC processor's own WorkRuntime integration).
 */

export * from "./types.js";
export { LocalANNExecutor, deterministicStubOutput } from "./local.js";
export { QubicOCExecutor, ocInputHash } from "./qubic-oc.js";
export {
  ExecutionRouter,
  getExecutionRouter,
  setExecutionRouterForTests,
  __resetExecutionRouterForTests,
} from "./router.js";
export { inputHash, resultHash } from "./result-hash.js";
export {
  registerAnnAdapter,
  getAnnAdapter,
  listAnnAdapterIds,
  __resetAnnAdapterRegistryForTests,
} from "./adapters/registry.js";
export type { AnnAdapter } from "./adapters/types.js";
export { BtcDirectionPredictorAdapter, registerDefaultBtcAdapter } from "./adapters/btc-direction-predictor.js";
