/**
 * AigarthPoolClient — Qubic RPC backend.
 *
 * Phase 20.4 (production path, hardware-gated). This is the stub
 * for the real client that talks to a deployed AigarthPool QPI
 * contract via Qubic JSON-RPC. The full implementation requires
 * the AIO Dev Kit (Phase 20.1) and a deployed contract (Phase
 * 20.6) — both of which are out of scope until the testnet
 * hardware is available.
 *
 * Phase 22: governance procedures (initGovernance,
 * submitTreasuryTransfer, approveTreasuryTransfer,
 * executeTreasuryTransfer, submitSignerChange,
 * approveSignerChange, executeSignerChange) and the
 * getGovernanceState query are stubbed here in the same way as
 * the existing procedures.
 *
 * What lives here:
 *   - The `AigarthPoolQpiClient` class (throws "not yet wired").
 *   - The `QubicRpcAigarthPoolClient` interface contract that the
 *     real implementation will satisfy.
 *
 * Services should NEVER instantiate this class directly. Use
 * `createAigarthPoolClient()` from index.ts, which picks the right
 * backend based on `AIGARTHPOOL_MODE`.
 *
 * The QPI build (services/aigarthpool/contract/) provides the
 * canonical on-chain spec. The TypeScript simulator
 * (simulator.ts) is the in-process mirror used for dev + tests.
 */

import type { AigarthPoolClient } from "./types.js";

export class AigarthPoolQpiClient implements AigarthPoolClient {
  readonly mode = "qpi" as const;

  constructor(private readonly _opts: { rpcUrl: string; contractIndex: number; deployerKey: string }) {
    // Intentionally not wired. The AIO Dev Kit is hardware-gated
    // (Phase 20.6) — see docs/aigarthpool/audit-checklist.md.
    //
    // To implement: use the Qubic JSON-RPC client at
    // <rpcUrl>/v1/contracts/<contractIndex>/procedures. Each
    // procedure maps 1:1 to a method on AigarthPoolClient. The
    // event subscription bridges to the Qubic event log API.
    throw new Error(
      "AigarthPoolQpiClient is not yet wired. Set AIGARTHPOOL_MODE=simulator for now. " +
        "See docs/aigarthpool/audit-checklist.md (Phase 20.6).",
    );
  }

  // Stub implementations of the interface so the type system is
  // happy. They will never run — the constructor above throws.
  async stakeForAnn(): Promise<never> { throw new Error("unreachable"); }
  async extendLock(): Promise<never> { throw new Error("unreachable"); }
  async unlock(): Promise<never> { throw new Error("unreachable"); }
  async claimRewards(): Promise<never> { throw new Error("unreachable"); }
  async setAnnSplits(): Promise<never> { throw new Error("unreachable"); }
  async initGovernance(): Promise<never> { throw new Error("unreachable"); }
  async submitTreasuryTransfer(): Promise<never> { throw new Error("unreachable"); }
  async approveTreasuryTransfer(): Promise<never> { throw new Error("unreachable"); }
  async executeTreasuryTransfer(): Promise<never> { throw new Error("unreachable"); }
  async submitSignerChange(): Promise<never> { throw new Error("unreachable"); }
  async approveSignerChange(): Promise<never> { throw new Error("unreachable"); }
  async executeSignerChange(): Promise<never> { throw new Error("unreachable"); }
  async pause(): Promise<never> { throw new Error("unreachable"); }
  async unpause(): Promise<never> { throw new Error("unreachable"); }
  async isPaused(): Promise<never> { throw new Error("unreachable"); }
  async getPosition(): Promise<never> { throw new Error("unreachable"); }
  async getAnnSplits(): Promise<never> { throw new Error("unreachable"); }
  async getYieldOwed(): Promise<never> { throw new Error("unreachable"); }
  async getTotals(): Promise<never> { throw new Error("unreachable"); }
  async getGovernanceState(): Promise<never> { throw new Error("unreachable"); }
  subscribe(): () => void {
    throw new Error("unreachable");
  }
}
