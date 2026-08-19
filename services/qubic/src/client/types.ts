/**
 * Qubic RPC client interface.
 *
 * The Qubic network exposes a custom TCP protocol; some community-run
 * nodes also expose HTTP gateways. We define a small interface that
 * any implementation can satisfy, then ship:
 *   - `StubQubicClient` — deterministic in-memory mock for local dev
 *   - `HttpQubicClient` — generic JSON-over-HTTP (works with any node
 *     that exposes a JSON gateway; we don't depend on a specific one)
 *
 * The TCP client (the "real" thing) is a single-file addition when needed.
 * See `tcp-client.ts.TODO` for the protocol notes.
 */

export interface QubicTickInfo {
  tickNumber: number;
  epoch: number;
  /** Unix ms when this tick was sealed. */
  sealedAt: number;
}

export interface QubicBalance {
  address: string;
  /** In QUBIC (smallest unit). */
  balanceQubic: bigint;
  /** Tick at which this balance was observed. */
  tickNumber: number;
  observedAt: number;
}

export interface QubicTransaction {
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amountQubic: bigint;
  tickNumber: number;
  status: "broadcast" | "confirmed" | "finalized" | "failed" | "dropped";
  timestamp: number;
}

export interface QubicStakeIntent {
  /** The staker's Qubic address. */
  staker: string;
  /** The address receiving the stake. (Usually a validator or the platform.) */
  receiver: string;
  /** Amount in QUBIC. */
  amountQubic: bigint;
  /** Number of epochs locked. */
  epochsLocked: number;
  /** The epoch the stake starts. */
  startEpoch: number;
  /** The tick the intent is signed for. */
  tickNumber: number;
  /** Signature (base64url-encoded). */
  signature: string;
}

export interface QubicBroadcastResult {
  txHash: string;
  tickNumber: number;
  acceptedAt: number;
}

export interface QubicComputor {
  computorIndex: number;
  qubicAddress: string;
  alias: string | null;
  isActive: boolean;
  performanceScore: number | null;
  stakeQubic: bigint;
}

export interface QubicClient {
  /** Lightweight liveness check. */
  ping(): Promise<{ ok: boolean; latencyMs: number; nodeInfo?: unknown }>;

  /** Current network tick + epoch. */
  getCurrentTick(): Promise<QubicTickInfo>;

  /** Read a wallet's balance. */
  getBalance(address: string): Promise<QubicBalance>;

  /** Recent transactions for an address (inbound + outbound). */
  getTransactionHistory(
    address: string,
    options?: { limit?: number; fromTick?: number },
  ): Promise<QubicTransaction[]>;

  /** Look up a single transaction by hash. */
  getTransaction(txHash: string): Promise<QubicTransaction | null>;

  /** Broadcast a signed stake intent. Returns the assigned tx hash. */
  broadcastStake(intent: QubicStakeIntent): Promise<QubicBroadcastResult>;

  /** List active computors (validators). */
  listComputors(options?: { limit?: number }): Promise<QubicComputor[]>;

  /** Look up a single computor by index. */
  getComputor(index: number): Promise<QubicComputor | null>;
}
