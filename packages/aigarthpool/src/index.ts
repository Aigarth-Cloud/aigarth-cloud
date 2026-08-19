/**
 * @aigarth/aigarthpool — public entry point.
 *
 *   import { createAigarthPoolClient } from "@aigarth/aigarthpool";
 *   const pool = createAigarthPoolClient({ mode: "simulator" });
 *   const pos = await pool.stakeForAnn(userId, annId, 1000_000_000n, 52);
 *
 * The factory picks the right backend based on `mode`:
 *   - "simulator" (default for dev/test) — pure-TypeScript state
 *     machine, no external dependencies.
 *   - "qpi" — real Qubic RPC client, requires AIO Dev Kit and a
 *     deployed AigarthPool contract. Hardware-gated; the constructor
 *     throws until Phase 20.6 lands.
 *
 * For per-test scenarios (e.g. a service wants its own isolated
 * simulator state), `createSimulator()` returns a fresh instance.
 */

import { AigarthPoolSimulator, AigarthPoolError } from "./simulator.js";
import { AigarthPoolQpiClient } from "./client.js";
import type { AigarthPoolClient } from "./types.js";

export type {
  AigarthPoolClient,
  AigarthPoolEvent,
  AnnSplits,
  GovernanceState,
  PendingSignerChange,
  PendingTreasuryTransfer,
  Position,
  QubicIdentity,
  SplitResult,
  Totals,
  YieldOwed,
} from "./types.js";
export { NO_THRESHOLD_CHANGE, PENDING_OP_TTL_EPOCHS } from "./types.js";
export { applySplits, computeYield, defaultSplits, AigarthPoolError } from "./simulator.js";
export { AigarthPoolSimulator } from "./simulator.js";
export { AigarthPoolQpiClient } from "./client.js";

export interface CreateOptions {
  mode?: "simulator" | "qpi";
  /** Required for mode="qpi". */
  rpcUrl?: string;
  contractIndex?: number;
  deployerKey?: string;
}

/**
 * Create an AigarthPool client. The `mode` argument overrides the
 * `AIGARTHPOOL_MODE` env var; if neither is set, defaults to
 * "simulator".
 */
export function createAigarthPoolClient(opts: CreateOptions = {}): AigarthPoolClient {
  const mode = opts.mode ?? (process.env["AIGARTHPOOL_MODE"] as "simulator" | "qpi" | undefined) ?? "simulator";
  if (mode === "simulator") {
    return new AigarthPoolSimulator();
  }
  if (!opts.rpcUrl || opts.contractIndex === undefined || !opts.deployerKey) {
    throw new Error(
      "AIGARTHPOOL_MODE=qpi requires { rpcUrl, contractIndex, deployerKey } — " +
        "see docs/aigarthpool/README.md for the deploy steps.",
    );
  }
  return new AigarthPoolQpiClient({
    rpcUrl: opts.rpcUrl,
    contractIndex: opts.contractIndex,
    deployerKey: opts.deployerKey,
  });
}

/** Create a fresh simulator (each call returns an isolated instance). */
export function createSimulator(): AigarthPoolSimulator {
  return new AigarthPoolSimulator();
}
