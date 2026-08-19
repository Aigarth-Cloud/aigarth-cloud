# Video Synthesis ANN — Architecture Compatibility Evaluation

**Use case:** AI Video Synthesis through Keyframe Intelligence, Procedural
Rendering, and Distributed Compute, modeled as a coordinated swarm of
specialized ANNs (Director, Camera, Motion, Depth, FX, Audio, Quality).

**Audience:** Aigarth Cloud architecture team.

**Status:** Phase 0 — Pre-implementation evaluation. Document answers
the four evaluation questions in the proposal, enumerates the required
extensions to the current architecture, and lays out a four-phase
development path. No production code is being written yet.

---

## 1. TL;DR

| Dimension | Verdict | What needs to change |
| --- | --- | --- |
| ANN compatibility | **Strong** | services/ann already does versioning, marketplace listings, reviews, and a deploy hook into services/compute. We need: feedback events, performance metrics, version evolution. |
| Compute architecture | **Strong** | services/compute already has jobs, clusters, regions, and reservations. We need: typed task kinds (render, motion, depth, fx, audio), worker pool semantics, and a sandboxed execution contract. |
| Continuous learning | **Greenfield** | Nothing in the current system stores feedback, success/failure, or per-ANN quality signals. This is the biggest missing piece. |
| Qubic integration | **Already designed for** | The Qubic compute substrate can host worker nodes today; only the reward + reputation contracts are missing. |

The proposal is well-aligned with the current architecture. The most
honest finding is that the **continuous learning** pillar is the
largest single gap. It is also the part of the proposal that turns the
use case from "an interesting demo" into a true Aigarth story.

---

## 2. Architecture compatibility — dimension by dimension

### 2.1 ANN compatibility

**What the proposal needs:**

- Multiple specialized ANNs coexisting in the platform
- Versioned ANN definitions (an ANN is not just code, it's also
  weights, prompts, configurations)
- Listing + selling ANNs in a marketplace
- Performance tracking per ANN
- Continuous evolution through feedback

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

The proposal implicitly assumes that the platform's notion of "ANN"
can be specialized — i.e. the platform can tell a Director ANN from a
Camera ANN. Today the registry has categories (`category` text field
+ 16 seeded values) but **no first-class concept of an ANN role in a
pipeline**.

This is a small, well-bounded change:

- Add a `role` enum on `anns` (or a many-to-many `ann_roles` table):
  `director`, `camera`, `motion`, `depth`, `fx`, `audio`, `quality`,
  `generic` (default).
- Add a `pipeline` table that lists ordered roles and the input/output
  shape contract for each stage. This is the "Director's shot list"
  made into a runtime object.
- A `pipeline_runs` table that records a single execution of a
  pipeline against a user prompt, with per-stage status, latency, and
  artifact URLs.

These are additive — they don't disturb existing ANN flows. A
"tourism video" ANN could just be a generic ANN with a specialization
category, or it could be a Director + a Camera + a Motion pipeline
made of multiple specialized ANNs.

**Compatibility verdict: 8/10.** Add `role` + `pipeline` + `pipeline_runs`
to services/ann. Everything else works.

### 2.2 Compute architecture

**What the proposal needs:**

- External workers performing CPU/GPU-bound tasks
  (OpenCV, FFmpeg, frame interpolation, video encoding)
- A job scheduler that can route a task to a worker with the right
  capability
- Long-running jobs (minutes to hours)
- Observability: progress, partial output, retry

**What we already have (`services/compute`):**

| Capability | Where it lives | Status |
| --- | --- | --- |
| Job submission with a typed `kind` enum | `jobs.kind` | Ready — already has `training`, `inference`, `batch`, `broadcast` |
| Cluster membership + heartbeat | `cluster_members` | Ready |
| Region-aware routing (latency hints, "best region for X") | `regions` + `clusters` | Ready |
| Reservations (pre-purchased capacity, billed per epoch) | `reservations` | Ready |
| Per-user credit balance (denormalized counter) | `compute_credits` | Ready |
| Idempotent submission (idempotency_key) | `services/compute` middleware | Ready |
| Synthetic broadcast for testing (test-only) | `POST /v1/compute/jobs/broadcast` | Ready |

**Gap analysis:**

The compute service is task-agnostic. It doesn't know what a "video
render" job is; it only knows that a job has a `kind`, a `payload`,
and a `status`. That is the right level of abstraction for a video
pipeline.

What's missing is the **worker-side** story:

- Today, `services/compute` is the orchestrator only. There are no
  workers — `broadcast` is a test-only synthetic path. A real worker
  pool would need:
  - A worker protocol: connect to a long-poll / WebSocket endpoint,
    receive `{ job_id, kind, payload }`, run it, POST progress +
    result.
  - Capability advertisement: a worker says "I can do
    `motion.frame_interpolate` with 4× upscale" and the scheduler
    routes matching jobs to it.
  - Resource limits: a worker reports its CPU/GPU/memory; the
    scheduler refuses jobs that don't fit.
  - Heartbeat + liveness: idle workers time out, jobs are
    re-queued.
  - A trust model: workers are untrusted code. They must run in
    containers (Docker / Firecracker) and have a network policy
    that limits egress (no internet, only Aigarth APIs).

This is genuinely new work, but it lives in a **new layer**, not in
the existing services. Concretely:

- A new `services/worker-registry` (or an extension of
  `services/compute`) that tracks worker capabilities + liveness.
- A new worker container image (`aigarth/worker-video`) with the
  Python + OpenCV + FFmpeg + PyTorch runtime. A worker is registered
  by the operator, not a user.
- A `worker_runtime` Python package (small) that wraps the protocol
  and the OpenCV/FFmpeg calls.

**Compatibility verdict: 7/10.** Compute service needs to grow a
`/v1/workers/*` namespace and a `/v1/jobs/:id/progress` long-poll
endpoint. The schema gets a `worker_id` column on `jobs` and a
`workers` table. The work is additive, no existing flow changes.

### 2.3 Continuous learning

**What the proposal needs:**

- Store successful outputs, failed outputs, user feedback
- Per-ANN performance metrics
- Use these signals to improve future ANN versions

**What we already have:**

Today, we store:

- Reviews (1-5 star, comment) on ANNs and on marketplace listings.
- Marketplace purchase events.
- Gateway usage (token counts, latencies, costs).
- An `ann_audit_logs` table per service (free-form action text).

We **do not** store:

- Per-pipeline-run outcomes (did the Director ANN produce a coherent
  shot list? did the Motion ANN actually animate without flicker?).
- Per-stage attribution: which ANN in a pipeline produced the
  failure.
- Ground-truth labels (user "thumbs up" on a 5-second rendered clip).
- A time series of an ANN's quality over its versions.

**This is the largest single gap.** The proposal hinges on it
("this represents the philosophy of Aigarth: specialized intelligence
modules that can collaborate, **improve, and evolve**"). Without it,
we just have a multi-ANN scheduler; with it, we have an evolutionary
system.

Required additions:

- A `feedback_events` table (service-local, no cross-service join
  needed):
  - `id`, `ann_id`, `ann_version_id`, `pipeline_id`,
    `pipeline_run_id`, `kind` (rating, thumbs, retry, error,
    completion-time)
  - `value` (numeric or JSON), `notes` (text)
  - `created_at`, `actor_id`, `actor_kind` (user, system)
- A `version_metrics` materialized view (or rollup table refreshed
  on a cron) that pre-computes per-`ann_version_id` aggregates:
  - `n_runs`, `n_success`, `n_failure`
  - `mean_quality_score`, `p50_latency_ms`, `p99_latency_ms`
  - `mean_user_rating`, `n_thumbs_up`, `n_thumbs_down`
- A `version_provenance` column on `ann_versions` linking back to
  the version it evolved from, plus a `version_diff` JSON column
  storing a human-readable change summary.

The cron / rollup pattern is already used in the gateway for
`usage_summary`. We can extend it.

**Compatibility verdict: 5/10.** Real new work, no shortcuts. But
it's a focused scope: one new table per service, one rollup job,
and a feedback-event capture pattern that all services can emit.

### 2.4 Qubic integration

**What the proposal needs:**

- ANN ownership (an ANN has an on-chain owner)
- Compute contribution rewards
- Decentralized worker network
- Reputation scoring
- Verification mechanisms

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

**Gap analysis:**

The Qubic layer is already designed for this. The single most
important design decision is:

> Should computation happen outside Qubic, with only economic
> coordination on-chain?

**Yes.** Aigarth is a smart-contract-deployable project on Qubic, not
a Qubic-native chain. Heavy compute (FFmpeg, OpenCV) does not belong
on Qubic computors — those are validated per-tick and are best used
for economic coordination, registry state, and reputation, not for
running a video pipeline.

The on-chain layer would expose:

- `ann_registry` — list / get / register / update ownership.
- `worker_registry` — register a worker, stake a reputation amount,
  slash on misbehavior.
- `reputation` — track per-worker quality score (driven by off-chain
  feedback events aggregated off-chain and committed to chain as
  state roots).
- `rewards` — distribute QUBIC to workers + ANN authors based on
  contributions.

This maps cleanly to existing Qubic patterns (`outsourced-computing`
contract, treasury, staking). The off-chain rollup → on-chain
commitment is a well-understood optimistic-rollup pattern.

**Compatibility verdict: 9/10.** The shape is right, but we're blocked
on real K12 signature verification. Without it, on-chain writes are
insecure. This is a precondition for the on-chain portion of any
Qubic-integrated use case, not just video.

---

## 3. Required changes to current Aigarth architecture

### 3.1 Schema additions

**`services/ann`**

```sql
-- New
ALTER TABLE anns ADD COLUMN role ann_role NOT NULL DEFAULT 'generic';
CREATE TYPE ann_role AS ENUM (
  'generic', 'director', 'camera', 'motion', 'depth',
  'fx', 'audio', 'quality'
);

CREATE TABLE ann_pipelines (
  id            uuid PRIMARY KEY,
  owner_id      uuid NOT NULL,
  slug          text NOT NULL UNIQUE,
  name          text NOT NULL,
  description   text,
  -- ordered list of (ann_slug, ann_version, role) tuples
  stages        jsonb NOT NULL,
  visibility    ann_visibility NOT NULL DEFAULT 'private',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ann_pipeline_runs (
  id              uuid PRIMARY KEY,
  pipeline_id     uuid NOT NULL REFERENCES ann_pipelines(id),
  status          ann_pipeline_status NOT NULL DEFAULT 'pending',
  -- per-stage status + artifact URLs (one row per stage)
  stage_results   jsonb NOT NULL DEFAULT '[]',
  final_artifact_url text,
  total_cost_qubic bigint NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);

CREATE TABLE ann_feedback_events (
  id              uuid PRIMARY KEY,
  ann_id          uuid,
  ann_version_id  uuid,
  pipeline_id     uuid,
  pipeline_run_id uuid,
  kind            text NOT NULL,    -- 'rating', 'thumbs', 'retry', 'error', 'completion'
  value           jsonb NOT NULL,
  notes           text,
  actor_id        uuid,
  actor_kind      text NOT NULL,    -- 'user', 'system', 'worker'
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE MATERIALIZED VIEW ann_version_metrics AS
SELECT
  v.ann_id,
  v.id AS ann_version_id,
  COUNT(r.*)              AS n_runs,
  SUM(CASE WHEN r.status='succeeded' THEN 1 ELSE 0 END) AS n_success,
  AVG((f.value->>'score')::numeric) AS mean_quality_score
FROM ann_versions v
LEFT JOIN ann_pipeline_runs r ON r.pipeline_id IN (
  SELECT id FROM ann_pipelines WHERE stages @> jsonb_build_array(jsonb_build_object('ann_version_id', v.id))
)
LEFT JOIN ann_feedback_events f ON f.pipeline_run_id = r.id
GROUP BY v.ann_id, v.id;
```

**`services/compute`**

```sql
CREATE TYPE compute_job_kind AS ENUM (
  'training', 'inference', 'batch', 'broadcast',
  'render', 'motion', 'depth', 'fx', 'audio', 'quality'
);

ALTER TABLE jobs ALTER COLUMN kind TYPE compute_job_kind USING kind::compute_job_kind;

CREATE TABLE compute_workers (
  id              uuid PRIMARY KEY,
  owner_id        uuid NOT NULL,
  display_name    text NOT NULL,
  capabilities    jsonb NOT NULL,    -- ['render.h264_1080p', 'motion.optical_flow', ...]
  region          text,
  cpu_cores       int,
  gpu_model       text,
  memory_gb       int,
  status          compute_worker_status NOT NULL DEFAULT 'online',
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  reputation_score numeric NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE jobs ADD COLUMN worker_id uuid REFERENCES compute_workers(id);
ALTER TABLE jobs ADD COLUMN progress_percent int NOT NULL DEFAULT 0;
ALTER TABLE jobs ADD COLUMN stage_label text;
```

**`services/marketplace`** (additive)

Add a `kind = 'pipeline'` listing type so a coordinated multi-ANN
workflow can be listed/sold as a single product.

### 3.2 New endpoints

**`services/ann`**

```
POST   /v1/pipelines              create a pipeline (ordered stages)
GET    /v1/pipelines              list own pipelines
GET    /v1/pipelines/:id          retrieve
PATCH  /v1/pipelines/:id          update stages
POST   /v1/pipelines/:id/run      submit a pipeline run (becomes a compute job)
GET    /v1/pipelines/:id/runs     list runs
GET    /v1/runs/:id               retrieve run (with per-stage status)
POST   /v1/runs/:id/feedback      attach feedback (thumbs, rating, error)
GET    /v1/anns/:id/feedback      rollup of feedback for an ANN
```

**`services/compute`**

```
POST   /v1/workers                register a worker
GET    /v1/workers                list workers (filtered by capability)
GET    /v1/workers/:id            retrieve (with reputation, last_heartbeat)
POST   /v1/workers/:id/heartbeat  keepalive + capability re-advertisement
POST   /v1/workers/:id/deregister
POST   /v1/jobs/:id/progress      worker posts progress (percent + stage_label + partial_artifact_url)
POST   /v1/jobs/:id/complete      worker posts final result
GET    /v1/jobs/next              worker pulls the next job it can do
```

### 3.3 New SDK resources

```
client.pipelines.list() / create() / retrieve() / run() / listRuns()
client.runs.retrieve() / feedback()
client.workers.list() / register() / heartbeat() / deregister()
```

### 3.4 New components (apps/dashboard)

A new `/video` page on the tracker:

- A static manifest of the proposed architecture (7 ANN roles,
  pipeline concept, worker pool) — same look-and-feel as `/services`.
- A status grid (4 dimensions × compatibility verdict) — same look
  as a radar chart or color-coded table.
- A roadmap timeline (4 development phases with checklist progress).
- A risk register (top 8 risks, color-coded by likelihood × impact).
- A live `feedback` feed wired to the registered feedback events.
- A live "mock pipeline run" toggle (off-chain, deterministic) that
  drives a real `pipeline_run` record through every status so we can
  see the dashboard before the worker pool is built.

A new `/use-cases/video-synthesis` page on the marketing site
(`apps/web`) that:

- Renders the blog article (10 pages, plain English).
- Embeds a 30-second demo clip of a pipeline run (rendered locally
  with OpenCV + FFmpeg as a placeholder).
- Has a "subscribe" CTA tied to the existing `services/marketplace`
  notify-me endpoint.

### 3.5 Compute & cost additions

A video pipeline is **expensive**. A 30-second 1080p render at 30 fps
is 900 frames. Even a cheap OpenCV pass takes 5–10 minutes on a
mid-range CPU. We need:

- **Per-stage cost accounting** — credit deduction on each stage
  completion, not just on the final frame. This is the
  `stage_results` JSON's job.
- **Per-stage retry** — if the Motion ANN fails, re-run only the
  Motion stage, not the whole pipeline.
- **Pre-flight estimate** — before submission, the Director ANN's
  shot list produces an estimated cost + duration. The user must
  confirm.
- **Cancel + partial refund** — if the user cancels mid-pipeline, the
  stages that have completed are kept (cache) and the refund is for
  the un-rendered stages only.

These are all additive on the existing `compute_credits` /
`reservations` flow.

---

## 4. Recommended implementation strategy

### Phase 0 — Documentation (THIS DELIVERABLE)

- [x] Architecture compatibility evaluation (this doc)
- [x] Blog article published on the Aigarth Cloud website
- [x] Dashboard `/video` page live with the architecture diagram,
      compatibility verdicts, roadmap, and risk register

### Phase 1 — Centralized prototype

Goal: prove the workflow with a single Python process acting as
Director + Camera + Motion + Render. No workers, no blockchain, no
distributed anything.

- Add `role` column + `ann_pipelines` + `ann_pipeline_runs` tables
  to `services/ann`.
- Add a Director ANN that takes a prompt, returns a shot list
  (LLM call to the gateway, no new model).
- Add a Camera ANN that picks cinematic movements for each shot
  (rule-based, no training).
- Add a Motion ANN that takes a static image + camera move +
  duration, returns a keyframe sequence (OpenCV affine transforms,
  fully deterministic).
- Add a Render ANN that takes the keyframe sequence and produces
  an MP4 (FFmpeg).
- Add a mock pipeline run endpoint that drives the workflow end
  to end and writes a real `ann_pipeline_runs` row.
- Update the dashboard `/video` page with a "Run a sample pipeline"
  button that exercises this.

**Deliverable:** a 30-second MP4 of a "city at sunset" prompt
generated locally, plus a `pipeline_run` record with all stages
attributed.

### Phase 2 — ANN marketplace integration

- Publish the Director / Camera / Motion / Render ANNs as real
  marketplace listings.
- Add a `kind = 'pipeline'` listing type and let users buy a
  pre-composed pipeline ("Tourism Video Pack") that wires together
  several ANNs.
- Per-ANN version metrics rollup via the materialized view.
- Reviews and ratings flow into `ann_feedback_events`.

### Phase 3 — Distributed compute

- Add the worker registry + protocol.
- Ship `aigarth/worker-video` (Docker image, ~2 GB, includes Python
  + OpenCV + FFmpeg + PyTorch CPU).
- Wire `POST /v1/jobs/:id/progress` and `/v1/jobs/next` long-poll.
- Add a 3-worker local cluster for E2E testing.
- Per-worker reputation scoring from feedback events.

### Phase 4 — Qubic ecosystem integration

- Deploy the on-chain `ann_registry`, `worker_registry`,
  `reputation`, `rewards` contracts.
- Commit the off-chain `ann_version_metrics` rollup as an
  on-chain state root once per day.
- Real K12 signature verification (precondition for the whole
  Qubic portion).
- Reward distribution: 70% to worker, 20% to ANN author, 10% to
  protocol treasury.

---

## 5. Risks and limitations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | Video is expensive — 5–10 min on CPU, 30–60s on a single GPU. | High | High | Per-stage pre-flight estimate; per-stage credit deduction; pre-purchased capacity via `reservations`. |
| 2 | Multi-ANN coordination introduces error compounding — a bad Director output cascades through Camera and Motion. | High | High | Quality ANN at the end of every pipeline; user-driven re-runs only re-do the failing stage; A/B two Director ANNs in shadow. |
| 3 | Worker trust — workers run untrusted code. | Medium | Critical | Docker sandbox with no network; egress allowlist to Aigarth APIs only; resource caps; reputation + slashing. |
| 4 | Feedback attribution — when a pipeline fails, which ANN is responsible? | High | Medium | Per-stage `attribution` field on each feedback event; Quality ANN emits a "weakest stage" verdict. |
| 5 | Latency — a 30-second render taking 5 minutes is bad UX. | Medium | High | Streaming preview (low-res, fast feedback) + final-render handoff. |
| 6 | State explosion — many ANNs × many versions × many runs × many feedback events = lots of rows. | Medium | Medium | Pre-aggregated `ann_version_metrics` materialized view; per-service audit log TTL; cold-store old runs. |
| 7 | Real K12 signature verification is still TODO. | High | Critical for Qubic phase | Precondition: implement K12 verification using `@noble/curves` (already a dep). |
| 8 | Video is the canary use case — if this fails, the broader Aigarth story suffers. | Low | Critical | Frame as a use case, not the platform's purpose. ANN marketplace and compute are usable without it. |
| 9 | Cold-start problem: zero ANNs at launch means zero value. | Medium | High | Seed with 5–8 production-quality Director / Camera / Motion ANNs before opening the marketplace. |
| 10 | Legal — output resembles a copyrighted style. | Low | High | Generation provenance attached to every artifact; takedown workflow via `services/ann` audit log. |

---

## 6. Recommendation

**Build Phase 1 (centralized prototype) next.** It exercises every
new schema and endpoint without taking on worker trust, Qubic, or
on-chain rewards. The `/video` page on the dashboard becomes a live
demo of the concept. The blog article ships in parallel and starts
collecting interest signals (waitlist signups via the marketplace
notify-me endpoint).

If Phase 1 produces a coherent 30-second render from a one-paragraph
prompt within 10 minutes end-to-end, the architecture has proven
itself and the proposal is real. We then commit to Phase 2–4 with
honest numbers.

If Phase 1 reveals that the cost or quality bar is unreachable, we
back off cleanly — the centralized prototype becomes an internal
tooling demo, and we tell the use case honestly: the pieces are
real, but the experience is not yet there. The rest of the
architecture is unaffected.

**This is exactly the right way to evaluate a new use case on a
production-grade platform: build the smallest end-to-end version
that answers the question, then decide.**

---

## Appendix A — Mapping proposal → current services

| Proposal element | Current service | Status | Gap |
| --- | --- | --- | --- |
| Director ANN | services/ann + services/gateway (LLM call) | Ready | Add `role='director'`, no schema beyond that |
| Camera ANN | services/ann (rule-based) | Greenfield | New ANN + marketplace listing |
| Motion ANN | services/ann + services/compute (OpenCV job) | Greenfield | New ANN + new compute `kind='motion'` |
| Depth ANN | services/ann + services/compute (MiDaS via PyTorch) | Greenfield | New ANN + new compute `kind='depth'` |
| FX ANN | services/ann + services/compute (particles + compositing) | Greenfield | New ANN + new compute `kind='fx'` |
| Audio ANN | services/ann + services/compute (audio alignment) | Greenfield | New ANN + new compute `kind='audio'` |
| Quality ANN | services/ann (real model, fine-tuned later) | Greenfield | New ANN + new compute `kind='quality'` |
| Procedural Rendering Engine | services/compute (FFmpeg job) | Greenfield | New compute `kind='render'` |
| ANN marketplace | services/marketplace | Ready | Add `kind='pipeline'` listing type |
| ANN versioning | services/ann | Ready | None |
| ANN performance tracking | services/ann (`ann_version_metrics` view) | Greenfield | New materialized view + cron |
| ANN evolution through feedback | services/ann (`ann_feedback_events`) | Greenfield | New table + capture pattern |
| Worker pool | services/compute | Greenfield | New `/v1/workers/*` namespace |
| Job scheduler | services/compute (existing) | Ready | None |
| Compute tasks | services/compute (typed `kind`) | Ready | Add 6 new kinds to enum |
| ANN ownership on-chain | services/qubic + on-chain contract | Greenfield | New contract + K12 |
| Worker rewards on-chain | services/qubic + on-chain contract | Greenfield | New contract + K12 |
| Reputation scoring | services/qubic + on-chain contract | Greenfield | New contract + K12 |
| Verification | services/qubic (K12) | Blocked | K12 sig verification TODO |
| Local dashboard | apps/dashboard `/video` | New | This work |
| Marketing site | apps/web `/use-cases/video-synthesis` | New | This work |

## Appendix B — Cost model (illustrative)

A 30-second 1080p render, fully off-chain centralized prototype:

| Stage | Estimated cost (QU) | Estimated latency | Notes |
| --- | --- | --- | --- |
| Director (LLM call) | 0.05 | 2 s | One round-trip to gateway |
| Camera (rule-based) | 0.01 | < 1 s | Pure function |
| Motion (OpenCV, CPU) | 0.50 | 60 s | 900 frames × 65 ms/frame |
| Depth (MiDaS, CPU) | 0.30 | 45 s | 900 frames × 50 ms/frame |
| FX (compositing) | 0.10 | 10 s | 900 frames × 11 ms/frame |
| Audio (alignment) | 0.05 | 5 s | One short clip |
| Quality (model) | 0.10 | 15 s | One full pass |
| Render (FFmpeg) | 0.05 | 30 s | Encode h264 |
| **Total** | **~1.16 QU** | **~3 min** | vs. ~3 USD retail cloud GPU |

These are **illustrative placeholders**, clearly labeled. They
are not commitments, and they will change as we move to GPU workers
and on-chain accounting.

A real customer-priced video at this cost would be ~$0.40 in QUBIC at
illustrative retail rates, vs. ~$0.50–$1.50 for comparable cloud
GPU inference. The value prop is **not** raw cost — it is the
controllability and the specialized ANN marketplace.

---

*End of evaluation. Decision: proceed to Phase 1 (centralized
prototype) on a 4-week timeline. Re-evaluate at the end of Phase 1
with a real 30-second render and a live `/video` dashboard.*
