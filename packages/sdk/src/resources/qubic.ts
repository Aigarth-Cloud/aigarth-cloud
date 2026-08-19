import { BaseResource, toQueryString } from "./_base.js";
import type {
  QubicWallet,
  QubicBalance,
  QubicNetwork,
  StakeIntent,
  Stake,
  StakeStatus,
  QubicValidator,
  QubicNetworkStatus,
  TreasuryMovement,
  MovementKind,
  MovementStatus,
} from "../types/qubic.js";

/**
 * /v1/qubic/* — Qubic integration service.
 *
 *   const wallets = await client.qubic.wallets.list();
 *   const bal = await client.qubic.wallets.balance(wallets.data[0].id);
 *   const intent = await client.qubic.stakes.createIntent({ ... });
 *
 * The Qubic service handles wallet linking, multi-sig treasury,
 * staking flow, and validator onboarding. All amounts are strings
 * to preserve QUBIC precision (smallest unit = 1).
 */
export class QubicResource extends BaseResource {
  // ============================================================================
  // Wallets
  // ============================================================================

  readonly wallets = {
    list: (): Promise<{ data: QubicWallet[] }> =>
      this.request<{ data: QubicWallet[] }>("/v1/qubic/wallets", { method: "GET" }),

    retrieve: (id: string): Promise<QubicWallet> =>
      this.request<QubicWallet>(`/v1/qubic/wallets/${encodeURIComponent(id)}`, {
        method: "GET",
      }),

    link: (params: {
      qubic_address: string;
      network: QubicNetwork;
      signature: string;
      nonce: string;
    }): Promise<QubicWallet> =>
      this.request<QubicWallet>("/v1/qubic/wallets", {
        method: "POST",
        body: JSON.stringify(params),
      }),

    balance: (id: string, opts?: { refresh?: boolean }): Promise<QubicBalance> => {
      const query = opts?.refresh ? "?refresh=true" : "";
      return this.request<QubicBalance>(
        `/v1/qubic/wallets/${encodeURIComponent(id)}/balance${query}`,
        { method: "GET" },
      );
    },

    authorizeStaking: (id: string, opts?: { expiresInDays?: number }): Promise<QubicWallet> =>
      this.request<QubicWallet>(
        `/v1/qubic/wallets/${encodeURIComponent(id)}/authorize-staking`,
        {
          method: "POST",
          body: JSON.stringify(opts ?? {}),
        },
      ),
  };

  // ============================================================================
  // Stakes
  // ============================================================================

  readonly stakes = {
    createIntent: (params: {
      wallet_id: string;
      amount_qubic: string;
      epochs_locked: number;
      receiver_address: string;
    }): Promise<StakeIntent> =>
      this.request<StakeIntent>("/v1/qubic/stakes/intent", {
        method: "POST",
        body: JSON.stringify(params),
      }),

    submit: (
      id: string,
      params: { signature: string; tick_number: number },
    ): Promise<{ stake: Stake; tx_hash: string }> =>
      this.request(`/v1/qubic/stakes/${encodeURIComponent(id)}/submit`, {
        method: "POST",
        body: JSON.stringify(params),
      }),

    list: (params?: { status?: StakeStatus; limit?: number }): Promise<{ data: Stake[] }> => {
      const query = toQueryString(params ?? {});
      return this.request<{ data: Stake[] }>(`/v1/qubic/stakes${query}`, { method: "GET" });
    },

    retrieve: (id: string): Promise<Stake> =>
      this.request<Stake>(`/v1/qubic/stakes/${encodeURIComponent(id)}`, { method: "GET" }),

    cancel: (id: string): Promise<{ ok: true }> =>
      this.request(`/v1/qubic/stakes/${encodeURIComponent(id)}/cancel`, {
        method: "POST",
      }),

    release: (id: string): Promise<Stake> =>
      this.request<Stake>(`/v1/qubic/stakes/${encodeURIComponent(id)}/release`, {
        method: "POST",
      }),
  };

  // ============================================================================
  // Treasury
  // ============================================================================

  readonly treasury = {
    createMovement: (params: {
      kind: MovementKind;
      amount_qubic: string;
      counterparty: string;
      signers_required: number;
    }): Promise<TreasuryMovement> =>
      this.request<TreasuryMovement>("/v1/qubic/treasury/movements", {
        method: "POST",
        body: JSON.stringify(params),
      }),

    listMovements: (params?: {
      status?: MovementStatus;
      limit?: number;
    }): Promise<{ data: TreasuryMovement[] }> => {
      const query = toQueryString(params ?? {});
      return this.request<{ data: TreasuryMovement[] }>(
        `/v1/qubic/treasury/movements${query}`,
        { method: "GET" },
      );
    },

    sign: (
      id: string,
      params: { signature: string; signer_address: string },
    ): Promise<TreasuryMovement> =>
      this.request(`/v1/qubic/treasury/movements/${encodeURIComponent(id)}/sign`, {
        method: "POST",
        body: JSON.stringify(params),
      }),

    execute: (id: string, params: { tx_hash: string }): Promise<TreasuryMovement> =>
      this.request(`/v1/qubic/treasury/movements/${encodeURIComponent(id)}/execute`, {
        method: "POST",
        body: JSON.stringify(params),
      }),
  };

  // ============================================================================
  // Validators
  // ============================================================================

  readonly validators = {
    list: (params?: { limit?: number }): Promise<{ data: QubicValidator[] }> => {
      const query = params?.limit ? `?limit=${params.limit}` : "";
      return this.request<{ data: QubicValidator[] }>(`/v1/qubic/validators${query}`, {
        method: "GET",
      });
    },

    onboard: (computorIndex: number): Promise<QubicValidator> =>
      this.request<QubicValidator>(
        `/v1/qubic/validators/${encodeURIComponent(computorIndex)}/onboard`,
        { method: "POST" },
      ),
  };

  // ============================================================================
  // Network
  // ============================================================================

  readonly network = {
    status: (): Promise<QubicNetworkStatus> =>
      this.request<QubicNetworkStatus>("/v1/qubic/network/status", { method: "GET" }),
  };
}
