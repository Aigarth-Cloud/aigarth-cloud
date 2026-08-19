/**
 * AigarthPool client wrapper for services/ann.
 *
 * Phase 20.4. The ann service talks to the AigarthPool via this
 * thin module so the rest of the codebase never imports
 * @aigarth/aigarthpool directly. The client is a process-wide
 * singleton (the simulator is in-memory, so multiple instances
 * would diverge from each other).
 *
 * When AIGARTHPOOL_MODE=simulator (the default in dev/test), the
 * client is a real in-process state machine that the watcher
 * subscribes to. When AIGARTHPOOL_MODE=qpi, the client is the
 * Qubic RPC backend (Phase 20.6, hardware-gated).
 *
 * The simulator's `stakeForAnn` is the canonical path for a user
 * staking QUBIC for an ANN. The yield splits and event log are the
 * single source of truth for "who staked for what." The off-chain
 * mirror in `aigarth_stakes` (the table this service will own in
 * a follow-up) is derived state.
 */

import { createAigarthPoolClient, type AigarthPoolClient } from "@aigarth/aigarthpool";

let cached: AigarthPoolClient | null = null;

/**
 * Get the process-wide AigarthPool client. Idempotent.
 */
export function getAigarthPool(): AigarthPoolClient {
  if (cached) return cached;
  cached = createAigarthPoolClient({
    mode: (process.env["AIGARTHPOOL_MODE"] as "simulator" | "qpi" | undefined) ?? "simulator",
    rpcUrl: process.env["AIGARTHPOOL_RPC_URL"],
    contractIndex: process.env["AIGARTHPOOL_CONTRACT_INDEX"]
      ? Number(process.env["AIGARTHPOOL_CONTRACT_INDEX"])
      : undefined,
    deployerKey: process.env["AIGARTHPOOL_DEPLOYER_KEY"],
  });
  return cached;
}

/**
 * Test-only: replace the cached client with a fresh simulator.
 * Production never calls this.
 */
export function resetAigarthPoolForTests(client?: AigarthPoolClient): void {
  cached = client ?? null;
}
