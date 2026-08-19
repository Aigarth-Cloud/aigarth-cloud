/**
 * Server-side Aigarth client factory.
 *
 * Reads the JWT from the session cookie and constructs an Aigarth
 * SDK instance pointed at the 7 local services. Every dashboard
 * page server-component calls this once at the top.
 *
 * If the user isn't logged in, returns `null` and the caller is
 * expected to redirect (the middleware should normally prevent
 * this: see /middleware.ts).
 *
 * NOTE: We import the SDK's compiled dist directly via a relative
 * path instead of the `@aigarth/sdk` package alias. Next.js's
 * bundler follows the workspace symlink to the SDK's src/ folder
 * (which has `.js` extensions in its imports) and chokes on them.
 * The dist is the canonical entry point for Node/bundler consumers.
 *
 * Wave 3 / Phase B note: the SDK dist currently ships without the
 * `organisms` resource (the source has it; the dist is from a
 * pre-Wave 2 build). We use the SDK's public `request<T>` escape
 * hatch to call the organism endpoints directly. The `organisms`
 * wrapper below is a server-only convenience that mirrors the
 * shape of `client.organisms.*` without touching the SDK package.
 */

// Direct dist import bypasses the @aigarth/sdk package alias to avoid
// the .js-extension bundler issue in the SDK's src/.
import { Aigarth, type ServiceUrls } from "../../../../packages/sdk/dist/index.js";
import { getSession } from "./session";

const services = {
  identity:    process.env.AIGARTH_IDENTITY_URL    ?? "http://localhost:7001",
  qubic:       process.env.AIGARTH_QUBIC_URL       ?? "http://localhost:7002",
  compute:     process.env.AIGARTH_COMPUTE_URL     ?? "http://localhost:7003",
  gateway:     process.env.AIGARTH_GATEWAY_URL     ?? "http://localhost:7004",
  billing:     process.env.AIGARTH_BILLING_URL     ?? "http://localhost:7005",
  ann:         process.env.AIGARTH_ANN_URL         ?? "http://localhost:7006",
  marketplace: process.env.AIGARTH_MARKETPLACE_URL ?? "http://localhost:7007",
  tissue:      process.env.AIGARTH_TISSUE_URL      ?? "http://localhost:7008",
  dataset:     process.env.AIGARTH_DATASET_URL     ?? "http://localhost:7009",
};

// ---------- Organism wrapper (server-only) ----------
//
//   Mirrors the SDK's `client.organisms.*` surface using
//   `client.request<T>`. The Wave 2 SDK source has these
//   methods; the dist does not (the dist is from a pre-Wave 2
//   build and rebuilding it is outside this wave's scope).
//   When the SDK dist is rebuilt, the wrapper here can be
//   removed in favor of `client.organisms.*`.

export interface OrganismSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  creator_id: string;
  visibility: string;
  status: string;
  kind: string;
  generation: number;
  fitness: number | null;
  parent_id: string | null;
  root_id: string;
  parent_slug?: string | null;
  root_slug?: string | null;
  birth_at?: string | null;
  death_at?: string | null;
  updated_at: string;
  created_at: string;
}

export interface OrganismListResponse {
  data: OrganismSummary[];
  next_cursor: string | null;
  limit: number;
}

export interface OrganismFitnessPoint {
  id: string;
  organism_id: string;
  generation: number;
  fitness: number;
  components: Record<string, number>;
  recorded_at: string;
}

export interface OrganismFitnessResponse {
  data: OrganismFitnessPoint[];
  next_offset: number | null;
  limit: number;
  offset: number;
}

export interface OrganismLineageNode {
  id: string;
  slug: string;
  name: string;
  generation: number;
  parent_id: string | null;
  children: OrganismLineageNode[];
}

export interface OrganismClient {
  list(params?: {
    visibility?: string;
    kind?: string;
    cursor?: string;
    limit?: number;
  }): Promise<OrganismListResponse>;
  retrieve(slug: string): Promise<OrganismSummary>;
  fitness(
    slug: string,
    params?: { limit?: number; offset?: number },
  ): Promise<OrganismFitnessResponse>;
  lineage(slug: string): Promise<OrganismLineageNode>;
  fork(
    slug: string,
    params?: { name?: string; description?: string },
  ): Promise<OrganismSummary>;
  mutate(
    slug: string,
    params: { genome: Record<string, unknown> },
  ): Promise<OrganismSummary>;
}

function buildOrganismClient(client: Aigarth): OrganismClient {
  const base = client.services.ann;
  return {
    async list(params) {
      const p = params ?? {};
      const qs = new URLSearchParams();
      if (p.visibility) qs.set("visibility", p.visibility);
      if (p.kind) qs.set("kind", p.kind);
      if (p.cursor) qs.set("cursor", p.cursor);
      if (p.limit) qs.set("limit", String(p.limit));
      const query = qs.toString();
      return client.request<OrganismListResponse>(
        `/v1/organisms${query ? `?${query}` : ""}`,
        { method: "GET" },
        base,
      );
    },
    async retrieve(slug) {
      return client.request<OrganismSummary>(
        `/v1/organisms/${encodeURIComponent(slug)}`,
        { method: "GET" },
        base,
      );
    },
    async fitness(slug, params) {
      const p = params ?? {};
      const qs = new URLSearchParams();
      if (p.limit) qs.set("limit", String(p.limit));
      if (p.offset) qs.set("offset", String(p.offset));
      const query = qs.toString();
      return client.request<OrganismFitnessResponse>(
        `/v1/organisms/${encodeURIComponent(slug)}/fitness${query ? `?${query}` : ""}`,
        { method: "GET" },
        base,
      );
    },
    async lineage(slug) {
      return client.request<OrganismLineageNode>(
        `/v1/organisms/${encodeURIComponent(slug)}/lineage`,
        { method: "GET" },
        base,
      );
    },
    async fork(slug, params) {
      return client.request<OrganismSummary>(
        `/v1/organisms/${encodeURIComponent(slug)}/fork`,
        { method: "POST", body: JSON.stringify(params ?? {}) },
        base,
      );
    },
    async mutate(slug, params) {
      return client.request<OrganismSummary>(
        `/v1/organisms/${encodeURIComponent(slug)}/mutate`,
        { method: "POST", body: JSON.stringify(params) },
        base,
      );
    },
  };
}

/**
 * The Aigarth client extended with a few server-only conveniences.
 *
 *   - `organismDetail(slug)` — a typed wrapper around
 *     `organisms.retrieve(slug)` that returns `null` on a 404
 *     instead of throwing. The Organism detail page (Wave 3 /
 *     Phase B, Task 6) uses this to handle "no such organism"
 *     gracefully without sprinkling try/catch at every call site.
 *   - `organisms` — the server-only OrganismClient wrapper
 *     (see above). Mirrors the SDK's `client.organisms.*` shape
 *     so the page code reads naturally; bypasses the stale SDK
 *     dist's missing resource by using `client.request<T>`.
 */
export type AigarthWithExtras = Omit<Aigarth, "organisms"> & {
  organisms: OrganismClient;
  organismDetail: (slug: string) => Promise<OrganismSummary | null>;
};

export function getAigarth(): AigarthWithExtras | null {
  const session = getSession();
  if (!session?.accessToken) return null;
  const client = new Aigarth({
    apiKey: session.accessToken,
    services,
  });
  const organisms = buildOrganismClient(client);
  (client as unknown as AigarthWithExtras).organisms = organisms;
  (client as unknown as AigarthWithExtras).organismDetail = async (slug: string) => {
    try {
      return await organisms.retrieve(slug);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Treat 404 / "not found" as the documented "no such
      // organism" path. Re-throw anything else so the page's
      // error boundary can decide.
      if (msg.toLowerCase().includes("not found") || msg.includes("404")) {
        return null;
      }
      throw err;
    }
  };
  return client as unknown as AigarthWithExtras;
}

export type { Aigarth, ServiceUrls };
