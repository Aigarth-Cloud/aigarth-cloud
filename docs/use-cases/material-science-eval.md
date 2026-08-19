# Material Science Intelligence ANN — Architecture Compatibility Evaluation

**Use case:** A specialized-intelligence approach to material science discovery
and optimization, modeled as a coordinated swarm of ANNs (Research Director,
Literature, Simulation, Physics, Design, Optimization, Experiment, Validation)
that accelerate the traditional years-long research workflow.

**Audience:** Aigarth Cloud architecture team.

**Status:** Phase 0 — Pre-implementation evaluation. Document answers
the four evaluation questions in the proposal, enumerates the required
extensions to the current architecture, and lays out a four-phase
development path. No production code is being written yet.

---

## 1. TL;DR

| Dimension | Verdict | What needs to change |
| --- | --- | --- |
| ANN compatibility | **Strong** | services/ann already does versioning, marketplace listings, reviews, and a deploy hook into services/compute. We need: material-domain tagging, a knowledge-graph table, and a "negative feedback" pathway for failed experiments. |
| Compute architecture | **Conditional** | services/compute is task-agnostic and can carry simulation jobs, but material-science compute is 50–100× more expensive than video and needs HPC-class workers (CPU-hours, GPU). We need: simulation-engine tagging, per-stage caching, capability-tagged workers, and GPU resource limits. |
| Continuous learning | **Greenfield, with a twist** | Same gap as video (no per-ANN quality signals), but material science adds a first-class uncertainty dimension and the need to capture *negative* experimental results. Without it, the system cannot improve honestly. |
| Qubic integration | **Strong fit, same blocker** | Qubic's `outsourced-computing` contract is *especially* suited to material science — distributed simulation compute is exactly what it was designed for. Same K12 signature verification blocker as every other use case. |

The proposal is well-aligned with the current architecture. The most
honest finding is that material-science compute is **dramatically more
expensive** than video — a single "find a new battery cathode" workflow
is 50× the cost of a 30-second video render. The platform can support
it, but the cost story needs to be visible to the user *before* they
commit, not after. Per-stage pre-flight estimates and per-stage credit
deduction are not optional here — they are the difference between a
useful product and a $1,000 surprise.

A second honest finding: the proposal assumes an experiment step. Real
experiments take weeks and require physical lab equipment. Aigarth
cannot do experiments. What it can do is **plan** the experiment,
**predict** its outcome, **validate** against historical lab data, and
**log** the result for the next iteration. That is a real product, and
it is genuinely valuable — but it is not "automated science," and the
docs should say so.

---

## 2. Architecture compatibility — dimension by dimension

### 2.1 ANN compatibility

**What the proposal needs:**

- 8 specialized ANNs coexisting (Research Director, Literature,
  Simulation, Physics, Design, Optimization, Experiment, Validation)
- Each ANN versioned, rateable, sellable on a marketplace
- Domain specialization (battery materials, alloys, polymers, catalysts,
  semiconductors) — these are not different ANNs, they are the same ANN
  in a different domain
- A knowledge graph linking materials, properties, papers, and
  structures
- Long-running feedback loops (a published prediction can be validated
  months later against an experiment)

**What we already have (`services/ann` + `services/marketplace`):**

| Capability | Where it lives | Status |
| --- | --- | --- |
| ANN registry with categories, slugs, license kinds, visibility tiers | `services/ann` (9 tables) | Ready |
| Versioned releases (a single ANN has many versions) | `ann_versions` table | Ready |
| Reviews (1-5 star + comment) on ANNs | `ann_reviews` table | Ready |
| Deploy an ANN as a job on services/compute | `POST /v1/anns/:slug/deploy` | Ready |
| Marketplace listings / offers / auctions (Dutch, English, sealed-bid) | `services/marketplace` | Ready |
| Per-ANN analytics (denormalized counters, rating distribution, benchmarks) | `GET /v1/anns/:slug/analytics` | Ready |
| Discovery (`pg_trgm` similarity search, faceted filters) | `services/ann` | Ready |
| Rate limit + idempotency on writes | `services/ann` global preHandler | Ready |

**Gap analysis:**

The 8 material-science ANNs map cleanly onto the existing ANN primitive.
The platform does not need to learn what a "Validation ANN" is — it is
an ANN with a `role` field. The same logic that lets the platform
version a Director ANN lets it version a Design ANN.

What's new is **domain specialization**. A "Design ANN" for battery
cathodes is meaningfully different from a "Design ANN" for high-entropy
alloys. The two should not share a marketplace listing, should not be
discoverable in the same search, and should not be compared in the
same benchmark.

This is a small additive change:

- Add a `material_domain` enum on `anns`: `battery`, `alloy`, `polymer`,
  `catalyst`, `semiconductor`, `coating`, `composite`, `pharmaceutical`,
  `generic` (default).
- Add a `domain_filter` to discovery so a buyer can find ANNs in
  exactly the domain they care about.
- A new `material_knowledge_graph` table that records edges between
  nodes (materials, properties, papers, structures). This is what
  lets a Literature ANN's discoveries be cross-referenced against a
  Simulation ANN's predictions.

These are additive. They don't disturb existing ANN flows.

**Compatibility verdict: 8/10.** Add `material_domain` to `anns` and
a `material_knowledge_graph` table. Everything else works.

### 2.2 Compute architecture

**What the proposal needs:**

- Long-running simulation jobs (DFT calculations: 1–100 CPU-hours;
  molecular dynamics: 1–1000 CPU-hours)
- GPU compute (CUDA for MD and MLIPs; multi-GPU for DFT)
- Heterogeneous worker types: a DFT worker is not a molecular-dynamics
  worker is not a literature-ingestion worker
- Deterministic re-runs (a given input deck must always produce the
  same output — reproducibility is a scientific requirement, not a
  nice-to-have)
- Artifact storage: trajectories, structures, log files, force outputs
- Caching: re-running the same input is a common pattern; we should
  not pay for it twice
- The experiment step happens offline (real lab) — the platform only
  plans the experiment and ingests the result

**What we already have (`services/compute`):**

| Capability | Where it lives | Status |
| --- | --- | --- |
| Job submission with a typed `kind` enum | `jobs.kind` | Ready — has `training`, `inference`, `batch`, `broadcast` |
| Cluster membership + heartbeat | `cluster_members` | Ready |
| Region-aware routing (latency hints, "best region for X") | `regions` + `clusters` | Ready |
| Reservations (pre-purchased capacity, billed per epoch) | `reservations` | Ready |
| Per-user credit balance (denormalized counter) | `compute_credits` | Ready |
| Idempotent submission (idempotency_key) | `services/compute` middleware | Ready |
| Synthetic broadcast for testing (test-only) | `POST /v1/compute/jobs/broadcast` | Ready |

**Gap analysis:**

`services/compute` is task-agnostic at exactly the right level of
abstraction. A "DFT relaxation" is a job with `kind = 'dft_relaxation'`
and a `payload` containing the input deck. The compute service does
not need to know what VASP is.

What's missing is the **worker side**, and it is more substantial
than for video:

- Today, `services/compute` is the orchestrator only. There are no
  real workers — `broadcast` is a test-only synthetic path. A real
  simulation worker pool needs:
  - A worker protocol: connect to a long-poll / WebSocket endpoint,
    receive `{ job_id, kind, payload }`, run it, POST progress +
    result.
  - Capability advertisement: a worker says "I can do `dft.vasp_relax`
    on a single node with 64 cores and 1× A100". The scheduler routes
    matching jobs to it. This is finer-grained than video: a DFT
    worker cannot run a molecular-dynamics job and vice versa.
  - Resource limits: a worker reports its CPU/GPU/memory; the
    scheduler refuses jobs that don't fit. **GPU is first-class here** —
    a DFT job that needs 4× A100 must land on a worker with 4× A100.
  - Heartbeat + liveness: long-running jobs (hours to days) need
    progress reporting. If a worker disappears for 5 minutes, we
    should not kill the job — but if it disappears for 30 minutes, we
    should re-queue.
  - **Determinism verification**: the worker must re-run the job with
    the same input deck and confirm identical output. This is a
    scientific correctness requirement. A non-deterministic DFT
    result is wrong by definition.
  - **Caching**: the orchestrator should hash the input deck and
    serve from cache if a result already exists. For DFT this is a
    massive cost saving — the same input deck is often run by many
    users.
  - A trust model: workers are untrusted code. They must run in
    containers (Docker / Singularity) and have a network policy
    that limits egress (no internet, only Aigarth APIs). For HPC
    workloads we may need privileged Singularity containers with
    MPI support.

This is genuinely new work, but it lives in a **new layer**, not in
the existing services. Concretely:

- Extend `services/compute` to grow a `/v1/workers/*` namespace
  (same as the video proposal — the worker protocol is shared).
- A new worker container image per engine family: `aigarth/worker-dft`
  (VASP, Quantum ESPRESSO), `aigarth/worker-md` (LAMMPS, GROMACS),
  `aigarth/worker-mlip` (MACE, Allegro, equivariant networks), plus
  the lighter `aigarth/worker-lit` (paper ingestion, no HPC). Each
  image is registered by an operator, not a user.
- A `worker_runtime` Python package (small) that wraps the protocol
  and the engine-specific CLI calls.
- An `input_deck_hash` column on `jobs` that drives caching.
- A `compute_simulation_results` table that stores per-job artifacts
  (trajectory URLs, log URLs, structure URLs, wall_clock_seconds,
  num_atoms, num_cores) for replay and analysis.

**Compatibility verdict: 6/10.** More work than video because (a) GPU
is first-class and (b) the cost differential forces per-stage caching
+ per-stage pre-flight estimates. Compute service needs to grow
`/v1/workers/*`, simulation-result storage, and the caching layer.
Schema gets a `compute_simulation_results` table and an
`input_deck_hash` column. The work is additive, no existing flow
changes.

### 2.3 Continuous learning

**What the proposal needs:**

- Per-ANN quality signals (which ANNs make the most useful
  predictions?)
- Per-prediction attribution (a property was predicted; which ANN
  made the prediction; what was the predicted uncertainty; what was
  the actual measured value?)
- **Negative feedback is first-class** — when an experiment
  disproves a prediction, that is *more* valuable than a positive
  result, not less
- **Uncertainty quantification** — every material prediction should
  come with a confidence score (and the literature ANN should know
  which kinds of predictions are reliable and which are speculative)
- **Long feedback windows** — a prediction made today may be
  validated against an experiment performed six months from now
- **Cross-ANN learning** — when the Literature ANN finds a paper
  that proves the Simulation ANN was wrong, that should update the
  Simulation ANN's reputation

**What we already have:**

Today, we store:

- Reviews (1-5 star, comment) on ANNs and on marketplace listings.
- Marketplace purchase events.
- Gateway usage (token counts, latencies, costs).
- An `ann_audit_logs` table per service (free-form action text).

We **do not** store:

- Per-prediction provenance (which ANN made this prediction; with
  what input; under what assumptions?).
- Per-prediction validation (was the prediction right? by how much?
  with what uncertainty?).
- Per-stage attribution in a multi-ANN pipeline (the Material
  Science proposal has 8 stages — when a result is bad, which stage
  caused it?).
- A time series of an ANN's quality over its versions.
- Negative results as first-class data.

**This is the largest single gap, and material science makes it
sharper.** A video user can say "I liked it" or "I didn't." A
material scientist needs to say "the DFT prediction for property X
was 5.2 eV; the measured value was 4.8 eV; the predicted uncertainty
was ±0.3 eV; the error is within the uncertainty band so the
prediction was good." That is structured feedback, and it cannot
fit in a 1–5 star rating.

Required additions:

- A `material_predictions` table that records every prediction the
  system makes:
  - `id`, `pipeline_run_id`, `ann_id`, `ann_version_id`, `kind`
    (property: band_gap, formation_energy, bulk_modulus, ...)
  - `target_material` (composition or structure hash)
  - `predicted_value` (numeric, with units)
  - `predicted_uncertainty` (numeric, with units)
  - `input_deck_hash` (link to the simulation that produced the
    prediction)
  - `created_at`, `actor_id`
- A `material_validation_results` table that records how a
  prediction was validated:
  - `id`, `prediction_id`, `kind` (experiment, literature,
    cross_simulation)
  - `measured_value` (numeric, with units)
  - `uncertainty` (numeric, with units)
  - `lab_id` (for experimental validation; nullable)
  - `paper_id` (for literature validation; nullable)
  - `notes` (free-form text)
  - `validated_by` (user id), `validated_at`
- A `material_feedback_events` table that captures negative as
  well as positive signals:
  - `id`, `ann_id`, `ann_version_id`, `pipeline_run_id`,
    `prediction_id`
  - `kind` (`positive`, `negative`, `correction`, `uncertainty_under`,
    `uncertainty_over`, `experimental_disagree`)
  - `value` (JSON, structured)
  - `notes` (text)
  - `created_at`, `actor_id`, `actor_kind` (user, system, cross_ann)
- A `material_ann_quality` materialized view (or rollup table
  refreshed on a cron) that pre-computes per-`ann_version_id`:
  - `n_predictions`, `n_validated`, `n_within_uncertainty`,
    `n_outside_uncertainty`
  - `mean_absolute_error`, `mean_relative_error` (with units)
  - `uncertainty_calibration_score` (how well-calibrated are the
    reported uncertainties? — a well-calibrated ANN's ±0.3 eV
    band should contain the true value 70% of the time, not 30%
    or 90%)
  - `n_positive_feedback`, `n_negative_feedback`
  - `n_cross_ann_corrections` (times another ANN flagged this
    ANN's output)

The cron / rollup pattern is already used in the gateway for
`usage_summary`. We can extend it.

**Compatibility verdict: 5/10 (with caveats).** Real new work, no
shortcuts. But it's a focused scope: 3 new tables (`material_predictions`,
`material_validation_results`, `material_feedback_events`),
1 rollup job, and the per-prediction provenance is a *new concept*
that doesn't exist anywhere in the current platform. This is the
right place to build it.

### 2.4 Qubic integration

**What the proposal needs:**

- ANN ownership (an ANN has an on-chain owner)
- Compute contribution rewards (a research lab that runs DFT
  simulations gets paid)
- Decentralized worker network (a university cluster can register
  as a DFT worker)
- Reputation scoring (which workers are reliable? which ANNs are
  accurate?)
- Verification mechanisms (did the worker actually run the
  simulation, or did it return a cached/fake result?)

**What we already have (`services/qubic`):**

| Capability | Where it lives | Status |
| --- | --- | --- |
| Wallet link (K12 signature format-only today) | `services/qubic/wallets` | Ready |
| Stake intents (3-step submit flow) | `services/qubic/staking` | Ready |
| Treasury movements (multi-sig) | `services/qubic/treasury` | Ready |
| Validator / computor registry | `services/qubic/validators` | Ready |
| Network status (current tick + epoch) | `services/qubic/network` | Ready |
| Qubic HTTP gateway client | `services/qubic/client` | Ready |
| K12 signature verification | Format-only, real crypto TODO | **Blocked** |
| Outsourced-computing contract integration | Pattern referenced from `qubic/outsourced-computing` | Designed |

**Gap analysis:**

Material science is *especially* well-suited to Qubic's
`outsourced-computing` contract pattern. The contract is designed for
exactly this use case: a requester posts a job, a worker runs it, a
verifier checks the result, payment is released. The shape maps
cleanly.

The on-chain layer would expose:

- `ann_registry` — list / get / register / update ownership. Same as
  video.
- `worker_registry` — register a worker, declare its capabilities
  (`dft.vasp_relax`, `md.lammps_nvt`, ...), stake a reputation amount.
- `reputation` — per-worker quality score, per-ANN accuracy score.
- `rewards` — distribute QUBIC to workers and ANN authors based on
  contributions. The reward formula for material science needs to
  weight the *value* of the discovery, not just the number of jobs
  run. A worker that runs 1,000 trivial DFT relaxations should not
  earn the same as a worker that finds a new battery cathode.
- `discovery_attribution` — when a research finding is made, record
  on-chain which ANNs and which workers contributed. This is
  *new* for material science; the video proposal did not need it.

The off-chain rollup → on-chain commitment is a well-understood
optimistic-rollup pattern, same as video. But material science has
a new wrinkle: the **discovery_attribution** is irreversible. Once
a paper is published with an Aigarth-discovered material, the
attribution is fixed. We need a one-way "publish" action that writes
to chain immediately, not via a daily rollup.

**Compatibility verdict: 9/10.** The shape is right and arguably
*better* than for video. We're blocked on real K12 signature
verification, same as every other on-chain use case. The
`discovery_attribution` table is a small new thing that doesn't
exist in the video proposal.

---

## 3. Required changes to current Aigarth architecture

### 3.1 Schema additions

**`services/ann`**

```sql
-- Extend the ann_role enum (added in Phase 16, reused here)
ALTER TYPE ann_role ADD VALUE 'literature';
ALTER TYPE ann_role ADD VALUE 'simulation';
ALTER TYPE ann_role ADD VALUE 'physics';
ALTER TYPE ann_role ADD VALUE 'design';
ALTER TYPE ann_role ADD VALUE 'optimization';
ALTER TYPE ann_role ADD VALUE 'experiment';
ALTER TYPE ann_role ADD VALUE 'validation';

-- New: material domain tagging
CREATE TYPE material_domain AS ENUM (
  'battery', 'alloy', 'polymer', 'catalyst', 'semiconductor',
  'coating', 'composite', 'pharmaceutical', 'generic'
);

ALTER TABLE anns ADD COLUMN material_domain material_domain NOT NULL DEFAULT 'generic';

-- New: knowledge graph
CREATE TABLE material_knowledge_nodes (
  id          uuid PRIMARY KEY,
  owner_id    uuid NOT NULL,
  kind        text NOT NULL,        -- 'material', 'property', 'paper', 'structure'
  label       text NOT NULL,
  payload     jsonb NOT NULL,       -- structured data (composition, citation, ...)
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE material_knowledge_edges (
  id          uuid PRIMARY KEY,
  from_node   uuid NOT NULL REFERENCES material_knowledge_nodes(id),
  to_node     uuid NOT NULL REFERENCES material_knowledge_nodes(id),
  kind        text NOT NULL,        -- 'has_property', 'cites', 'derived_from', 'measured_by'
  weight      numeric,              -- optional, for ranking
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX material_knowledge_edges_from_idx ON material_knowledge_edges(from_node);
CREATE INDEX material_knowledge_edges_to_idx ON material_knowledge_edges(to_node);

-- New: per-prediction provenance + validation (see §2.3)
CREATE TABLE material_predictions (
  id                    uuid PRIMARY KEY,
  pipeline_run_id       uuid,                 -- nullable, may be a single-shot prediction
  ann_id                uuid NOT NULL,
  ann_version_id        uuid NOT NULL,
  kind                  text NOT NULL,        -- 'band_gap', 'formation_energy', 'bulk_modulus', ...
  target_material       text NOT NULL,        -- composition or structure hash
  predicted_value       numeric NOT NULL,
  predicted_unit        text NOT NULL,
  predicted_uncertainty numeric,
  input_deck_hash       text,                 -- links to the simulation that produced the prediction
  created_at            timestamptz NOT NULL DEFAULT now(),
  actor_id              uuid
);

CREATE TABLE material_validation_results (
  id                  uuid PRIMARY KEY,
  prediction_id       uuid NOT NULL REFERENCES material_predictions(id),
  kind                text NOT NULL,        -- 'experiment', 'literature', 'cross_simulation'
  measured_value      numeric NOT NULL,
  measured_unit       text NOT NULL,
  uncertainty         numeric,
  lab_id              text,                 -- free-form, for experimental validation
  paper_id            uuid,                 -- links to material_knowledge_nodes
  notes               text,
  validated_by        uuid,
  validated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE material_feedback_events (
  id                  uuid PRIMARY KEY,
  ann_id              uuid NOT NULL,
  ann_version_id      uuid NOT NULL,
  pipeline_run_id     uuid,
  prediction_id       uuid,
  kind                text NOT NULL,        -- 'positive', 'negative', 'correction', 'uncertainty_under', 'uncertainty_over', 'experimental_disagree'
  value               jsonb NOT NULL,
  notes               text,
  actor_id            uuid,
  actor_kind          text NOT NULL,        -- 'user', 'system', 'cross_ann'
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX material_feedback_events_ann_idx ON material_feedback_events(ann_id, ann_version_id);
CREATE INDEX material_feedback_events_prediction_idx ON material_feedback_events(prediction_id);
```

**`services/compute`**

```sql
-- Extend the compute_job_kind enum (added in Phase 16, reused here)
ALTER TYPE compute_job_kind ADD VALUE 'lit_ingest';
ALTER TYPE compute_job_kind ADD VALUE 'dft_relax';
ALTER TYPE compute_job_kind ADD VALUE 'md_run';
ALTER TYPE compute_job_kind ADD VALUE 'mlip_predict';
ALTER TYPE compute_job_kind ADD VALUE 'design_generate';
ALTER TYPE compute_job_kind ADD VALUE 'optimize_pareto';
ALTER TYPE compute_job_kind ADD VALUE 'experiment_plan';
ALTER TYPE compute_job_kind ADD VALUE 'validation_compare';

-- New: caching by input deck hash
ALTER TABLE jobs ADD COLUMN input_deck_hash text;
CREATE INDEX jobs_input_deck_hash_idx ON jobs(input_deck_hash);

-- New: simulation artifact storage
CREATE TABLE compute_simulation_results (
  id                  uuid PRIMARY KEY,
  job_id              uuid NOT NULL UNIQUE REFERENCES jobs(id),
  trajectory_url      text,
  log_url             text,
  final_structure_url text,
  wall_clock_seconds  int NOT NULL,
  num_atoms           int,
  num_cores           int,
  num_gpus            int,
  engine              text NOT NULL,        -- 'vasp', 'q-e', 'lammps', 'gromacs', 'mace', ...
  engine_version      text NOT NULL,
  determinism_check   boolean NOT NULL,     -- was a re-run performed and compared?
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- The compute_workers table is added by Phase 16, reused here. For
-- material science we add a gpu_model + gpu_count to it (already
-- in the Phase 16 spec, just calling it out as critical here).
```

**`services/qubic`** (additive)

A new `discovery_attribution` table (or on-chain contract) that
records an irreversible one-way "publish" action — when a material
discovery is made, the on-chain attribution is fixed.

### 3.2 New endpoints

**`services/ann`**

```
# Material-domain discovery
GET    /v1/materials/anns                    list ANNs filtered by material_domain
GET    /v1/materials/anns/:slug              retrieve (includes material_domain)

# Knowledge graph
POST   /v1/materials/knowledge/nodes         add a node (material, property, paper, structure)
GET    /v1/materials/knowledge/nodes/:id
POST   /v1/materials/knowledge/edges         add an edge (has_property, cites, derived_from, measured_by)
GET    /v1/materials/knowledge/nodes/:id/edges

# Predictions + validation
POST   /v1/materials/predictions             record a prediction (called by the worker after running)
GET    /v1/materials/predictions             list (filter by ann_id, kind, target_material)
GET    /v1/materials/predictions/:id
POST   /v1/materials/predictions/:id/validate   attach a validation result
GET    /v1/materials/predictions/:id/validations

# Feedback (positive + negative)
POST   /v1/materials/feedback                attach a feedback event
GET    /v1/materials/feedback/ann/:id         rollup of feedback for an ANN
GET    /v1/materials/feedback/prediction/:id  feedback for a specific prediction
```

**`services/compute`**

```
# Same as Phase 16
POST   /v1/workers                register a worker (with capabilities + gpu_model + gpu_count)
POST   /v1/workers/:id/heartbeat  keepalive
GET    /v1/jobs/next              worker pulls the next job it can do (capability-matched)
POST   /v1/jobs/:id/progress      worker posts progress (percent + stage_label)
POST   /v1/jobs/:id/complete      worker posts final result (writes to compute_simulation_results)

# New for material science
GET    /v1/simulations/cache-lookup?input_deck_hash=X  is there a cached result?
POST   /v1/simulations/:job_id/verify                  re-run + compare (for determinism)
GET    /v1/simulations/:job_id/artifacts               list artifact URLs
```

### 3.3 New SDK resources

```
client.materials.anns.list({ material_domain: 'battery' })
client.materials.knowledge.addNode({ kind, label, payload })
client.materials.knowledge.addEdge({ from, to, kind })
client.materials.predictions.create({ ann_id, kind, target_material, predicted_value, ... })
client.materials.predictions.validate(id, { kind, measured_value, ... })
client.materials.feedback.create({ ann_id, kind: 'negative', value, notes })
client.compute.simulations.cacheLookup(inputDeckHash)
```

### 3.4 New components (apps/dashboard)

A new `/material-science` page on the tracker:

- A static manifest of the proposed architecture (8 ANN roles,
  knowledge graph, simulation worker pool) — same look-and-feel as
  `/video` and `/services`.
- A status grid (4 dimensions × compatibility verdict) — same look
  as `/video`.
- A roadmap timeline (5 development phases with checklist progress).
- A risk register (top 8 risks, color-coded by likelihood × impact).
- A live cost model (per-stage costs, total workflow cost, what the
  user commits to before running).
- A live "knowledge graph preview" (a tiny interactive demo: drag a
  few nodes, see the edges appear — wired to a deterministic seed
  dataset so it works before the real graph is built).

A new `/use-cases/material-science` page on the marketing site
(`apps/web`) that:

- Renders the blog article (10 pages, plain English).
- Has a "subscribe" CTA tied to the existing `services/marketplace`
  notify-me endpoint.

### 3.5 Compute & cost additions

A material-science workflow is **dramatically more expensive** than
video. A single "find a new battery cathode" task can cost 50+ QU.
The cost story is the difference between a useful product and a
$1,000 surprise. We need:

- **Per-stage pre-flight estimate** — the Research Director ANN's
  plan (the research protocol) includes a per-stage estimated cost
  + duration. The user must confirm before the workflow starts.
- **Per-stage cost accounting** — credit deduction on each stage
  completion, not just on the final result. This is what makes the
  "I cancelled mid-workflow" case financially sensible.
- **Cancel + partial refund** — if the user cancels, completed
  stages are kept (cache) and the refund is for the un-run stages.
- **Input-deck caching** — the same input deck should not cost
  twice. The orchestrator hashes the deck and serves from cache.
- **Pre-purchased capacity** — for labs that run many DFT
  calculations, a monthly reservation is cheaper than per-job
  pricing.
- **Surrogate-first routing** — for properties that have a fast ML
  surrogate (e.g. MACE for energy), use the surrogate unless the
  user explicitly asks for DFT. This is the single biggest cost
  optimization.

These are all additive on the existing `compute_credits` /
`reservations` flow.

---

## 4. Recommended implementation strategy

### Phase 0 — Documentation (THIS DELIVERABLE)

- [x] Architecture compatibility evaluation (this doc)
- [x] Blog article published on the Aigarth Cloud website
- [x] Dashboard `/material-science` page live with the architecture
      diagram, compatibility verdicts, roadmap, and risk register

### Phase 1 — Knowledge prototype

Goal: prove the workflow with paper ingestion + knowledge graph +
research-question answering. No simulation, no blockchain, no
distributed anything.

- Add `material_domain` enum to `services/ann`.
- Add `material_knowledge_nodes` + `material_knowledge_edges` tables.
- Add a Literature ANN that ingests PDFs (arXiv, open-access papers)
  and extracts structured facts: composition, property value,
  measurement method, citation.
- Add a Research Director ANN (LLM call) that takes a research
  question, decomposes it into sub-questions, and routes them to
  the Literature ANN.
- Add a research-assistant UI (a `/dashboard/research` page) where
  a user types "What is the state-of-the-art efficiency for
  perovskite solar cells?" and gets a structured answer with
  citations.
- Cache the ingested papers in MinIO so re-ingestion is free.

**Deliverable:** ingest 1,000 papers, answer a 3-paragraph research
question in < 5 minutes, with citations and structured property
values. Re-evaluation gate at the end.

### Phase 2 — Simulation integration

- Add `material_predictions` + `material_validation_results` tables.
- Add the simulation job kinds (`dft_relax`, `md_run`, `mlip_predict`)
  to `services/compute`.
- Add the `compute_simulation_results` table + `input_deck_hash` column.
- Add `aigarth/worker-dft` (VASP, Quantum ESPRESSO) and
  `aigarth/worker-md` (LAMMPS, GROMACS) container images.
- Wire up a 3-worker local cluster (1× DFT, 1× MD, 1× MLIP).
- Add a Material Design ANN (generative model) and an Optimization
  ANN (Pareto sort).
- Add an Experiment Planning ANN (LLM, converts a candidate
  material to a lab protocol).
- Add a Validation ANN (compares predictions against historical
  literature and the user's prior experiments).

**Deliverable:** a "find a new battery cathode" workflow that takes
a research question, runs 100 DFT relaxations on candidate materials,
returns the top 5 with uncertainty estimates. ~52 QU per run, ~100
hours wall-clock on a single CPU worker.

### Phase 3 — ANN marketplace

- Publish the 8 ANNs as real marketplace listings.
- Per-ANN quality ranking in the marketplace (uses the
  `material_ann_quality` rollup).
- Reviews and ratings flow into `material_feedback_events`.
- A `kind = 'research_pipeline'` listing type so a coordinated
  multi-ANN workflow can be listed/sold as a single product
  ("Battery Cathode Discovery Pack").

**Deliverable:** a researcher can buy a pre-composed pipeline
("High-Entropy Alloy Discovery Pack") and run it end to end without
configuring the 8 ANNs themselves.

### Phase 4 — Distributed research network

- Real K12 signature verification (precondition, see `p16-p4-k12`).
- On-chain `ann_registry`, `worker_registry`, `reputation`,
  `rewards`, and the new `discovery_attribution` contracts.
- Off-chain rollup of `material_ann_quality` commits to chain once
  per day. The `discovery_attribution` action is one-way and
  immediate (not via rollup).
- QUBIC reward distribution: 50% worker, 30% ANN author, 10%
  protocol treasury, 10% discovery_attribution pool (a research
  lab that publishes a material discovery is rewarded from this
  pool).
- A "publish" action that takes a `material_predictions` row,
  records on-chain attribution, and emits an event the user can
  cite in their paper.

**Deliverable:** a published material discovery that is attributable
on-chain to specific ANNs, specific workers, and specific
researchers.

### Re-evaluation gate at the end of Phase 1

If we can ingest 1,000 papers and answer a 3-paragraph research
question in < 5 minutes, with structured property values and
citations, the architecture has proven itself. We commit to Phase 2
with real numbers. If not, the prototype becomes an internal tool,
the architecture stands, and we tell the use case honestly: the
pieces are real, the experience is not yet there.

---

## 5. Cost model (illustrative, 1× CPU worker)

A "find a new battery cathode" workflow:

| Stage | Cost (QU) | Wall time | Note |
| --- | --- | --- | --- |
| Literature (paper ingestion, 30 papers) | 0.10 | 5 min | LLM call to gateway |
| Research Director (plan) | 0.05 | 1 min | LLM call |
| Material Design (100 candidates) | 1.00 | 30 min | Generative model |
| DFT relaxation (100 candidates, surrogate first) | 5.00 | 60 min | MLIP, then DFT for top 10 |
| DFT refinement (top 10, full DFT) | 45.00 | 100 hours | VASP, 10× ~10 CPU-hours each |
| Physics Reasoning (sanity check) | 0.20 | 5 min | Rule-based, no compute |
| Optimization (Pareto sort) | 0.10 | 1 min | Local CPU |
| Experiment Plan | 0.05 | 2 min | LLM, lab protocol |
| Validation (against literature) | 0.05 | 1 min | Knowledge graph query |
| **Total** | **~51.55** | **~102 hours** | Per-cathode discovery |

These numbers are **illustrative placeholders** — they will change
as we ship and measure. The point is:

- The cost is dominated by **DFT refinement** (87% of the total).
- **Surrogate-first routing** (MLIP before DFT) cuts the wall time
  by an order of magnitude.
- Per-stage pre-flight estimates are critical. A user who finds out
  at the end that a workflow cost 52 QU is furious. A user who is
  told up front "the workflow will cost ~52 QU, dominated by DFT
  refinement, here is the breakdown" is making an informed choice.
- A monthly reservation of 1,000 QU covers ~20 cathode discoveries
  per month for a research lab — a realistic budget for a small
  materials research group.

---

## 6. Top 8 risks

| # | Title | L | I | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | Scientific correctness — a wrong prediction is worse than no prediction | high | high | Physics Reasoning ANN as a sanity checker; uncertainty quantification on every prediction; conservative defaults; never auto-publish. |
| 2 | Cost is brutal — DFT is hours-to-days, full workflows are ~52 QU | high | high | Per-stage pre-flight estimates; surrogate-first routing; input-deck caching; reservations; cancel + partial refund. |
| 3 | Validation is the long pole — real experiments take weeks | high | med | Cross-simulation validation as a first pass; literature validation as a second pass; experiment planning so a real lab can run it; long feedback windows in the data model. |
| 4 | Heterogeneous compute — DFT needs HPC, literature is LLM, MD is GPU | med | high | Capability-tagged workers; fine-grained scheduler matching; per-engine container images (`aigarth/worker-dft`, `aigarth/worker-md`, `aigarth/worker-lit`). |
| 5 | K12 signature verification still TODO — blocks Phase 4 entirely | high | crit | Precondition. Implement using `@noble/curves` (already a dep). Same as Phase 16. |
| 6 | Open data licensing — Materials Project, OQMD are CC-BY; commercial use unclear | med | med | Provenance tracking on every artifact; per-source license metadata; takedown workflow; partner with a research lab that has clarified licensing. |
| 7 | No "ground truth" — physics correctness vs experiment drift | high | high | Uncertainty quantification on every prediction; calibration scoring on the rollup; cross-validation against multiple workers. |
| 8 | Cold start — material science ANNs need domain expertise | med | high | Seed with 3–5 partner labs that author the first 8 production-quality ANNs before opening the marketplace. |

The full risk register is in the dashboard at `/material-science`.

---

## 7. What this is *not*

This is **not** automated science. Aigarth cannot run a real
experiment. Aigarth cannot replace a materials scientist. Aigarth
*can*:

- Plan an experiment (a structured research protocol).
- Predict its outcome (with uncertainty).
- Validate the prediction against historical literature and prior
  experiments.
- Find the next candidate material faster than a human can by
  reading papers.

That is a real product, and it is genuinely valuable. The docs
should say so — the value is in *accelerating* the human research
loop, not in replacing it.

This is also **not** a replacement for dedicated materials
software (VASP, Quantum ESPRESSO, LAMMPS, GROMACS, the Materials
Project web UI). Those tools are excellent. Aigarth's job is to
make them composable, attributable, and rateable. The user still
picks the engine; Aigarth handles the workflow.

---

## 8. The decision we are asking for

**Should we proceed to Phase 1?**

Phase 0 (this document) is the documentation. Phase 1 is the
knowledge prototype — ingest 1,000 papers, answer a research
question in < 5 minutes. The cost is small (~16 SP, ~4 weeks of
focused work). The risk is also small — the worst case is a
useful internal tool. The upside is a Phase 2 that proves the
end-to-end material-science workflow on real infrastructure.

**Recommended decision:** proceed to Phase 1 with a 4-week
re-evaluation gate. If we can ingest 1,000 papers and answer a
research question in < 5 minutes, commit to Phase 2 with real
numbers. If not, the prototype becomes an internal tool, the
architecture stands, and the use case is honestly retired.

---

*End of architecture evaluation. Companion artifacts:*

- *Blog article — `docs/use-cases/material-science.md`*
- *Dashboard — `localhost:4000/material-science`*
- *Marketing page — `localhost:3003/use-cases/material-science`*
- *Delivery report — `docs/deliveries/phase-17-material-science-delivery.md`*
