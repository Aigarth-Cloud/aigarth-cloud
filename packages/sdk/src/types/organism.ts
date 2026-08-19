/**
 * Aigarth-specific Organism types.
 *
 *   The Organism is a stateful, evolving, lineage-tracked computational
 *   intelligence. It extends the Trinary primitive (Phase 18) the way
 *   a process extends a function: by adding persistent state.
 *
 *   The wire format from the server is snake_case. The SDK layer
 *   normalises to camelCase for the JS surface; the SDK does the
 *   conversion on the way in (request bodies) and out (responses).
 *
 *   The type values here match the server's enums exactly:
 *     - kind:       'researcher' | 'optimizer' | 'predictor' | 'synthetist' | 'custom'
 *     - status:     'draft' | 'active' | 'paused' | 'deprecated' | 'extinct'
 *     - visibility: 'public' | 'unlisted' | 'private'
 *     - memory:     'short_term' | 'long_term' | 'episodic'
 *
 *   The genome, environment, and objective are JSONB on the server; the
 *   SDK types them as `Record<string, unknown>` for the loose fields
 *   and a stricter shape for the well-known sub-objects. v1 doesn't
 *   validate nested structure; the route does (ADR 005 §10 negative 4).
 */

export type OrganismKind = "researcher" | "optimizer" | "predictor" | "synthetist" | "custom";
export type OrganismStatus = "draft" | "active" | "paused" | "deprecated" | "extinct";
export type OrganismVisibility = "public" | "unlisted" | "private";
export type MemoryKind = "short_term" | "long_term" | "episodic";

/** The mutable genome payload. `version` is a counter incremented on every mutation. */
export interface OrganismGenome {
  version: number;
  tissues?: Array<{ tissueRef: string; weight?: number }>;
  llmHint?: { model: string; promptTemplate: string };
  simulator?: { type: string; config: Record<string, unknown> };
  externalModel?: { endpoint: string; config: Record<string, unknown> };
  mutation: { rate: number; operators: string[] };
  recombination: { enabled: boolean; strategy: "uniform" | "single_point" | "fitness_weighted" };
  /** Free-form extras (the route accepts any object shape). */
  [key: string]: unknown;
}

/** The environment the organism lives in. */
export interface OrganismEnvironment {
  type: string;
  config: Record<string, unknown>;
  inputStreams?: Array<{ name: string; source: string }>;
  oracleSubscriptions?: Array<{ name: string; om: string }>;
  feedbackChannels?: Array<{ name: string; target: string }>;
  [key: string]: unknown;
}

/** The objective / fitness specification. */
export interface OrganismObjective {
  fitnessFunction: string;
  weights: Record<string, number>;
  thresholds: { minFitness: number; maxStallGenerations: number };
  [key: string]: unknown;
}

/** A lineaged, stateful, fitness-scored object. The Phase 26 primitive. */
export interface Organism {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  creatorId: string;
  visibility: OrganismVisibility;
  status: OrganismStatus;
  kind: OrganismKind;
  genome: OrganismGenome;
  environment: OrganismEnvironment;
  objective: OrganismObjective;
  fitness: number | null;
  parentId: string | null;
  rootId: string;
  generation: number;
  computeConsumed: Record<string, number>;
  birthAt: string | null;
  deathAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A memory entry — append-only, signed. */
export interface OrganismMemory {
  id: string;
  organismId: string;
  kind: MemoryKind;
  /** The caller-supplied payload + the platform's HMAC signature under `payload.signature`. */
  payload: Record<string, unknown>;
  writtenAt: string;
  expiresAt: string | null;
}

/** One row in the append-only fitness history. */
export interface OrganismFitnessEntry {
  id: string;
  organismId: string;
  generation: number;
  fitness: number;
  components: Record<string, number>;
  recordedAt: string;
}

/** A node in the recursive descendants tree. */
export interface OrganismLineageNode {
  id: string;
  slug: string;
  name: string;
  generation: number;
  parent_id: string | null;
  children: OrganismLineageNode[];
}
