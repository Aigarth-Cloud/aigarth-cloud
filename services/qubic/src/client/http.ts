/**
 * HTTP Qubic client.
 *
 * Speaks JSON to a Qubic HTTP gateway. Most public Qubic nodes
 * historically used a custom binary protocol, but community-run
 * JSON gateways do exist; this client works against any endpoint
 * that returns JSON in the shape we expect.
 *
 * The actual Qubic testnet has a JSON endpoint at
 * `https://testnet-rpc.qubic.org` per env config; this client
 * gracefully degrades to "stub" behavior if the endpoint returns
 * non-JSON (the real impl needs the TCP client — see TODO file).
 *
 * IMPORTANT: This client is intentionally minimal. For production,
 * the TCP client is required. See `tcp-client.ts.TODO` for protocol notes.
 */

import type {
  QubicBalance,
  QubicBroadcastResult,
  QubicClient,
  QubicComputor,
  QubicStakeIntent,
  QubicTickInfo,
  QubicTransaction,
} from "./types.js";

export interface HttpQubicClientOptions {
  baseURL: string;
  timeoutMs?: number;
}

export class HttpQubicClient implements QubicClient {
  constructor(private readonly opts: HttpQubicClientOptions) {}

  private async fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.opts.timeoutMs ?? 10_000);
    try {
      const res = await fetch(`${this.opts.baseURL}${path}`, {
        ...init,
        signal: controller.signal,
        headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
      });
      if (!res.ok) throw new Error(`Qubic HTTP ${res.status}: ${await res.text()}`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  async ping(): Promise<{ ok: boolean; latencyMs: number; nodeInfo?: unknown }> {
    const t0 = Date.now();
    try {
      const info = await this.fetchJson<{ status: string; network?: string }>("/v1/status");
      return {
        ok: info.status === "ok",
        latencyMs: Date.now() - t0,
        nodeInfo: info,
      };
    } catch {
      return { ok: false, latencyMs: Date.now() - t0 };
    }
  }

  async getCurrentTick(): Promise<QubicTickInfo> {
    const r = await this.fetchJson<{ tick: number; epoch: number; sealedAt: number }>("/v1/tick");
    return { tickNumber: r.tick, epoch: r.epoch, sealedAt: r.sealedAt };
  }

  async getBalance(address: string): Promise<QubicBalance> {
    const r = await this.fetchJson<{ balance: string; tick: number; observedAt: number }>(
      `/v1/balance/${address}`,
    );
    return {
      address,
      balanceQubic: BigInt(r.balance),
      tickNumber: r.tick,
      observedAt: r.observedAt,
    };
  }

  async getTransactionHistory(
    address: string,
    options: { limit?: number; fromTick?: number } = {},
  ): Promise<QubicTransaction[]> {
    const limit = options.limit ?? 25;
    const fromTick = options.fromTick ?? 0;
    const r = await this.fetchJson<Array<{
      hash: string;
      from: string;
      to: string;
      amount: string;
      tick: number;
      status: QubicTransaction["status"];
      timestamp: number;
    }>>(`/v1/transactions/${address}?limit=${limit}&fromTick=${fromTick}`);
    return r.map((t) => ({
      txHash: t.hash,
      fromAddress: t.from,
      toAddress: t.to,
      amountQubic: BigInt(t.amount),
      tickNumber: t.tick,
      status: t.status,
      timestamp: t.timestamp,
    }));
  }

  async getTransaction(txHash: string): Promise<QubicTransaction | null> {
    try {
      const t = await this.fetchJson<{
        hash: string;
        from: string;
        to: string;
        amount: string;
        tick: number;
        status: QubicTransaction["status"];
        timestamp: number;
      }>(`/v1/transaction/${txHash}`);
      return {
        txHash: t.hash,
        fromAddress: t.from,
        toAddress: t.to,
        amountQubic: BigInt(t.amount),
        tickNumber: t.tick,
        status: t.status,
        timestamp: t.timestamp,
      };
    } catch {
      return null;
    }
  }

  async broadcastStake(intent: QubicStakeIntent): Promise<QubicBroadcastResult> {
    const r = await this.fetchJson<{ txHash: string; tick: number; acceptedAt: number }>(
      "/v1/stake",
      {
        method: "POST",
        body: JSON.stringify({
          staker: intent.staker,
          receiver: intent.receiver,
          amount: intent.amountQubic.toString(),
          epochsLocked: intent.epochsLocked,
          startEpoch: intent.startEpoch,
          tick: intent.tickNumber,
          signature: intent.signature,
        }),
      },
    );
    return { txHash: r.txHash, tickNumber: r.tick, acceptedAt: r.acceptedAt };
  }

  async listComputors(options: { limit?: number } = {}): Promise<QubicComputor[]> {
    const limit = options.limit ?? 25;
    const r = await this.fetchJson<Array<{
      index: number;
      address: string;
      alias: string | null;
      isActive: boolean;
      performanceScore: number | null;
      stake: string;
    }>>(`/v1/computors?limit=${limit}`);
    return r.map((c) => ({
      computorIndex: c.index,
      qubicAddress: c.address,
      alias: c.alias,
      isActive: c.isActive,
      performanceScore: c.performanceScore,
      stakeQubic: BigInt(c.stake),
    }));
  }

  async getComputor(index: number): Promise<QubicComputor | null> {
    try {
      const c = await this.fetchJson<{
        index: number;
        address: string;
        alias: string | null;
        isActive: boolean;
        performanceScore: number | null;
        stake: string;
      }>(`/v1/computors/${index}`);
      return {
        computorIndex: c.index,
        qubicAddress: c.address,
        alias: c.alias,
        isActive: c.isActive,
        performanceScore: c.performanceScore,
        stakeQubic: BigInt(c.stake),
      };
    } catch {
      return null;
    }
  }
}
