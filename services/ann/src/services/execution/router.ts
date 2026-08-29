/**
 * Execution Router — the single entry point that dispatches an
 * ANN execution request to the correct executor.
 *
 *   ANN
 *     ↓
 *   ANNExecutionRequest
 *     ↓
 *   ExecutionRouter.execute(req)
 *     ├── target=local       → LocalANNExecutor
 *     └── target=qubic_oc    → QubicOCExecutor
 *
 * The router is **stateless**. Both executors are constructed per
 * call (they have no per-request state). If we ever need to
 * re-use a connection pool, the executors can be promoted to
 * singletons via the same single-flight pattern that
 * `getTrinaryBackend()` uses.
 *
 * Failure handling: the router never falls back. If the user
 * picked "qubic_oc" and the OC engine is down, the result is a
 * failed execution — not a silent local run. This matches the
 * superprompt §24 invariant.
 */

import type { AnnExecutor, ANNExecutionRequest, ANNExecutionResult } from "./types.js";
import { AnnExecutorError } from "./types.js";
import { LocalANNExecutor } from "./local.js";
import { QubicOCExecutor } from "./qubic-oc.js";
import type { AnnExecutionTarget } from "../../db/schema.js";

export class ExecutionRouter {
  private readonly local: AnnExecutor;
  private readonly oc: AnnExecutor;

  constructor(opts?: { local?: AnnExecutor; oc?: AnnExecutor }) {
    this.local = opts?.local ?? new LocalANNExecutor();
    this.oc = opts?.oc ?? new QubicOCExecutor();
  }

  async execute(request: ANNExecutionRequest): Promise<ANNExecutionResult> {
    const executor = this.pick(request.target);
    return executor.execute(request);
  }

  /** Return the backend info for a given target. */
  info(target: AnnExecutionTarget): { id: string; model: string; version: string } {
    return this.pick(target).info();
  }

  private pick(target: AnnExecutionTarget): AnnExecutor {
    switch (target) {
      case "local":
        return this.local;
      case "qubic_oc":
        return this.oc;
      default: {
        const _exhaustive: never = target;
        throw new AnnExecutorError(
          `ExecutionRouter: unknown target '${String(_exhaustive)}'`,
          "unsupported_target",
        );
      }
    }
  }
}

/**
 * Process-wide singleton. The default is fine for production; tests
 * can swap the executors via `setExecutionRouterForTests`.
 */
let cached: ExecutionRouter | null = null;

export function getExecutionRouter(): ExecutionRouter {
  if (cached) return cached;
  cached = new ExecutionRouter();
  return cached;
}

export function setExecutionRouterForTests(router: ExecutionRouter): void {
  cached = router;
}

export function __resetExecutionRouterForTests(): void {
  cached = null;
}
