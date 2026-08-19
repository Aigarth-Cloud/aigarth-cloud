/**
 * Tissue service adapter for the internal dashboard.
 *
 *   Wraps the SDK calls and normalizes the wire shape into the
 *   flat types the view component expects. All network errors
 *   are caught and surfaced as empty arrays so the dashboard
 *   remains readable even when the tissue service is down.
 */

interface RawTissue {
  id: string;
  slug: string;
  name: string;
  status: string;
  policy_kind: string;
  access: string;
  total_decisions: string;
  created_at: string;
}

interface RawTissueDecision {
  id: string;
  tissue_id: string;
  state: number;
  confidence: string;
  authority: string;
  reasoning: string;
  reversibility: string;
  time_horizon: string;
  signature: string;
  latency_ms: number;
  issued_at: string;
  created_at: string;
}

export interface DashboardTissue {
  id: string;
  slug: string;
  name: string;
  status: string;
  policyKind: string;
  access: string;
  totalDecisions: number;
  createdAt: string;
}

export interface DashboardTissueDecision {
  id: string;
  tissueId: string;
  tissueSlug: string;
  state: -1 | 0 | 1;
  confidence: number;
  authority: number;
  reasoning: string;
  reversibility: string;
  timeHorizon: string;
  signature: string;
  latencyMs: number;
  issuedAt: string;
  createdAt: string;
}

const TISSUE_SERVICE_URL = process.env["TISSUE_SERVICE_URL"] ?? "http://localhost:7008";
const DASHBOARD_API_KEY = process.env["DASHBOARD_API_KEY"] ?? "";

async function call<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${TISSUE_SERVICE_URL}${path}`, {
      headers: DASHBOARD_API_KEY ? { authorization: `Bearer ${DASHBOARD_API_KEY}` } : {},
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function loadAllTissues(): Promise<DashboardTissue[]> {
  const res = await call<{ data: RawTissue[] }>("/v1/tissues?limit=100");
  if (!res) return [];
  return res.data.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    status: t.status,
    policyKind: t.policy_kind,
    access: t.access,
    totalDecisions: Number(t.total_decisions ?? "0"),
    createdAt: t.created_at,
  }));
}

export async function loadRecentTissueDecisions(limit = 50): Promise<DashboardTissueDecision[]> {
  // The /v1/tissues list endpoint doesn't return decisions; we have to
  // fan out per tissue. For a Phase 18E MVP we cap at the first 20
  // tissues and merge. v2 should add a global /v1/decisions endpoint.
  const tissues = await loadAllTissues();
  const recent: DashboardTissueDecision[] = [];
  const perTissue = Math.max(2, Math.floor(limit / Math.max(1, tissues.length)));
  for (const t of tissues.slice(0, 20)) {
    const res = await call<{ data: RawTissueDecision[] }>(
      `/v1/tissues/${t.id}/decisions?limit=${perTissue}`,
    );
    if (!res) continue;
    for (const d of res.data) {
      recent.push({
        id: d.id,
        tissueId: d.tissue_id,
        tissueSlug: t.slug,
        state: d.state as -1 | 0 | 1,
        confidence: Number(d.confidence),
        authority: Number(d.authority),
        reasoning: d.reasoning,
        reversibility: d.reversibility,
        timeHorizon: d.time_horizon,
        signature: d.signature,
        latencyMs: d.latency_ms,
        issuedAt: d.issued_at,
        createdAt: d.created_at,
      });
    }
  }
  return recent
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit);
}
