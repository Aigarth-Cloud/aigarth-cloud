# ADR 005 — Organism Primitive (Adopt, Co-locate with ANN)

| Field | Value |
|---|---|
| **Status** | Proposed (acceptance requires a successful Wave 1 build) |
| **Date** | 2026-08-12 |
| **Author** | Aigarth Cloud Architecture Team |
| **Reviewers** | Engineering, Founders |
| **Builds on** | v0.2 PEP §6, ADR 003, Phase 18 (Trinary), Phase 19 (Feedback Loops) |
| **Decides** | Whether to introduce the Organism primitive as a new first-class entity in `services/ann` |
| **Outcome** | Adopt the Organism primitive as a new first-class entity in `services/ann`. Three new tables — `organisms`, `organism_memories`, `organism_fitness_history` — added in Drizzle migration `0006_*`. The new tables are additive; no change to any existing ANN table. Lifecycle is `draft → active → paused → deprecated → extinct`. Co-located with ANN (not a separate service) for the same auth/audit/identity surface. Phase 26.A scope is the three tables; Phase 26.B–26.D layer the routes, marketplace, and Garden UI on top of this contract. Acceptance of this ADR requires a successful Wave 1 build (Build Task 1: the schema migration applies cleanly on a fresh DB with no changes to existing ANN tables). |

---

## 1. Context

The Aigarth Cloud Evolution PEP v0.2 (`docs/proposals/aigarth-cloud-evolution-pep-v0.2.md`) — approved at the 2026-08-12 checkpoint (`docs/evolution/CHECKPOINT-2026-08-12.md:23-25`) — proposes a single new primitive to close the gap between today's "register a model, call it" surface and the platform's stated thesis of growing *adaptive* intelligences: the **Organism**. The PEP's Falsification Audit (`aigarth-cloud-evolution-pep-v0.2.md:43`) is unambiguous about the gap: *"Build an Organism primitive — Not started. Grep returns zero matches for `organism` in any service or apps."*

The superprompt-level definition (`aigarth-cloud-evolution-pep-v0.2.md:173-177`):

```
O = (G, N, M, E, S, A, Φ, H)
```

where `G` = genome, `N` = neural substrate, `M` = memory, `E` = environment, `S` = sensors, `A` = actuators, `Φ` = objectives/fitness, `H` = historical experience. The v0.2 PEP §6 reduces this to three persistent tables — `organisms`, `organism_memories`, `organism_fitness_history` — and a small state machine.

The current `services/ann` schema (`services/ann/src/db/schema.ts:1-22`) ends at `ann_decision_outcomes` (Phase 19D.1) and is unaware of organisms. A `grep -ri organism services/ann` returns zero matches. The ANN lifecycle (`ann_status` enum, `services/ann/src/db/schema.ts:43-48`) is `draft / published / deprecated / suspended` — a four-state, stateless-per-version model. An Organism is a *stateful, lineaged, fitness-scored* object that mutates across experiences, has episodic memory, and forks into parented children. The two lifecycles are not the same.

The PEP §6 (`aigarth-cloud-evolution-pep-v0.2.md:233-234`) is explicit about the distinction: *"Why 'Organism' not 'Tissue': the existing Tissue is stateless per call — it fans out, combines, returns, and the call ends. An Organism is stateful across experiences — its genome mutates, its memory persists, its fitness is tracked across generations, its lineage is parented. Cells → Organs → Bodies."* That distinction is the design constraint: the new primitive holds mutable genome + episodic memory + lineage, not just audit logs.

Trinary (ADR 003) and the Phase 19 feedback loops are the platform's existing decision and learning scaffolding. The Organism sits *on top* of them, not beside them — its genome points at Trinary-aware tissues, and its decision outcomes flow back through the same `ann_decisions` + `ann_decision_outcomes` shape the platform already audits. The PEP §33 First 10 Tasks are sized at ~25 SP total, with the schema migration (Task 1) as the foundation; this ADR is the *contract* that Task 1 (and Tasks 2–6) implement against.

## 2. Decision

**Adopt the Organism primitive as a new first-class entity in `services/ann`. Ship the three new tables in Drizzle migration `0006_*` (Wave 1 Build Task 1). Layer the routes (Tasks 2–4), marketplace (Task 5), and Garden UI (Task 6) on top of the same tables in Wave 2.**

The new tables are **strictly additive** to `services/ann/src/db/schema.ts`. No existing table is altered, no existing column is renamed, and no existing enum is widened. The Organism has its own enum types (`organism_visibility`, `organism_status`) that mirror the `ann_visibility` / `ann_status` pattern from `services/ann/drizzle/0000_modern_gabe_jones.sql:4-5` and `services/ann/src/db/schema.ts:41-48`.

The new entity lives in `services/ann` (not a new service) for the same auth, audit, and identity surface every other primitive in the registry already has. Cross-service refs (`creator_id`) are stored as `uuid` without FK to `services/identity` users — the existing convention from `services/ann/src/db/schema.ts:21-22`.

**What this ADR ships in Wave 1 (Build Task 1):**
- Three new tables: `organisms`, `organism_memories`, `organism_fitness_history`
- Two new enums: `organism_visibility`, `organism_status`
- Six new indexes (per PEP §33 Task 1 — `aigarth-cloud-evolution-pep-v0.2.md:1111`): `organisms_creator_idx`, `organisms_parent_idx`, `organisms_root_idx`, `organisms_status_idx`, `organism_memories_organism_kind_idx`, `organism_fitness_history_organism_idx`; plus the unique `organisms_slug_idx`
- A self-referential FK on `organisms.parent_id` with a `CHECK (parent_id <> id)` constraint
- A `kind` `text` CHECK constraint on `organisms` (`'researcher' | 'optimizer' | 'predictor' | 'synthesist' | 'custom'`) and on `organism_memories` (`'short_term' | 'long_term' | 'episodic'`)
- The additive extension of `services/ann/src/db/schema.ts` (no change to existing exports)

**What this ADR does NOT decide (out of scope):**
- The 12 routes in §8 — *this* ADR names them; *Build Tasks 2–4* implement them. The schema is the contract; the routes are the surface.
- The Work Runtime (ADR 006, port 7012, `services/work`). The Organism emits work items; the Work Runtime executes them. They are coupled but separately governed.
- Marketplace listing (Task 5) and Garden Organism view (Task 6). Both live in their respective services; this ADR only names the underlying tables.
- The fitness function catalog (`@aigarth/fitness:tire.v1`, etc.). Those land in `packages/fitness/` per PEP §9.

## 3. Schema

The full DDL below is the contract. The build stream must emit a Drizzle migration with this shape (drizzle-kit will produce the exact DDL when the TypeScript schema is written to match; the SQL here is the *semantic* source of truth).

```sql
-- ADR 005 — Organism Primitive (additive to services/ann)
-- Drizzle journal entry: 0006_<name>_organism_init.sql
-- Mirrors the ann_visibility / ann_status enum pattern from
-- services/ann/drizzle/0000_modern_gabe_jones.sql:4-5

-- 1. ENUMS ---------------------------------------------------------------

-- Mirrors the ann_visibility enum (services/ann/src/db/schema.ts:41).
-- The Organism's visibility is its discoverability surface; the default
-- is 'private' (creator-first; explicit publish to public), which differs
-- from anns (which default to 'public' for marketplace discovery).
CREATE TYPE "public"."organism_visibility"
  AS ENUM ('public', 'unlisted', 'private');
--> statement-breakpoint

-- Mirrors the ann_status enum (services/ann/src/db/schema.ts:43-48)
-- but adds 'active' and 'paused' as first-class lifecycle states
-- (the ANN contract has 'published' and 'suspended' — see §4 for the
-- full state machine and why the two are not interchangeable).
CREATE TYPE "public"."organism_status"
  AS ENUM ('draft', 'active', 'paused', 'deprecated', 'extinct');
--> statement-breakpoint

-- 2. TABLES --------------------------------------------------------------

-- The Organism is the persistent entity. It holds a mutable genome,
-- an environment, an objective, a denormalized current fitness, a
-- lineage pointer (parent_id + root_id + generation), and a
-- compute-consumed JSONB ledger that the Work Runtime writes to
-- (PEP §8: "the Organism cannot lie about how much compute it burned").
-- The slug is the natural external identifier; the id is internal.
CREATE TABLE "organisms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "creator_id" uuid NOT NULL,                       -- ref users in services/identity
  "visibility" "organism_visibility" DEFAULT 'private' NOT NULL,
  "status" "organism_status" DEFAULT 'draft' NOT NULL,
  "kind" text NOT NULL,                            -- CHECK in {researcher, optimizer, predictor, synthetist, custom}
  "genome" jsonb NOT NULL,                         -- {tissues, llm_hint, simulator, external_model, mutation, recombination}
  "environment" jsonb NOT NULL,                    -- {type, config, input_streams, oracle_subs, feedback_channels}
  "objective" jsonb NOT NULL,                      -- {fitness_function, weights, thresholds}
  "fitness" double precision,                      -- denormalized; truth is organism_fitness_history
  "parent_id" uuid,                                -- self-FK added below; null on founders
  "root_id" uuid NOT NULL,                         -- the founder of the lineage (id on founders)
  "generation" integer DEFAULT 0 NOT NULL,         -- 0 for founders, parent.generation + 1 for children
  "compute_consumed" jsonb DEFAULT '{}'::jsonb NOT NULL,  -- {cpu_s, gpu_s, network_b, work_items, qubic}
  "birth_at" timestamp with time zone,             -- first transition to 'active'
  "death_at" timestamp with time zone,             -- transition to 'extinct'
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone            -- soft-delete; hard-delete is not exposed
);
--> statement-breakpoint

-- Per-organism memory. Three kinds: short_term (expires_at set),
-- long_term (expires_at null), episodic (expires_at null; queryable
-- by generation / since). Entries are append-only; the writer signs
-- the payload (the signing scheme is an Open Question, see §12).
CREATE TABLE "organism_memories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organism_id" uuid NOT NULL,
  "kind" text NOT NULL,                            -- CHECK in {short_term, long_term, episodic}
  "payload" jsonb NOT NULL,
  "written_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone            -- nullable: short_term uses it, long_term/episodic do not (see §6)
);
--> statement-breakpoint

-- Append-only audit log of every measured fitness score. The current
-- "fitness" column on organisms is a denormalization for fast read;
-- the truth is this table. One row per measurement; never updated,
-- never deleted. Reproducibility (PEP §8, test N03) depends on this
-- immutability.
CREATE TABLE "organism_fitness_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organism_id" uuid NOT NULL,
  "generation" integer NOT NULL,                   -- matches organisms.generation at measurement time
  "fitness" double precision NOT NULL,             -- the measured (not declared) value
  "components" jsonb NOT NULL,                     -- per-dimension weights + values (PEP §13)
  "recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- 3. FKs + CHECK CONSTRAINTS ---------------------------------------------

-- Self-FK on parent_id. ON DELETE SET NULL preserves the lineage:
-- deleting a parent (hard delete only; soft-delete does not trigger
-- this) does not delete its children. The child's root_id stays valid.
ALTER TABLE "organisms"
  ADD CONSTRAINT "organisms_parent_fk"
  FOREIGN KEY ("parent_id") REFERENCES "organisms"("id") ON DELETE SET NULL;
--> statement-breakpoint

-- Cycles are impossible by construction. The DB enforces parent_id <> id;
-- the application enforces ancestor-not-equal-descendant via a recursive
-- CTE at insert (Build Task 3, services/ann/src/services/lineage.ts).
-- This CHECK catches the trivial self-parent case; the recursive check
-- catches the rest.
ALTER TABLE "organisms"
  ADD CONSTRAINT "organisms_parent_not_self"
  CHECK ("parent_id" IS NULL OR "parent_id" <> "id");
--> statement-breakpoint

-- kind column constraint on organisms (PEP §6: 'researcher' | 'optimizer' | 'predictor' | 'synthetist' | 'custom')
ALTER TABLE "organisms"
  ADD CONSTRAINT "organisms_kind_check"
  CHECK ("kind" IN ('researcher', 'optimizer', 'predictor', 'synthetist', 'custom'));
--> statement-breakpoint

-- kind column constraint on organism_memories (PEP §6: 'short_term' | 'long_term' | 'episodic')
ALTER TABLE "organism_memories"
  ADD CONSTRAINT "organism_memories_kind_check"
  CHECK ("kind" IN ('short_term', 'long_term', 'episodic'));
--> statement-breakpoint

-- FKs to organisms for the two child tables. Cascade on delete:
-- an organism's memory and fitness history are its identity; they
-- should not survive the (hard-)deleted organism.
ALTER TABLE "organism_memories"
  ADD CONSTRAINT "organism_memories_organism_fk"
  FOREIGN KEY ("organism_id") REFERENCES "organisms"("id") ON DELETE CASCADE;
--> statement-breakpoint

ALTER TABLE "organism_fitness_history"
  ADD CONSTRAINT "organism_fitness_history_organism_fk"
  FOREIGN KEY ("organism_id") REFERENCES "organisms"("id") ON DELETE CASCADE;
--> statement-breakpoint

-- 4. INDEXES -------------------------------------------------------------

-- The slug is the natural external identifier; the API surface resolves
-- organisms by slug (see §8). Unique is mandatory.
CREATE UNIQUE INDEX "organisms_slug_idx" ON "organisms" USING btree ("slug");
--> statement-breakpoint

-- Creator filter ("my organisms") — the Garden UX hits this on every
-- load. Mirrors anns_creator_idx (services/ann/src/db/schema.ts:205).
CREATE INDEX "organisms_creator_idx" ON "organisms" USING btree ("creator_id");
--> statement-breakpoint

-- Lineage walk: parent_id is the join column for the recursive CTE
-- in GET /v1/organisms/:slug/lineage.
CREATE INDEX "organisms_parent_idx" ON "organisms" USING btree ("parent_id");
--> statement-breakpoint

-- Lineage tree root lookup: every organism carries root_id so a
-- single index lookup returns the full tree.
CREATE INDEX "organisms_root_idx" ON "organisms" USING btree ("root_id");
--> statement-breakpoint

-- Status filter for the marketplace + dashboard ("show me active
-- organisms", "show me paused"). Mirrors anns_status_idx
-- (services/ann/src/db/schema.ts:201).
CREATE INDEX "organisms_status_idx" ON "organisms" USING btree ("status");
--> statement-breakpoint

-- Per-organism memory lookup. (organism_id, kind) composite lets
-- the kind=episodic&since=... query hit a single index scan
-- (services/ann/src/routes/organisms.ts, Build Task 4).
CREATE INDEX "organism_memories_organism_idx"
  ON "organism_memories" USING btree ("organism_id");
--> statement-breakpoint
CREATE INDEX "organism_memories_organism_kind_idx"
  ON "organism_memories" USING btree ("organism_id", "kind");
--> statement-breakpoint

-- Fitness history lookup by organism; the API returns paginated
-- history ordered by generation desc.
CREATE INDEX "organism_fitness_history_organism_idx"
  ON "organism_fitness_history" USING btree ("organism_id");
```

The corresponding Drizzle TypeScript addition to `services/ann/src/db/schema.ts` (the build stream writes this; the SQL above is the semantic contract):

```ts
// services/ann/src/db/schema.ts — additive Phase 26.A block
// All new enums are prefixed `organism_` to avoid collision with `ann_*`
// per the existing convention at services/ann/src/db/schema.ts:18-19.

export const organismVisibility = pgEnum("organism_visibility", [
  "public",
  "unlisted",
  "private",
]);

export const organismStatus = pgEnum("organism_status", [
  "draft",
  "active",
  "paused",
  "deprecated",
  "extinct",
]);

export const organisms = pgTable("organisms", {
  // ...columns as in the SQL above...
  parentId: uuid("parent_id").references((): AnyPgColumn => organisms.id, {
    onDelete: "set null",
  }),
  // ...
}, (t) => ({
  parentNotSelf: check("organisms_parent_not_self", sql`${t.parentId} IS NULL OR ${t.parentId} <> ${t.id}`),
  kindCheck: check("organisms_kind_check", sql`${t.kind} IN ('researcher', 'optimizer', 'predictor', 'synthetist', 'custom')`),
  // indexes: uniqueIndex(t.slug), index(t.creatorId), index(t.parentId), index(t.rootId), index(t.status)
}));

export const organismMemories = pgTable("organism_memories", { /* ... */ }, (t) => ({
  kindCheck: check("organism_memories_kind_check", sql`${t.kind} IN ('short_term', 'long_term', 'episodic')`),
  // indexes: index(t.organismId), index([t.organismId, t.kind])
}));

export const organismFitnessHistory = pgTable("organism_fitness_history", { /* ... */ });
```

## 4. Lifecycle states

The Organism has a five-state lifecycle, modelled as the `organism_status` enum. The PEP §6 (`aigarth-cloud-evolution-pep-v0.2.md:226`) names nine events in the wider loop — `CREATE → ACTIVATE → EXPERIENCE → EVALUATE → ADAPT → EVOLVE → FORK → REPEAT → EXTINCT` — but only two of those are status transitions (`ACTIVATE` and `EXTINCT`); the rest are events that write to `organism_memories` and `organism_fitness_history` without changing the status.

```
                ┌──────────────┐
   create       │              │       auto, on threshold
       ───────▶ │    draft     │ ──────────────────────┐
                │              │                       ▼
                └──────┬───────┘               ┌──────────────┐
                       │  activate (creator)   │              │
                       ▼                       │   extinct    │
                ┌──────────────┐               │  (terminal)  │
       pause    │              │  resume       │              │
   ◀────────────│    active    │──────────────▶└──────────────┘
                │              │
                └──────┬───────┘
                       │  deprecate (creator) ──▶ ┌──────────────┐
                       │                          │  deprecated  │
                       │                          │  (terminal)  │
                       │                          └──────────────┘
                       ▼
                  (fitness ↓ OR compute ∝ ∅)
                  triggers auto-extinct above
```

**Allowed state transitions** (enforced by the application in the routes; the DB enum is the *type* constraint, the transition rules are the *behaviour*):

| From | To | Trigger | Authorized by |
|---|---|---|---|
| `draft` | `active` | `POST /v1/organisms/:slug/activate` | Creator only |
| `active` | `paused` | `POST /v1/organisms/:slug/pause` | Creator only |
| `paused` | `active` | `POST /v1/organisms/:slug/activate` (re-activate path) | Creator only |
| `active` | `deprecated` | `POST /v1/organisms/:slug/extinct` with `mode=deprecated` (or via PATCH) | Creator only |
| `active` | `extinct` | Auto, when fitness < threshold for N consecutive generations | Platform (scheduler) |
| `extinct` | (terminal) | — | — |
| `deprecated` | (terminal) | — | — |

**Forbidden transitions** (the application must reject):
- `draft → paused` (no point pausing a non-active organism)
- `draft → deprecated` (skip the active phase)
- `draft → extinct` (skip the active phase)
- `paused → extinct` (must reactivate first; pause is a soft hold, not a path to death)
- `paused → deprecated` (same — must reactivate first)
- `extinct → *` and `deprecated → *` (terminal)

The lifecycle diverges from the ANN `ann_status` enum (`services/ann/src/db/schema.ts:43-48`: `draft / published / deprecated / suspended`) in two places: (1) an Organism has an explicit `active` (running experiments) state, not `published`; (2) the terminal states are `extinct` and `deprecated`, not `deprecated` and `suspended`. The two enums are not interchangeable. See §10 negative consequences for what happens when a consumer treats them as interchangeable.

## 5. Lineage

Lineage is `parent_id` + `root_id` + `generation`, modelled on the PEP §6 schema (`aigarth-cloud-evolution-pep-v0.2.md:196-198`).

- **`parent_id`**: nullable. Null on lineage founders; set on every child. Self-FK to `organisms.id` with `ON DELETE SET NULL` (deleting a parent does not delete its children; the child's `root_id` and `generation` are preserved).
- **`root_id`**: NOT NULL on every row. Equals the founder's `id`. For a founder, `root_id = self.id`. This lets the API serve an entire lineage tree with a single index lookup on `root_id`.
- **`generation`**: NOT NULL, default `0`. For a founder, `0`. For a child, `parent.generation + 1`. Computed by `POST /v1/organisms/:slug/fork` (Build Task 3) at insert time.

**Cycles are impossible by construction** (per PEP §33 Task 3 test cases, `aigarth-cloud-evolution-pep-v0.2.md:1144`):

1. **DB-level:** `CHECK (parent_id IS NULL OR parent_id <> id)` on `organisms`. The trivial self-parent case is rejected at insert.
2. **Application-level:** `POST /v1/organisms/:slug/fork` (Build Task 3, `services/ann/src/services/lineage.ts`) runs a recursive CTE up the parent chain before insert and rejects if the prospective parent appears anywhere in the prospective child's ancestor chain. This is the only "ancestor" check that needs to happen, because the DB check already prevents the immediate-loop case.
3. **`root_id` invariant:** once set, `root_id` is never updated. A founder's `root_id` is set to its own `id` at insert and never changes; a child's `root_id` is set to the parent's `root_id` at insert and never changes. This means a lineage tree is a *frozen* partition of the `organisms` table — every row belongs to exactly one tree, and that tree is stable for the row's lifetime.

`GET /v1/organisms/:slug/lineage` (Build Task 3) returns the tree as JSON using a recursive CTE on `parent_id` starting from the requested organism. The PEP §33 test (`aigarth-cloud-evolution-pep-v0.2.md:1145`) requires the query to return a 5-generation tree in < 50ms; the `organisms_parent_idx` and `organisms_root_idx` are sized for that.

## 6. Memory

The `organism_memories` table is the Organism's persistence layer. Three kinds, per PEP §6 (`aigarth-cloud-evolution-pep-v0.2.md:210`):

| Kind | `expires_at` | Use case | Examples |
|---|---|---|---|
| `short_term` | NOT NULL | Working memory. Auto-evicted by a sweeper after expiry. | Current task input, in-flight experiment state, recent feedback |
| `long_term` | NULL | Stable knowledge that should outlive the session. Manual eviction only. | A learned prior, a calibrated mutation strategy, a saved checkpoint reference |
| `episodic` | NULL | Time-ordered record of what was tried and what happened. The audit trail. | "Tried mutation X at generation 7; fitness went 0.31 → 0.34; memory signed by tissue T_12" |

**`expires_at` is nullable.** It is set for `short_term` entries (the sweeper deletes expired rows in a daily cron) and NULL for `long_term` and `episodic` (no automatic expiry). The build stream must enforce the `kind` ↔ `expires_at` convention in the application (the DB does not enforce "short_term implies expires_at is set", by design — backfills and migrations need flexibility).

**Memory is append-only.** No UPDATE, no DELETE except by the cron sweeper for expired `short_term` entries. Mutations to the Organism write a *new* memory entry referencing the previous one; they do not edit history. This is the immutability property that test N03 (PEP §8, `aigarth-cloud-evolution-pep-v0.2.md:284`) requires: *"prove that genome.version bumps, tissue weight changes, and memory writes are internal to the Organism (not just a database audit log)."*

**Signature scheme** (the build stream decides; see §12 Open Questions): each entry should be signed by the writer (tissue or worker), so the audit trail is non-repudiable. The signing scheme is open; HMAC-SHA-256 with the organism's service key is the default candidate (matches ADR 003).

## 7. Fitness

Fitness is **append-only** and **measured, not declared**.

- **`organism_fitness_history`** is the source of truth. Every measurement writes a new row. Rows are never updated, never deleted (FK `ON DELETE CASCADE` is the only way rows go away — and only when the organism itself is hard-deleted, which is not exposed in the API).
- **`organisms.fitness`** is a denormalization for fast read ("show me the best active organism on the dashboard"). The route that writes a history row also updates `organisms.fitness` in the same transaction. **Consumers must not treat `organisms.fitness` as the truth** — for anything that matters (lineage comparison, Proof Lab, marketplace ranking), they must read `organism_fitness_history` and pick the most recent or the max as appropriate.

**`components` JSONB** stores the per-dimension breakdown (`objective.weights` × measured values) so the Proof Lab can render a multi-dimensional fitness curve, not just a single number. TireMind's `objective.weights` (PEP §13, `aigarth-cloud-evolution-pep-v0.2.md:248-252`) is one concrete example: a weighted score over rolling resistance, wet grip, wear, and noise, with novelty and uncertainty-reduction terms to be added in v2.

**Auto-extinction trigger** is platform-side, not declared by the creator. The exact threshold is an Open Question (§12 BLOCKER). The PEP §6 explicitly hands this to the platform: *"an Organism mutates when its episodic memory crosses a threshold (e.g., 100 new experiences since last mutation). The platform enables evolution; it does not force it."* The build stream must pick a threshold function (e.g., `fitness < epsilon for N consecutive generations` OR `compute_consumed exceeded without fitness gain`) and document it in the route that performs the auto-transition.

## 8. API contract

The 12 routes the build stream will implement are listed in `aigarth-cloud-evolution-pep-v0.2.md:975-988` (Phase 26 — new routes, all under `services/ann`). Paths and methods only; bodies and status codes are Build Task 2-4 scope.

```
POST   /v1/organisms
GET    /v1/organisms
GET    /v1/organisms/:slug
PATCH  /v1/organisms/:slug
POST   /v1/organisms/:slug/activate
POST   /v1/organisms/:slug/pause
POST   /v1/organisms/:slug/fork
POST   /v1/organisms/:slug/mutate
POST   /v1/organisms/:slug/recombine
GET    /v1/organisms/:slug/lineage
GET    /v1/organisms/:slug/fitness
GET    /v1/organisms/:slug/memory
POST   /v1/organisms/:slug/feedback
POST   /v1/organisms/:slug/extinct
```

(Counted: 14 routes in v0.2 §31, not 12 — the §33 First Tasks surfaces 12 across Tasks 2-4; `recombine` and `feedback` are additional routes named in §31 that the first wave does not require. They are listed here for contract completeness; the build stream can defer `recombine` and `feedback` to Wave 2 without breaking the schema.)

The SDK resource (`packages/sdk/src/resources/organisms.ts`, Build Task 2) wraps these routes. The TypeScript types (`packages/sdk/src/types/organism.ts`) match the column names and JSONB shapes in §3 verbatim — `snake_case` for the wire, per the existing SDK convention (`docs/proposals/aigarth-cloud-evolution-pep-v0.2.md` does not contradict this).

## 9. Consequences (positive)

1. **The platform now has an adaptive primitive.** A creator can author an Organism with a genome, an environment, and an objective; the platform tracks its fitness across generations, mediates forking and recombination, and exposes the lineage. This is the smallest possible scaffolding for the "experience → learning → hypothesis → compute → verification → adaptation" loop (`aigarth-cloud-evolution-pep-v0.2.md:68`).

2. **The schema is additive; no migration risk.** The three new tables and the two new enums do not touch any existing ANN table. Existing routes continue to return the same shapes. The Phase 19 closeout (~92%) is not disturbed.

3. **The lifecycle and lineage are enforced by the DB, not by application discipline.** The `CHECK (parent_id <> id)` constraint, the self-FK, and the `organism_status` enum make the most common bug classes impossible at insert time. The application's job is reduced to (a) computing `root_id` and `generation` on fork, (b) enforcing transition rules, (c) running the recursive cycle check.

4. **Fitness history is audit-grade.** Every measurement is a row; the table is append-only by FK design. The Proof Lab (Build Task deferred to Wave 2) and any external audit (Qubic OC processor in Phase 29) can read the history without trusting the denormalized `organisms.fitness` column.

5. **Co-location with `services/ann` shares the auth/audit surface.** JWT validation, `ann_audit_logs` integration, rate limiting, idempotency keys, and the QUBIC billing hook all work the same way they do for ANNs. A new `services/organism` would have re-implemented every one of these (see §11 alternatives).

## 10. Consequences (negative)

1. **`services/training`'s auto-retrain consumer (`services/training/src/workers/retrain-cron.ts:1-50`) will misread the lifecycle if it treats the Organism as just an ANN with extra fields.** The retrain cron calls `runRetrainScan()` against `/v1/internal/anns/retrain-scan` (line 30) and fires on `ann_decision_outcomes` events. A future maintainer wiring the cron to also respond to "model got worse" events will mistake `organism_fitness_history` row inserts for `ann_decision_outcomes` and start triggering retrain jobs on organism mutations — but an organism mutation is a *genome change*, not a model-weights retrain. The fix is a hard guardrail at the consumer: `retrainScan` must check the `kind` of the event source and skip any source that maps to the `organisms` tables. The build stream must add a test that exercises this misread path (a `runRetrainScan` call with an `organism_id` payload) and asserts no retrain job is enqueued.

2. **The `organisms.fitness` denormalization is a footgun for any consumer that reads it as the source of truth.** Lineage comparison, marketplace ranking, and the Proof Lab all need `organism_fitness_history`, not `organisms.fitness`. A single read-from-`organisms.fitness` in a hot path will return stale results during the gap between the history insert and the denormalization update (they're in the same transaction today, but a future change to async denormalization would break any consumer that trusts the column). The route handlers must never expose `organisms.fitness` directly — the API returns the latest row from `organism_fitness_history` by construction, and `organisms.fitness` is internal-only.

3. **The Organism has no org_id, no team permissions, and no quota model.** `creator_id` is a `uuid` to `services/identity` users, but there is no `org_id` column (compare `services/ann/src/db/schema.ts:154` which has both `creator_user_id` and `creator_org_id`). A creator in a team setting cannot delegate, share, or co-author an organism. The marketplace listing (Build Task 5) will be the first consumer that hits this gap; the team-permission model is a follow-up ADR, not this one.

4. **The genome is a freeform JSONB, not a typed artifact.** PEP §6 says the genome is *"{tissues, llm_hint, simulator, external_model, mutation, recombination}"* but the schema does not constrain the shape. A bad genome (missing required fields, wrong types in the mutation policy) will surface as a runtime error at first use, not at insert. The build stream must validate the genome in the `POST /v1/organisms` and `POST /v1/organisms/:slug/mutate` routes, but the DB will not.

5. **There is no UI for the new primitive in Wave 1.** Build Task 1 ships tables only. A user who runs the migration will have `organisms` rows they can create via `psql` but cannot see in the dashboard until Task 6 (Wave 2). This is acceptable for the contract ADR but should be flagged for product — the schema can ship alone, but the user-facing surface should not be a separate ADR.

## 11. Alternatives considered

**a) Ship the Organism as a new `services/organism` (port 7013).** Rejected. `services/ann` already implements JWT validation, `ann_audit_logs` integration (`services/ann/src/db/schema.ts:394-411`), idempotency keys (`services/ann/src/db/schema.ts:415-436`), rate limiting, and the QUBIC billing hook. A new service would duplicate all of them. The PEP §30 (`aigarth-cloud-evolution-pep-v0.2.md:947`) is explicit: *"All Organism tables live in `services/ann` (the natural home; no new service)."* Phase 26 closes a gap, not a service boundary.

**b) Extend `services/tissue` to host the Organism.** Rejected. The Tissue contract is stateless per call: a tissue fans out to ANNs, combines their decisions with one of five consensus policies, returns a signed `IntentEnvelope`, and the call ends (PEP §6, `aigarth-cloud-evolution-pep-v0.2.md:233-234`). An Organism is stateful across experiences; its genome mutates between calls, its memory persists, its fitness is measured against a held-out test set. Co-locating a stateful primitive inside a stateless service would either (i) force the Tissue service to track per-organism state and break the stateless invariant that downstream consumers rely on, or (ii) require every Organism operation to be a one-shot Tissue call, which makes the lineage walk, the fitness history, and the mutation policy impossible to model. The PEP §6 distills this: *"Cells → Organs → Bodies. The Organism is the Body, not another Tissue."*

**c) Add an `is_organism` boolean to the `anns` table and let ANNs be organisms when the flag is set.** Rejected. The two lifecycles are not the same: `ann_status` is `draft / published / deprecated / suspended` (`services/ann/src/db/schema.ts:43-48`); `organism_status` is `draft / active / paused / deprecated / extinct`. The two enums cannot share a column without a six- or seven-value superset, which would weaken both. The ANN `current_version_id` model is per-version immutable; the Organism `genome` model is mutable with a version counter inside the JSONB. Conflating them means a single table that is hard to query for either shape. The two entities need two tables.

## 12. Open questions

Decisions the build stream must make before or during Wave 1 / Wave 2 implementation. Marked `BLOCKER` (must be resolved before the related code can ship) or `NON-BLOCKER` (can ship with a documented default; resolved in a follow-up ADR).

1. **`BLOCKER` — Auto-extinction threshold.** The PEP §6 (`aigarth-cloud-evolution-pep-v0.2.md:226`) names auto-extinct as a transition but does not specify the threshold function. Candidate functions:
   - `fitness < epsilon` for `N` consecutive generations
   - `compute_consumed` exceeded the Organism's budget without `delta_fitness > 0`
   - `last_mutation_at > T` with no measurable fitness improvement
   
   The build stream must pick one (or a hybrid) and document the function in the route that performs the auto-transition. The function is configuration on the Organism, not platform-wide.

2. **`BLOCKER` — Soft-delete vs hard-delete semantics for `deleted_at`.** The `deleted_at` column is in the schema but the routes do not expose deletion in Wave 1. The build stream must define whether:
   - (a) `DELETE /v1/organisms/:slug` sets `deleted_at` (soft); the row is hidden from `GET` but `parent_id` walks still see it; or
   - (b) the row is hard-deleted and `ON DELETE SET NULL` orphans the children.
   
   Option (a) is consistent with the rest of the schema (compare `ann_audit_logs` and `ann_idempotency_keys`, which are never soft-deleted; versus `anns`, which is also not soft-deleted in `services/ann/src/db/schema.ts:138-208`). The lineage answer matters because the FK is `ON DELETE SET NULL` and the `root_id` invariant requires the founder to remain queryable.

3. **`NON-BLOCKER` — Memory signature scheme.** PEP §6 says memory entries are "signed by the writer" (tissue or worker). The build stream can ship with HMAC-SHA-256 keyed on the organism's service key (matches ADR 003) and defer Ed25519 to v2 (which is also the ADR 003 v2 path). The signature column is a `text` field on `payload.signature` (not a separate column); this keeps the schema flat and the route code simple.

4. **`NON-BLOCKER` — `kind` validation strictness.** The `kind` column is `text` with a CHECK constraint listing the five values from PEP §6. The build stream should also validate `kind` at the route layer and reject unknown values with a 400, so the CHECK is a belt-and-braces fallback, not the primary defense. Strictness is a v1.1 hardening; v1 can ship with route-level validation only.

5. **`NON-BLOCKER` — `compute_consumed` inner JSONB schema.** The PEP §6 column comment lists `{cpu_s, gpu_s, network_b, work_items, qubic}` but the shape is not enforced. The build stream should publish a TypeScript type in `services/ann/src/types/organism.ts` (or `packages/sdk/src/types/organism.ts`) and the Work Runtime writes to the typed shape. The DB stays JSONB; the type is the contract.

6. **`NON-BLOCKER` — Concurrent fork idempotency.** Two concurrent `POST /v1/organisms/:slug/fork` calls from the same parent: does the second one create a second child, or does the first win? PEP §33 Task 3 (`aigarth-cloud-evolution-pep-v0.2.md:1144`) says *"fork idempotency (same source = different children)"* — read carefully, this means the test asserts that two forks from the same source produce *different* children (i.e., the API does not dedupe forks). The build stream should confirm this with the reviewer before implementation; if the intent was the opposite, the ADR and the route behaviour diverge.

7. **`NON-BLOCKER` — Visibility default for new organisms.** The schema default is `'private'` (creator-first; explicit publish). The PEP §6 does not state a default. The `anns` table defaults to `'public'`. The build stream should confirm with the reviewer: a private-by-default Organism requires an explicit `visibility: 'public'` to be listed; a public-by-default Organism is a privacy regression. This is a product decision masquerading as a schema decision.

---

**Wave 1 acceptance gate (Build Task 1, per `docs/evolution/CHECKPOINT-2026-08-12.md:108-114`):** `pnpm --filter @aigarth/ann typecheck`, `pnpm --filter @aigarth/ann test`, `pnpm --filter @aigarth/ann db:migrate` on a fresh DB. Routes this ADR claims to ship are exercised with curl or a Vitest HTTP test, not just typecheck. A FAIL on any check returns the deliverable to its producer with the specific gap named. A PASS is reported back with `VERDICT: PASS` + evidence.
