import { BaseResource, toQueryString } from "./_base.js";
import type {
  Tissue,
  TissueMember,
  TissueLicense,
  TissueDecision,
  ConsensusPolicy,
  ConsensusPolicyKind,
  TissueAccess,
  TissueStatus,
  TissueVisibility,
  ListTissuesParams,
  ListTissuesResponse,
  ListDecisionsResponse,
} from "../types/tissue.js";

/**
 * /v1/tissues + /v1/tissues/:id/... — Aigarth Tissue service.
 *
 *   A "tissue" is a composition of ANNs that produces a single
 *   signed trinary decision. This is the Phase 18E productization
 *   surface for the Trinary Intelligence Layer (see ADR 003).
 *
 *   const tissue = await client.tissues.retrieve("tissue_executive_v1");
 *   const decision = await client.tissues.decide("tissue_executive_v1", {
 *     input: { deal_size_qubic: 5000, counterparty: "acme" },
 *   });
 *   const history = await client.tissues.listDecisions("tissue_executive_v1");
 *
 *   For monetization, see `client.marketplace.tissueListings`.
 */
export class Tissues extends BaseResource {
  // ---------- Public ----------

  async list(params: ListTissuesParams = {}): Promise<ListTissuesResponse> {
    const query = toQueryString({
      q: params.q,
      status: params.status,
      visibility: params.visibility,
      policy_kind: params.policyKind,
      owner: params.owner,
      sort: params.sort,
      limit: params.limit,
      offset: params.offset,
    });
    return this.request<ListTissuesResponse>(`/v1/tissues${query}`, { method: "GET" });
  }

  async retrieve(idOrSlug: string): Promise<Tissue> {
    return this.request<Tissue>(`/v1/tissues/${encodeURIComponent(idOrSlug)}`, { method: "GET" });
  }

  async listMembers(idOrSlug: string): Promise<{ data: TissueMember[] }> {
    return this.request<{ data: TissueMember[] }>(
      `/v1/tissues/${encodeURIComponent(idOrSlug)}/members`,
      { method: "GET" },
    );
  }

  async listDecisions(
    idOrSlug: string,
    params: { limit?: number; before?: string; state?: -1 | 0 | 1 } = {},
  ): Promise<ListDecisionsResponse> {
    const query = toQueryString(params);
    return this.request<ListDecisionsResponse>(
      `/v1/tissues/${encodeURIComponent(idOrSlug)}/decisions${query}`,
      { method: "GET" },
    );
  }

  // ---------- Authenticated (mutation) ----------

  async create(params: {
    name: string;
    slug?: string;
    tagline: string;
    description: string;
    visibility?: TissueVisibility;
    policy: ConsensusPolicy;
    access?: TissueAccess;
    metadata?: Record<string, unknown>;
  }): Promise<Tissue> {
    return this.request<Tissue>("/v1/tissues", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async update(
    idOrSlug: string,
    params: Partial<{
      name: string;
      tagline: string;
      description: string;
      visibility: TissueVisibility;
      access: TissueAccess;
      metadata: Record<string, unknown>;
    }>,
  ): Promise<Tissue> {
    return this.request<Tissue>(`/v1/tissues/${encodeURIComponent(idOrSlug)}`, {
      method: "PATCH",
      body: JSON.stringify(params),
    });
  }

  async publish(idOrSlug: string): Promise<Tissue> {
    return this.request<Tissue>(
      `/v1/tissues/${encodeURIComponent(idOrSlug)}/publish`,
      { method: "POST" },
    );
  }

  async pause(idOrSlug: string): Promise<Tissue> {
    return this.request<Tissue>(
      `/v1/tissues/${encodeURIComponent(idOrSlug)}/pause`,
      { method: "POST" },
    );
  }

  async addMember(
    idOrSlug: string,
    params: {
      annSlug: string;
      role?: "voting" | "veto" | "advisory";
      authorityWeight?: number;
      position?: number;
    },
  ): Promise<TissueMember> {
    return this.request<TissueMember>(`/v1/tissues/${encodeURIComponent(idOrSlug)}/members`, {
      method: "POST",
      body: JSON.stringify({
        ann_slug: params.annSlug,
        role: params.role,
        authority_weight: params.authorityWeight,
        position: params.position,
      }),
    });
  }

  async removeMember(idOrSlug: string, memberId: string): Promise<void> {
    await this.request<void>(
      `/v1/tissues/${encodeURIComponent(idOrSlug)}/members/${encodeURIComponent(memberId)}`,
      { method: "DELETE" },
    );
  }

  // ---------- Decisions ----------

  /**
   * Call a tissue. The request is fanned out to every member ANN,
   * combined using the tissue's policy, and signed as a single
   * tissue-level envelope. The returned decision_id is the
   * persistent id; `envelope.signature` is the cryptographic
   * attestation.
   */
  async decide(
    idOrSlug: string,
    params: {
      request_id?: string;
      input?: Record<string, unknown>;
      reversibility?: "irreversible" | "soft" | "advisory";
      time_horizon?: "immediate" | "session" | "persistent";
      /**
       * Phase 18E — optional marketplace listing id. If set, the
       * decision is attributed to that listing for revenue and
       * counter purposes.
       */
      tissue_listing_id?: string;
      /**
       * Phase 18E — optional per-decision cost in QUBIC. Defaults
       * to "0" for open / unlisted calls.
       */
      cost_qubic?: string;
    } = {},
  ): Promise<{
    decision_id: string;
    envelope: Record<string, unknown>;
    contributors: Array<Record<string, unknown>>;
    ignored: Array<Record<string, unknown>>;
    tissue: { id: string; slug: string; name: string; version: string };
    total_latency_ms: number;
    policy: ConsensusPolicyKind;
  }> {
    return this.request(`/v1/tissues/${encodeURIComponent(idOrSlug)}/decide`, {
      method: "POST",
      body: JSON.stringify({
        request_id: params.request_id,
        input: params.input ?? {},
        reversibility: params.reversibility,
        time_horizon: params.time_horizon,
        tissue_listing_id: params.tissue_listing_id,
        cost_qubic: params.cost_qubic,
      }),
    });
  }

  // ---------- Licensing (Phase 18E) ----------

  async listLicenses(
    idOrSlug: string,
    params: { includeRevoked?: boolean } = {},
  ): Promise<{ data: TissueLicense[] }> {
    const query = toQueryString({
      include_revoked: params.includeRevoked ? "true" : undefined,
    });
    return this.request<{ data: TissueLicense[] }>(
      `/v1/tissues/${encodeURIComponent(idOrSlug)}/licenses${query}`,
      { method: "GET" },
    );
  }

  async grantLicense(
    idOrSlug: string,
    params: {
      granteeUserId?: string;
      granteeOrgId?: string;
      source?: string;
      expiresAt?: string;
      maxDecisions?: string;
    },
  ): Promise<TissueLicense> {
    return this.request<TissueLicense>(`/v1/tissues/${encodeURIComponent(idOrSlug)}/licenses`, {
      method: "POST",
      body: JSON.stringify({
        grantee_user_id: params.granteeUserId,
        grantee_org_id: params.granteeOrgId,
        source: params.source,
        expires_at: params.expiresAt,
        max_decisions: params.maxDecisions,
      }),
    });
  }

  async revokeLicense(idOrSlug: string, licenseId: string): Promise<void> {
    await this.request<void>(
      `/v1/tissues/${encodeURIComponent(idOrSlug)}/licenses/${encodeURIComponent(licenseId)}`,
      { method: "DELETE" },
    );
  }
}
