/**
 * Thin wrapper around `services/qubic` for QUBIC settlement.
 *
 * The economy service does NOT talk to the Qubic network directly. It
 * calls into `services/qubic` over HTTP, which holds the actual RPC
 * client (stub or live). This keeps the economy module a *consumer* of
 * the qubic service, never a peer — per ADR 001 §4.1.
 *
 * In dev/stub mode, the broadcast returns a deterministic tx hash from
 * the stub. In live mode, it returns the real Qubic tx hash.
 */

export interface SettlementRequest {
  /** The Qubic address sending QUBIC. */
  fromAddress: string;
  /** The Qubic address receiving QUBIC. */
  toAddress: string;
  /** Amount in QUBIC (smallest unit). */
  amountQubic: bigint;
  /** Optional reference id (e.g. payout_recipient.id) for audit linkage. */
  refType?: string;
  refId?: string;
  /** Optional signature (base64url). Required in live mode; ignored in stub. */
  signature?: string;
}

export interface SettlementResult {
  /** Qubic tx hash assigned by the network (or stub). */
  txHash: string;
  /** Tick the tx was included in (or simulated tick in stub). */
  tickNumber: number;
  /** Unix ms when the broadcast was accepted. */
  acceptedAt: number;
}

export class SettlementError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "SettlementError";
  }
}

/**
 * Call services/qubic to broadcast a transfer. Throws SettlementError
 * on any non-2xx response or transport failure.
 */
export async function settleViaQubicService(
  qubicServiceUrl: string,
  req: SettlementRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<SettlementResult> {
  const url = new URL("/v1/qubic/wallets/transfer", qubicServiceUrl);
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fromAddress: req.fromAddress,
      toAddress: req.toAddress,
      amountQubic: req.amountQubic.toString(),
      refType: req.refType,
      refId: req.refId,
      signature: req.signature,
    }),
  });

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json() as { error?: { message?: string } };
      if (body?.error?.message) detail = body.error.message;
    } catch {
      // body wasn't JSON; keep the status-only detail
    }
    throw new SettlementError(
      `Qubic settlement failed: ${detail}`,
      "QUBIC_SETTLE_FAILED",
      res.status,
    );
  }

  const body = await res.json() as {
    txHash: string;
    tickNumber: number;
    acceptedAt: number;
  };
  return {
    txHash: body.txHash,
    tickNumber: body.tickNumber,
    acceptedAt: body.acceptedAt,
  };
}
