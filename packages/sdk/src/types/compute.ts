/**
 * Compute service types — regions, clusters, jobs, reservations, capacity.
 */

export interface Region {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  computor_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RegionStats {
  region: Region;
  cluster_count: number;
  computor_count: number;
  active_job_count: number;
}

export interface Cluster {
  id: string;
  region_id: string;
  name: string;
  slug: string;
  purpose: string | null;
  min_computors: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClusterMember {
  id: string;
  computor_index: number;
  status: "active" | "draining" | "offline";
  joined_at: string;
  last_heartbeat_at: string;
}

export type JobStatus =
  | "queued"
  | "submitted"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type JobType = "inference" | "training" | "batch" | "embedding" | "custom";

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  priority: number;
  cluster_id: string | null;
  region_id: string | null;
  contract_index: number | null;
  function_index: number | null;
  payload: Record<string, unknown> | null;
  tx_hash: string | null;
  submitted_tick: number | null;
  started_tick: number | null;
  completed_tick: number | null;
  result: Record<string, unknown> | null;
  error_message: string | null;
  credit_used_qubic: string | null;
  reservation_id: string | null;
  submitted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  deadline_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobSubmitResponse extends Job {
  estimated_cost_qubic: string;
  remaining_credit_qubic: string;
}

export type ReservationStatus = "active" | "released" | "expired";

export interface Reservation {
  id: string;
  principal_qubic: string;
  credit_qubic: string;
  used_qubic: string;
  remaining_qubic: string;
  fee_bps: number;
  epochs: number;
  start_epoch: number;
  end_epoch: number;
  status: ReservationStatus;
  tx_hash: string | null;
  qubic_wallet_id: string | null;
  released_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReservationReleaseResponse extends Reservation {
  refund_qubic: string;
  penalty_qubic: string;
}

export interface CapacityCredit {
  user_id: string;
  total_credit_qubic: string;
  used_qubic: string;
  remaining_qubic: string;
  active_reservation_count: number;
}

// ============================================================================
// Phase 24 — hardware presale node reservations
// ============================================================================

export type NodeReservationStatus =
  | "pending_funding"
  | "spot_held"
  | "awaiting_confirm"
  | "confirmed"
  | "released";

export interface NodeReservation {
  id: string;
  user_id: string;
  tier: number;
  status: NodeReservationStatus;
  deposit_usd_cents: string;
  balance_usd_cents: string | null;
  deposit_qubic: string | null;
  balance_qubic: string | null;
  qubic_usd_rate_at_reserve: string | null;
  qubic_usd_rate_at_confirm: string | null;
  yield_opt_in: boolean;
  yield_credit_qubic: string;
  qearn_lock_id: string | null;
  qubic_wallet_id: string | null;
  tx_hash_reserve: string | null;
  tx_hash_confirm: string | null;
  confirm_window_opens_at: string | null;
  confirm_window_closes_at: string | null;
  released_at: string | null;
  auto_released_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NodeReservationTierSpec {
  tier: number;
  deposit_usd_cents: string;
  balance_usd_cents: string;
  label: string;
  description: string;
}

export interface NodeReservationRate {
  rate_scaled: string;
  rate_usd_per_qubic: number;
  source: string;
  fetched_at: string;
}

export interface CreateNodeReservationResponse {
  reservation: NodeReservation;
  tier_spec: NodeReservationTierSpec;
  rate: NodeReservationRate;
  expected_deposit_qubic: string;
  tiers_open: ReadonlyArray<number>;
}

export interface ConfirmNodeReservationResponse extends NodeReservation {
  balance_qubic: string;
  yield_credit_qubic: string;
  net_balance_qubic: string;
}

export interface ReleaseNodeReservationResponse extends NodeReservation {
  refund_qubic: string;
  penalty_qubic: string;
}

export interface UserStats {
  total_jobs: number;
  active_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  cancelled_jobs: number;
  total_spent_qubic: string;
}
