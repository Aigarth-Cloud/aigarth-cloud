/**
 * Minimal type declaration for the cross-service Qubic stub import.
 *
 * The Qearn watcher uses `StubQubicClient` from services/qubic in
 * dev. We declare just the surface we need here so `tsc` is happy
 * without making services/economy depend on services/qubic's
 * tsconfig paths.
 *
 * The runtime import resolves through pnpm's workspace symlinks to
 * `services/qubic/src/client/stub.js` (the .js extension is the
 * ESM-style import of the TS file).
 */

declare module "../types/qubic-stub.js" {
  export class StubQubicClient {
    constructor();
    getCurrentTick(): Promise<{ tickNumber: number; epoch: number; sealedAt: number }>;
    getTransactionHistory(
      address: string,
      options?: { limit?: number; fromTick?: number },
    ): Promise<
      Array<{
        txHash: string;
        fromAddress: string;
        toAddress: string;
        amountQubic: bigint;
        tickNumber: number;
        status: string;
        timestamp: number;
      }>
    >;
  }
}
