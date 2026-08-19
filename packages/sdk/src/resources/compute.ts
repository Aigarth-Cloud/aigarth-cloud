import { BaseResource, toQueryString } from "./_base.js";
import type {
  Region,
  RegionStats,
  Cluster,
  ClusterMember,
  Job,
  JobSubmitResponse,
  JobStatus,
  JobType,
  Reservation,
  ReservationReleaseResponse,
  ReservationStatus,
  CapacityCredit,
  UserStats,
  NodeReservation,
  NodeReservationStatus,
  CreateNodeReservationResponse,
  ConfirmNodeReservationResponse,
  ReleaseNodeReservationResponse,
} from "../types/compute.js";

/**
 * /v1/compute/* — Aigarth Core compute service.
 *
 *   const regions = await client.compute.regions.list();
 *   const job = await client.compute.jobs.submit({ type: "inference", ... });
 *   const credit = await client.compute.credit();
 *
 * Wraps the orchestrator that brokers jobs onto Qubic computors.
 */
export class ComputeResource extends BaseResource {
  // ============================================================================
  // Regions
  // ============================================================================

  readonly regions = {
    list: (): Promise<{ data: Region[] }> =>
      this.request<{ data: Region[] }>("/v1/compute/regions", { method: "GET" }),

    retrieve: (id: string): Promise<Region> =>
      this.request<Region>(`/v1/compute/regions/${encodeURIComponent(id)}`, { method: "GET" }),

    create: (params: {
      name: string;
      slug: string;
      description?: string;
      computor_count: number;
    }): Promise<Region> =>
      this.request<Region>("/v1/compute/regions", {
        method: "POST",
        body: JSON.stringify(params),
      }),

    stats: (id: string): Promise<RegionStats> =>
      this.request<RegionStats>(`/v1/compute/regions/${encodeURIComponent(id)}/stats`, {
        method: "GET",
      }),
  };

  // ============================================================================
  // Clusters
  // ============================================================================

  readonly clusters = {
    list: (params?: { regionId?: string }): Promise<{ data: Cluster[] }> => {
      const query = params?.regionId ? `?regionId=${encodeURIComponent(params.regionId)}` : "";
      return this.request<{ data: Cluster[] }>(`/v1/compute/clusters${query}`, { method: "GET" });
    },

    retrieve: (id: string): Promise<Cluster> =>
      this.request<Cluster>(`/v1/compute/clusters/${encodeURIComponent(id)}`, { method: "GET" }),

    create: (params: {
      region_id: string;
      name: string;
      slug: string;
      purpose?: string;
      min_computors: number;
    }): Promise<Cluster> =>
      this.request<Cluster>("/v1/compute/clusters", {
        method: "POST",
        body: JSON.stringify(params),
      }),

    listMembers: (id: string): Promise<{ cluster_id: string; data: ClusterMember[] }> =>
      this.request(`/v1/compute/clusters/${encodeURIComponent(id)}/members`, { method: "GET" }),

    addMember: (id: string, params: { computorIndex: number }): Promise<ClusterMember> =>
      this.request<ClusterMember>(`/v1/compute/clusters/${encodeURIComponent(id)}/members`, {
        method: "POST",
        body: JSON.stringify(params),
      }),

    removeMember: (id: string, computorIndex: number): Promise<{ ok: true }> =>
      this.request(
        `/v1/compute/clusters/${encodeURIComponent(id)}/members/${encodeURIComponent(computorIndex)}`,
        { method: "DELETE" },
      ),
  };

  // ============================================================================
  // Jobs
  // ============================================================================

  readonly jobs = {
    submit: (params: {
      type: JobType;
      payload: Record<string, unknown>;
      priority?: number;
      cluster_id?: string;
      region_id?: string;
      reservation_id?: string;
      deadline_seconds?: number;
    }): Promise<JobSubmitResponse> =>
      this.request<JobSubmitResponse>("/v1/compute/jobs", {
        method: "POST",
        body: JSON.stringify(params),
      }),

    list: (params?: { status?: JobStatus; limit?: number }): Promise<{ data: Job[] }> => {
      const query = toQueryString(params ?? {});
      return this.request<{ data: Job[] }>(`/v1/compute/jobs${query}`, { method: "GET" });
    },

    retrieve: (id: string): Promise<Job> =>
      this.request<Job>(`/v1/compute/jobs/${encodeURIComponent(id)}`, { method: "GET" }),

    cancel: (id: string): Promise<Job> =>
      this.request<Job>(`/v1/compute/jobs/${encodeURIComponent(id)}/cancel`, { method: "POST" }),

    /** Test/dev helper: flip queued -> submitted. */
    broadcast: (id: string): Promise<Job> =>
      this.request<Job>(`/v1/compute/jobs/${encodeURIComponent(id)}/broadcast`, { method: "POST" }),

    /** Test/dev helper: mark a submitted job as running. */
    start: (id: string): Promise<Job> =>
      this.request<Job>(`/v1/compute/jobs/${encodeURIComponent(id)}/start`, { method: "POST" }),

    /** Test/dev helper: mark as completed (or failed). */
    complete: (id: string, params?: { result?: Record<string, unknown>; errorMessage?: string }): Promise<Job> =>
      this.request<Job>(`/v1/compute/jobs/${encodeURIComponent(id)}/complete`, {
        method: "POST",
        body: JSON.stringify(params ?? {}),
      }),
  };

  // ============================================================================
  // Reservations
  // ============================================================================

  readonly reservations = {
    create: (params: {
      qubic_wallet_id: string;
      principal_qubic: string;
      epochs: number;
      fee_bps: number;
    }): Promise<Reservation> =>
      this.request<Reservation>("/v1/compute/reservations", {
        method: "POST",
        body: JSON.stringify(params),
      }),

    list: (params?: {
      status?: ReservationStatus;
      limit?: number;
    }): Promise<{ data: Reservation[] }> => {
      const query = toQueryString(params ?? {});
      return this.request<{ data: Reservation[] }>(`/v1/compute/reservations${query}`, {
        method: "GET",
      });
    },

    retrieve: (id: string): Promise<Reservation> =>
      this.request<Reservation>(`/v1/compute/reservations/${encodeURIComponent(id)}`, {
        method: "GET",
      }),

    release: (id: string): Promise<ReservationReleaseResponse> =>
      this.request<ReservationReleaseResponse>(
        `/v1/compute/reservations/${encodeURIComponent(id)}/release`,
        { method: "POST" },
      ),
  };

  // ============================================================================
  // Credit + stats
  // ============================================================================

  /** Convenience: get the user's capacity credit. */
  credit(): Promise<CapacityCredit> {
    return this.request<CapacityCredit>("/v1/compute/credits", { method: "GET" });
  }

  /** Convenience: get the user's job stats. */
  stats(): Promise<UserStats> {
    return this.request<UserStats>("/v1/compute/stats", { method: "GET" });
  }

  // ============================================================================
  // Node reservations (Phase 24 — hardware presale)
  // ============================================================================

  readonly nodeReservations = {
    create: (params: { tier: 1 | 2 | 3; yieldOptIn?: boolean }): Promise<CreateNodeReservationResponse> =>
      this.request<CreateNodeReservationResponse>("/v1/nodes/reservations", {
        method: "POST",
        body: JSON.stringify(params),
      }),

    list: (params?: {
      status?: NodeReservationStatus;
      limit?: number;
    }): Promise<{ data: NodeReservation[] }> => {
      const query = toQueryString(params ?? {});
      return this.request<{ data: NodeReservation[] }>(`/v1/nodes/reservations${query}`, {
        method: "GET",
      });
    },

    retrieve: (id: string): Promise<NodeReservation> =>
      this.request<NodeReservation>(`/v1/nodes/reservations/${encodeURIComponent(id)}`, {
        method: "GET",
      }),

    fund: (
      id: string,
      params: { txHashReserve: string; depositQubic: string; qubicUsdRateScaled: string },
    ): Promise<NodeReservation> =>
      this.request<NodeReservation>(
        `/v1/nodes/reservations/${encodeURIComponent(id)}/fund`,
        { method: "POST", body: JSON.stringify(params) },
      ),

    confirm: (
      id: string,
      params: {
        txHashConfirm: string;
        balanceQubic: string;
        qubicUsdRateScaled: string;
        yieldCreditQubic?: string;
      },
    ): Promise<ConfirmNodeReservationResponse> =>
      this.request<ConfirmNodeReservationResponse>(
        `/v1/nodes/reservations/${encodeURIComponent(id)}/confirm`,
        { method: "POST", body: JSON.stringify(params) },
      ),

    release: (
      id: string,
      params?: { qubicUsdRateScaled?: string },
    ): Promise<ReleaseNodeReservationResponse> =>
      this.request<ReleaseNodeReservationResponse>(
        `/v1/nodes/reservations/${encodeURIComponent(id)}/release`,
        { method: "POST", body: JSON.stringify(params ?? {}) },
      ),
  };
}
