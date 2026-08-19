/**
 * Tissue service types — Phase 18E.
 *
 *   Mirrors the @aigarth/tissue service wire contract. A "tissue"
 *   is a composition of ANNs that produces a single signed
 *   trinary decision.
 */

export type TissueStatus = "draft" | "active" | "paused" | "deprecated";
export type TissueVisibility = "public" | "unlisted" | "private";
export type TissueAccess = "open" | "licensed";
export type TissueMemberRole = "voting" | "veto" | "advisory";
export type ConsensusPolicyKind = "majority" | "unanimous" | "any" | "veto_aware" | "short_circuit";

export interface ConsensusPolicy {
  kind: ConsensusPolicyKind;
  threshold?: number;
}

export interface Tissue {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  owner_user_id: string;
  owner_org_id: string | null;
  visibility: TissueVisibility;
  status: TissueStatus;
  version: string;
  policy: ConsensusPolicy;
  policy_kind: ConsensusPolicyKind;
  access: TissueAccess;
  total_decisions: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TissueMember {
  id: string;
  tissue_id: string;
  ann_slug: string;
  ann_id: string | null;
  role: TissueMemberRole;
  authority_weight: string;
  position: number;
  created_at: string;
}

export interface TissueLicense {
  id: string;
  tissue_id: string;
  grantee_user_id: string | null;
  grantee_org_id: string | null;
  source: string;
  expires_at: string | null;
  max_decisions: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface TissueDecision {
  id: string;
  tissue_id: string;
  tissue_version: string;
  request_id: string;
  state: -1 | 0 | 1;
  confidence: string;
  authority: string;
  reasoning: string;
  reversibility: "irreversible" | "soft" | "advisory";
  time_horizon: "immediate" | "session" | "persistent";
  contributors: Array<Record<string, unknown>>;
  ignored: Array<Record<string, unknown>>;
  envelope: Record<string, unknown>;
  signature: string;
  issued_at: string;
  expires_at: string | null;
  latency_ms: number;
  created_at: string;
}

export interface ListTissuesParams {
  q?: string;
  status?: TissueStatus;
  visibility?: TissueVisibility;
  policyKind?: ConsensusPolicyKind;
  owner?: string;
  sort?: "newest" | "popular" | "alpha";
  limit?: number;
  offset?: number;
}

export interface ListTissuesResponse {
  data: Tissue[];
  total: number;
  limit: number;
  offset: number;
}

export interface ListDecisionsResponse {
  data: TissueDecision[];
  next_cursor: string | null;
  has_more: boolean;
}
