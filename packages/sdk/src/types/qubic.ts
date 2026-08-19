/**
 * Qubic service types — wallets, treasury, staking, validators, network.
 */

export type QubicNetwork = "mainnet" | "testnet";

export interface QubicWallet {
  id: string;
  qubic_address: string;
  network: QubicNetwork;
  stake_authorized: boolean;
  stake_authorization_expires_at: string | null;
  created_at: string;
}

export interface QubicBalance {
  wallet_id: string;
  balance_qubic: string;
  display: string;
  tick_number: number;
  refreshed_at: string;
}

export interface StakeIntent {
  stake_id: string;
  intent_hash: string;
  staker: string;
  receiver: string;
  amount_qubic: string;
  epochs_locked: number;
  start_epoch: number;
  tick_number: number;
  message: string;
  instructions: string;
}

export type StakeStatus = "pending" | "submitted" | "active" | "released" | "cancelled" | "failed";

export interface Stake {
  id: string;
  wallet_id: string;
  principal_qubic: string;
  receiver_address: string;
  start_epoch: number;
  epochs_locked: number;
  status: StakeStatus;
  intent_hash: string | null;
  tx_hash: string | null;
  failure_reason: string | null;
  signed_tick: number | null;
  confirmed_tick: number | null;
  created_at: string;
  released_at: string | null;
}

export interface QubicValidator {
  id: string;
  computor_index: number;
  qubic_address: string;
  alias: string | null;
  is_active: boolean;
  performance_score: number;
  stake_qubic: string;
  last_seen_at: string | null;
}

export interface QubicNetworkStatus {
  tickNumber: number;
  epoch: number;
  sealedAt: number;
}

export type MovementKind = "transfer" | "stake" | "unstake" | "reward" | "burn";
export type MovementStatus = "draft" | "signing" | "ready" | "broadcast" | "executed" | "failed" | "cancelled";

export interface TreasuryMovement {
  id: string;
  kind: MovementKind;
  amount_qubic: string;
  counterparty: string;
  signers_approved: number;
  signers_required: number;
  tx_hash: string | null;
  status: MovementStatus;
  created_at: string;
  executed_at: string | null;
}
