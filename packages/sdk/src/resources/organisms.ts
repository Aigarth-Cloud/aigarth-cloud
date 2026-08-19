import { BaseResource, toQueryString } from "./_base.js";
import type {
  Organism,
  OrganismLineageNode,
  OrganismFitnessEntry,
  OrganismMemory,
  OrganismKind,
  OrganismStatus,
  OrganismVisibility,
  MemoryKind,
} from "../types/organism.js";

/**
 * /v1/organisms/* — the Aigarth Organism primitive (Phase 26).
 *
 *   The Organism is a stateful, evolving, lineage-tracked computational
 *   intelligence. It extends the Trinary primitive (Phase 18) the way
 *   a process extends a function: by adding persistent state.
 *
 *   const client = new Aigarth({ apiKey: process.env.AIGARTH_API_KEY! });
 *
 *   // Create a draft
 *   const org = await client.organisms.create({
 *     slug: "tire-mvp",
 *     name: "TireMind MVP",
 *     kind: "researcher",
 *     genome: { version: 1, mutation: { rate: 0.05, operators: ["gaussian"] }, recombination: { enabled: true, strategy: "single_point" } },
 *     environment: { type: "tire-mixer", config: {} },
 *     objective: { fitnessFunction: "tire.v1", weights: { wet: 0.4, wear: 0.3 }, thresholds: { minFitness: 0.6, maxStallGenerations: 10 } },
 *   });
 *
 *   // Activate, fork, mutate
 *   await client.organisms.activate(org.slug);
 *   const child = await client.organisms.fork(org.slug);
 *   await client.organisms.mutate(org.slug, { genome: { mutation: { rate: 0.1, operators: ["gaussian", "crossover"] } } });
 *
 *   // Read lineage + history
 *   const tree = await client.organisms.lineage(org.slug);
 *   const fitness = await client.organisms.fitness(org.slug, { limit: 50 });
 *
 *   The SDK does the wire-format conversion (camelCase -> snake_case
 *   on the way in; snake_case -> camelCase on the way out). The server
 *   is snake_case per the existing ANN convention.
 */
export class Organisms extends BaseResource {
  // ---------- Public ----------

  async list(params: {
    visibility?: OrganismVisibility;
    kind?: OrganismKind;
    cursor?: string;
    limit?: number;
  } = {}): Promise<{ data: Organism[]; nextCursor: string | null; limit: number }> {
    const query = toQueryString({
      visibility: params.visibility,
      kind: params.kind,
      cursor: params.cursor,
      limit: params.limit,
    });
    const res = await this.request<{ data: Organism[]; next_cursor: string | null; limit: number }>(
      `/v1/organisms${query}`,
      { method: "GET" },
    );
    return { data: res.data, nextCursor: res.next_cursor, limit: res.limit };
  }

  async retrieve(slug: string): Promise<Organism> {
    return this.request<Organism>(`/v1/organisms/${encodeURIComponent(slug)}`, { method: "GET" });
  }

  async lineage(slug: string): Promise<OrganismLineageNode> {
    return this.request<OrganismLineageNode>(`/v1/organisms/${encodeURIComponent(slug)}/lineage`, {
      method: "GET",
    });
  }

  async fitness(
    slug: string,
    params: { limit?: number; offset?: number } = {},
  ): Promise<{ data: OrganismFitnessEntry[]; nextOffset: number | null; limit: number; offset: number }> {
    const query = toQueryString({ limit: params.limit, offset: params.offset });
    const res = await this.request<{
      data: OrganismFitnessEntry[];
      next_offset: number | null;
      limit: number;
      offset: number;
    }>(`/v1/organisms/${encodeURIComponent(slug)}/fitness${query}`, { method: "GET" });
    return { data: res.data, nextOffset: res.next_offset, limit: res.limit, offset: res.offset };
  }

  async listMemory(
    slug: string,
    params: { kind: MemoryKind; since?: string; limit?: number; cursor?: string },
  ): Promise<{ data: OrganismMemory[]; nextCursor: string | null; limit: number }> {
    const query = toQueryString({
      kind: params.kind,
      since: params.since,
      limit: params.limit,
      cursor: params.cursor,
    });
    const res = await this.request<{ data: OrganismMemory[]; next_cursor: string | null; limit: number }>(
      `/v1/organisms/${encodeURIComponent(slug)}/memory${query}`,
      { method: "GET" },
    );
    return { data: res.data, nextCursor: res.next_cursor, limit: res.limit };
  }

  // ---------- Authenticated (mutation) ----------

  async create(params: {
    slug: string;
    name: string;
    kind: OrganismKind;
    genome: Record<string, unknown>;
    environment: Record<string, unknown>;
    objective: Record<string, unknown>;
    visibility?: OrganismVisibility;
    description?: string;
  }): Promise<Organism> {
    return this.request<Organism>("/v1/organisms", {
      method: "POST",
      body: JSON.stringify({
        slug: params.slug,
        name: params.name,
        kind: params.kind,
        genome: params.genome,
        environment: params.environment,
        objective: params.objective,
        visibility: params.visibility,
        description: params.description,
      }),
    });
  }

  async update(
    slug: string,
    params: Partial<{
      name: string;
      description: string | null;
      visibility: OrganismVisibility;
      objective: Record<string, unknown>;
    }>,
  ): Promise<Organism> {
    return this.request<Organism>(`/v1/organisms/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      body: JSON.stringify(params),
    });
  }

  async activate(slug: string): Promise<Organism> {
    return this.request<Organism>(`/v1/organisms/${encodeURIComponent(slug)}/activate`, {
      method: "POST",
    });
  }

  async pause(slug: string): Promise<Organism> {
    return this.request<Organism>(`/v1/organisms/${encodeURIComponent(slug)}/pause`, {
      method: "POST",
    });
  }

  async fork(slug: string, params: { name?: string; description?: string } = {}): Promise<Organism> {
    return this.request<Organism>(`/v1/organisms/${encodeURIComponent(slug)}/fork`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async mutate(slug: string, params: { genome: Record<string, unknown> }): Promise<Organism> {
    return this.request<Organism>(`/v1/organisms/${encodeURIComponent(slug)}/mutate`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async writeMemory(
    slug: string,
    params: { kind: MemoryKind; payload: Record<string, unknown>; expiresAt?: string },
  ): Promise<OrganismMemory> {
    return this.request<OrganismMemory>(`/v1/organisms/${encodeURIComponent(slug)}/memory`, {
      method: "POST",
      body: JSON.stringify({
        kind: params.kind,
        payload: params.payload,
        expires_at: params.expiresAt,
      }),
    });
  }
}
