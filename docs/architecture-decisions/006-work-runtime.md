# ADR 006 — Work Runtime (Adopt, New Service on Port 7012)

| Field | Value |
|---|---|
| **Status** | Proposed (acceptance requires a successful Wave 3 build) |
| **Date** | 2026-08-13 |
| **Author** | Aigarth Cloud Architecture Team |
| **Reviewers** | Engineering, Founders |
| **Builds on** | v0.2 PEP §11-§15, v0.2 PEP §16 (Qubic), v0.2 PEP §31, ADR 003 (Trinary Protocol), ADR 005 (Organism Primitive) |
| **Decides** | Whether to adopt the Work Runtime as a new first-class service in Aigarth Cloud |
| **Outcome** | Adopt the Work Runtime as a new service `services/work` on port 7012. The service mirrors the `services/tissue` shape (Fastify + Drizzle + JWT + NATS) and ships a four-tier model (local → federated → OC processor → multi-workload) that the Phase 27 build only fills in for Tier 1 (local Docker runner); Tiers 2-4 are scoped to Phases 28-30. Five new tables land in Drizzle migration `0000_*`: `work_items`, `workers`, `work_results`, `worker_challenges`, `work_audit`. The v1 verification stack is replication (3/3) + challenge (1/100) + reputation (rolling 30d) + result commitments; TEE, ZK, and staking+slashing are explicitly deferred. Acceptance of this ADR requires a successful Wave 3 build (Build Tasks 7-10) honouring the per-section contracts below. |

---

## 1. Context

The Aigarth Cloud Evolution PEP v0.2 (`docs/proposals/aigarth-cloud-evolution-pep-v0.2.md`) — approved at the 2026-08-12 checkpoint (`docs/evolution/CHECKPOINT-2026-08-12.md:23-25`) — proposes, alongside the Organism primitive, a single new service to close the gap between today's "submit a compute job, wait for a Qubic tx" surface and the platform's stated thesis of running *adaptive* intelligences: the **Work Runtime**. The PEP's Falsification Audit (`aigarth-cloud-evolution-pep-v0.2.md:44`) is explicit about the gap: *"Build a generalised task abstraction T = (I,A,O,K,V,R) — Partial. `services/compute` has a job runner (`src/services/jobs.ts`, `src/workers/job-monitor.ts`) with reservations, escrow, qearn-lock. But there is no general `work_items` table, no per-algorithm container, no replication verification, no per-worker reputation."*

The superprompt-level definition (`aigarth-cloud-evolution-pep-v0.2.md:340-341`):

```
T = (I, A, O, K, V, R)
```

where `I` = inputs, `A` = algorithm, `O` = objective, `K` = constraints, `V` = verification, `R` = reward. v0.2 reduces this to a single YAML envelope (§11, `aigarth-cloud-evolution-pep-v0.2.md:345-380`) plus a worker manifest (§12, `aigarth-cloud-evolution-pep-v0.2.md:395-413`) plus a verification table (§15, `aigarth-cloud-evolution-pep-v0.2.md:481-491`). The Organism (ADR 005) is the *producer* of work items; the Work Runtime is the *executor* of them. They are coupled but separately governed — Organism routes live in `services/ann`; Work Runtime routes live in `services/work` (per PEP §30, `aigarth-cloud-evolution-pep-v0.2.md:947`: *"All Work Runtime tables live in the new `services/work`"*).

**What `services/compute` already does** (`services/compute/src/services/jobs.ts`):
- Per-user `jobs` rows with a 5-state lifecycle `queued -> submitted -> running -> completed | failed | cancelled` (lines 3-6, 134).
- Reservation-backed credit pre-authorization: `estimateJobCost()` (lines 56-59) charges against `reservations.usedQubic` at submit (lines 179-187) and refunds on cancel (lines 311-319).
- A `setInterval`-driven monitor (`services/compute/src/workers/job-monitor.ts:18-78`) that polls in-flight jobs every 10s and consumes `aigarth.compute.job` events from NATS for state transitions.
- An in-process lease-claim pattern visible in `services/training/src/workers/job-runner.ts:64-86` (`claimNextQueuedJob()` → `runJob` → auto-publish), where one training job is leased per process tick.

**What `services/compute` is not:**
- It has **no per-algorithm container registry** (the `type` column is a 4-value enum: `contract_call | training | inference | general`, see `services/compute/src/services/jobs.ts:39`).
- It has **no replication verification** (a job runs once on one Qubic-tick-driven path; the `result` JSONB at `services/compute/src/db/schema.ts` is whatever the worker put there, unverified).
- It has **no per-worker reputation** (the schema is per-user, not per-worker; there is no concept of a "worker" at all).
- It has **no challenge tasks** and **no result commitments** (no commit-reveal pattern; results are post-hoc).
- It has **no work-item envelope** — the input is a `payload: record(unknown)` (line 44) shaped by the consumer, not by the platform.

**What the Work Runtime is:** a *new* service that takes the `T = (I, A, O, K, V, R)` envelope as the single first-class work item, runs it on a registered worker that matches the capability, verifies the result with a 4-mechanism v1 stack (replication + challenge + reputation + result commitments), and emits a `WorkUsageEvent` to `services/billing` mirroring the `TissueUsageEvent` pattern at `services/billing/src/services/tissueUsage.ts:24-35`. The v0.2 §13 four-tier compute model (local → federated → OC → multi-workload) and the v0.2 §15 verification ladder are the contracts; Phase 27 ships Tier 1 only.

The checkpoint (`docs/evolution/CHECKPOINT-2026-08-12.md:54`) names the missing service explicitly: *"`services/work` — port 7012. The Work Runtime. **Does not exist.**"* Phase 27 is the build. This ADR is the contract.

## 2. Decision

**Adopt the Work Runtime as a new first-class service `services/work` on port 7012. Ship the five new tables in Drizzle migration `0000_*` (Wave 3 Build Task 7). Layer the scheduler (Task 8), verifier + accountant (Task 9), and first algorithm `awork_1` (Task 10) on top of the same tables in subsequent waves.**

The new service **mirrors `services/tissue`'s shape** (per `services/tissue/package.json:1-45` and the tree at `services/tissue/src/{config,db,lib,routes,services,tests}/`):
- **Fastify 4.x** HTTP server with `@fastify/jwt`, `@fastify/cors`, `@fastify/helmet`, `@fastify/cookie` (per `services/tissue/package.json:26-29`)
- **Drizzle ORM 0.42** on Postgres with the same migration journal pattern (per `services/tissue/package.json:30` and `services/tissue/drizzle/_journal.json`)
- **Zod 3.23** schemas at the route layer (per `services/tissue/package.json:35`)
- **NATS** for `aigarth.work.*` events (mirroring `aigarth.compute.job` at `services/compute/src/workers/job-monitor.ts:51`)
- **pino + pino-pretty** logging (per `services/tissue/package.json:33-34`)
- **vitest 2.1** for unit + integration tests (per `services/tissue/package.json:43-44`)

**The four-tier model (v0.2 §13, `aigarth-cloud-evolution-pep-v0.2.md:434-444`):**

| Tier | Compute class | First implementation | Where it lives | Verification | Phase |
|---|---|---|---|---|---|
| **1. Local** | Local CPU / Local GPU (NVIDIA runtime) | Docker runner | `packages/worker-local/` | Replication + deterministic re-run | **Phase 27 (this ADR)** |
| **2. Federated** | Remote CPU / Remote GPU | gRPC/HTTP federated worker | Phase 28 | Cross-deployment reputation | Phase 28 |
| **3. OC** | Qubic OC processor | `@aigarth/oc-processor` (QPI listening side) | Phase 29 | 451/676 computor signature | Phase 29 |
| **4. Multi-workload** | Cross-workload economic balancing | Phase 30+ scheduler overlay | Phase 30+ | n/a (composes Tiers 1-3) | Phase 30+ |

**Phase 27 ships only Tier 1.** Tiers 2-4 are *named here* so the schema, routes, and worker manifest have a forward-compatible shape, but the build stream does not implement them. The `workers.kind` enum lists all five v0.2 §12 values (`local | remote | oc-processor | neuraxon | human-via-oracle`) even though Phase 27 only registers `local`.

**What this ADR ships in Phase 27 (Build Tasks 7-10):**
- Five new tables: `work_items`, `workers`, `work_results`, `worker_challenges`, `work_audit` (per PEP §30 + §33 Task 7, `aigarth-cloud-evolution-pep-v0.2.md:955-960`, `aigarth-cloud-evolution-pep-v0.2.md:1202`)
- The thirteen Work Runtime routes (PEP §31, `aigarth-cloud-evolution-pep-v0.2.md:1004-1016`) — see §8
- The scheduler (`services/work/src/services/scheduler.ts` + `services/work/src/workers/assignment.ts`, polled every 5s, per Task 8 at `aigarth-cloud-evolution-pep-v0.2.md:1219-1220`)
- The verifier (`services/work/src/services/verifier.ts`) and accountant (`services/work/src/services/accountant.ts`), per Task 9 at `aigarth-cloud-evolution-pep-v0.2.md:1233`
- The challenger (`services/work/src/workers/challenger.ts`), per Task 9
- The first registered algorithm `awork_1` (a deterministic numerical benchmark, per Task 10 at `aigarth-cloud-evolution-pep-v0.2.md:1241-1252`)
- The Work Item envelope YAML schema (§3 below) as the wire contract
- The worker manifest JSON schema (§4 below) as the registration contract
- A `WorkUsageEvent` Zod schema + `recordWorkUsage()` service mirroring `services/billing/src/services/tissueUsage.ts:24-58` (§7 below)
- 60 vitest cases across the four tasks (15 + 20 + 25 from PEP §33, per `aigarth-cloud-evolution-pep-v0.2.md:1211`, `:1224`, `:1238`)

**What this ADR does NOT decide (out of scope):**
- The Organism primitive (ADR 005). The Organism emits work items via `POST /v1/work/items`; the Work Runtime executes them. The two services share no schema.
- The Qubic OC processor (`@aigarth/oc-processor`, ADR 007, Phase 29). This ADR only *names* Tier 3.
- The federated worker protocol (Phase 28). The `worker.kind = "remote"` enum value is reserved; the gRPC/HTTP contract is not in this ADR.
- The Neuraxon runtime integration (Phase 31, `aigarth-cloud-evolution-pep-v0.2.md:441`). Same treatment as OC: enum value reserved, integration deferred.
- The TireMind scaffolding (companion doc `docs/proposals/tiremind-001.md`, per Task 10 at `aigarth-cloud-evolution-pep-v0.2.md:1248`). The first algorithm is the more general `awork_1`.
- The Proof Lab public page (`apps/web/app/(marketing)/proof-lab/`, PEP §18, §23). This ADR ships the *runtime*; the Proof Lab surfaces its results.

## 3. Work item envelope

The Work Item envelope is the wire contract. v0.2 §11 (`aigarth-cloud-evolution-pep-v0.2.md:345-380`) is the source of truth; the build stream writes the TypeScript / Zod validator against this YAML. The same envelope is used for all four tiers — only the worker that picks it up changes.

```yaml
# services/work/src/types/work-item.ts (Zod-derived)
# ADR 006 — Work Runtime Envelope (v0.2 §11)
work_item:
  work_id: wki_<ulid>                # service-issued; never user-supplied
  type: |                             # see services/work/src/types/work-type.ts
    materials_simulation
    | video_evaluation
    | trinary_decision
    | dft_relaxation
    | awork_1
    | <registry_extends>
  spec_version: 1                      # bumped on envelope shape changes
  input:
    payload_hash: sha256:<hex>         # content-addressed; payload_uri is fetched at assign time
    payload_uri: s3://aigarth/...     # MinIO path; signed GET
    payload_size_bytes: <int>          # 0 < size <= WORK_MAX_PAYLOAD_BYTES (config)
  algorithm:
    name: <algorithm-slug>             # must be in work_algorithms registry
    version: v<semver>                 # PEP §17: BPP-9000 packaging discipline
    container: registry.aigarth.cloud/<algo>:<version>   # signed at registration; see §12 OQ
    deterministic: <bool>              # controls verification method (§6)
  requirements:
    cpu_cores: <int>                   # 1 <= n <= 256
    memory_gb: <int>                   # 1 <= n <= 1024
    gpu: none | optional | required
    gpu_kind: any | rtx_4090 | h100   # see §12 OQ for "any" enforcement
    estimated_runtime_s: <int>         # 1 <= n <= 86400; advisory only
  verification:
    method: replication | challenge | deterministic | tee | zk   # tee/zk deferred to Phase 30+ (§6)
    replicas: 3                        # only meaningful for replication; default 3
    challenge_work_id: null            # filled by the challenger for known-answer tasks
  reward:
    currency: QUBIC                    # enum; QUBIC is the only v1 value (see §7)
    amount: <int-qu-bit>               # 1M Qu-bit = 0.001 QUBIC; PEP §11
    payer: <user-or-organism-uuid>     # organism_id is the long-term plan (ADR 005 §5)
  status: queued | running | verified | failed | disputed
  result:
    payload_hash: sha256:<...>         # content-addressed; payload_uri is the signed PUT response
    completed_by: <worker-uuid>        # primary worker; replicas are in work_results
    completed_at: <iso>
    replicas_agreed: 3/3               # string form; parsed as "<agreed>/<total>"
  audit:
    created_at: <iso>
    created_by: <user-uuid>            # not the payer; the issuer (organism route or human)
    settlement_tx: <qubic-tx-hash>     # null until settled (§7)
```

**Three envelope invariants the build stream must enforce (Zod `.refine()`):**

1. **`verification.method = "deterministic"` requires `algorithm.deterministic = true`.** A deterministic method on a non-deterministic algorithm is a contradiction; the verifier cannot re-run and agree. Reject at submit with 400.
2. **`verification.method = "replication"` requires `replicas >= 2` and `replicas <= 5`.** A 1-replica "replication" is just execution; >5 replicas is not supported in v1.
3. **`status = "verified"` requires `result.replicas_agreed = "3/3"` (or `${replicas}/${replicas}`).** No "verified" label on partial agreement. Disagreement → `status = "disputed"`.

**Three things the envelope explicitly does NOT carry:**
- A `priority` field. Priority is in v0.2 §14 (`aigarth-cloud-evolution-pep-v0.2.md:464`) as a Phase 27.B addition; not in the v1 envelope. The build stream must not add a `priority` field to the v1 wire; doing so is a breaking change to the public contract.
- A `callback_url`. Work Item results are polled via `GET /v1/work/items/:work_id`; there is no push-notification in v1.
- A `parent_work_id` for retry semantics. v0.2 §11 has no retry envelope; a failed work item is `failed` and the issuer must submit a new one. The build stream must not silently retry on `failed`.

**Type-driven polymorphism.** The same envelope is used for a DFT relaxation, a trinary decision, and a video-consistency check (per the PEP §11 G01 test, `aigarth-cloud-evolution-pep-v0.2.md:382-388`). The build stream must NOT branch the route on `work_item.type`; the algorithm's container and the verifier's method are the polymorphism. Branching on `type` would re-introduce the per-workload coupling the runtime is designed to eliminate.

## 4. Worker model

The worker is the executor. v0.2 §12 (`aigarth-cloud-evolution-pep-v0.2.md:395-413`) is the source of truth. The build stream writes the Zod validator for the registration manifest; the persisted row in `workers` is the active state.

```ts
// services/work/src/types/worker-manifest.ts
// ADR 006 — Worker Manifest (v0.2 §12)
{
  worker_id: "wrk_<ulid>",                  // service-issued at registration
  kind: "local" | "remote" | "oc-processor" | "neuraxon" | "human-via-oracle",
  capabilities: {
    cpu_cores: 8,                            // 1 <= n <= 1024
    memory_gb: 32,                           // 1 <= n <= 1024
    gpu: "none" | "rtx_4090" | "h100" | "any",
    algorithms: ["trinary_classifier", "dft_relaxation", "awork_1", ...],
                                            // must be a subset of work_algorithms.name
    runtime: "docker" | "wasm" | "native",  // v1: docker only
    location: "us-east-1",                   // freeform; scheduler uses for locality
    reputation: 0.97,                        // rolling 30d; initialized to 0.5
    disputes: 0                             // unresolved; decay-on-fail
  },
  status: "active" | "suspended" | "offline",
  last_heartbeat_at: <iso>                  // server-set, never client-set
}
```

**Lifecycle (PEP §12, `aigarth-cloud-evolution-pep-v0.2.md:417-425`):**

| Event | Trigger | Server action | Authorized by |
|---|---|---|---|
| **Join** | `POST /v1/work/workers` with signed manifest | Insert row, validate container signature, return `worker_id` | Public (signed manifest is the auth) |
| **Heartbeat** | `POST /v1/work/workers/:worker_id/heartbeat` every 5s | Update `last_heartbeat_at`; on miss > 30s → `offline` | `worker_id` (HMAC) |
| **Lease** | Scheduler assigns a 30s lease on work item assignment | Extend on heartbeat; on expiry → return work item to queue | Server (scheduler) |
| **Result submission** | `POST /v1/work/items/:work_id/result` | Insert into `work_results`; route to verifier | `worker_id` (HMAC) |
| **Dispute** | `POST /v1/work/items/:work_id/dispute` (any party) | `work_items.status = "disputed"`; pause credit settlement | Public (the dispute is the auth) |
| **Reputation decay** | Failed replication, missed challenge, dispute lost | Decay rolling-30d score; below 0.5 → `suspended` | Server (verifier) |
| **Resume** | `POST /v1/work/workers/:worker_id/heartbeat` (after `offline` ≤ 1h) | `status = "active"`, `last_heartbeat_at` reset | `worker_id` (HMAC) |

**Three invariants the build stream must enforce (DB + application):**

1. **`status = "suspended"` cannot be cleared by a heartbeat.** A suspended worker must re-register (`POST /v1/work/workers`) with a new `worker_id`. The reasoning: suspension is a *reputation* event, not a *connectivity* event; clearing it on a heartbeat would erase the trust consequence.
2. **`kind = "neuraxon"` is reserved but rejected at registration in v1.** The build stream must reject `POST /v1/work/workers` with `kind = "neuraxon"` until Phase 31 ships the Neuraxon runtime (per the PEP §13 verification table). Same for `kind = "oc-processor"` (Phase 29) and `kind = "human-via-oracle"` (Phase 27.D). Reject with 400 and a clear "tier not yet available" error.
3. **`reputation` is server-computed, not client-supplied.** The registration manifest includes a `reputation` field for *informational* purposes (a worker coming from a federated deployment may carry reputation), but the server overwrites it on insert with `0.5` for new workers. A client that tries to register with `reputation = 0.99` will get a warning logged and the value reset.

**First worker type (Phase 27.A):** `packages/worker-local/`, a Python daemon that:
- Polls the work queue via `GET /v1/work/items?status=running&worker_id=...` (note: this requires a new filter; see §12 OQ)
- Downloads the payload from MinIO via the existing `services/dataset` S3 pattern
- Runs the algorithm container
- Uploads the result, signs the response
- Heartbeats every 5s

The container is signed at registration; the worker is not allowed to run unsigned code (PEP §12, `aigarth-cloud-evolution-pep-v0.2.md:425`). The build stream's signature verification is an Open Question (§12).

## 5. Scheduler

The scheduler is the assignment engine. v0.2 §12 (`aigarth-cloud-evolution-pep-v0.2.md:415`) and §14 (`aigarth-cloud-evolution-pep-v0.2.md:451-473`) are the source of truth. v1's first implementation is *conservative* on purpose — the PEP is explicit that the v1 scheduler "earns the right to add complexity" (per `aigarth-cloud-evolution-pep-v0.2.md:479`).

**Scoring function (v1):**

```
π(T, W) = score(work_item T, worker W)
        = capability_match(T, W)              # boolean; hard filter if false
        + FIFO_age_bonus(T)                    # older queued items get a small boost
        + priority_boost(T)                    # if T.priority is set in v1.1; else 0
        - per_worker_concurrency_load(W)       # W's currently-claimed items (cap: 2)
        - worker_reputation_floor(W)           # below 0.5 → excluded entirely
        - locality_penalty(W)                  # cross-region adds latency
```

**Five hard filters (a worker that fails any of these is ineligible for the work item):**

1. **Capability match.** `W.capabilities.algorithms ⊇ T.algorithm.name` AND `W.capabilities.gpu` satisfies `T.requirements.gpu` (e.g., `T.gpu = "required"` cannot be served by `W.gpu = "none"`).
2. **Resource fit.** `W.capabilities.cpu_cores >= T.requirements.cpu_cores` AND `W.capabilities.memory_gb >= T.requirements.memory_gb`.
3. **Status.** `W.status = "active"` (suspended and offline are excluded).
4. **Reputation.** `W.capabilities.reputation >= 0.5` (the floor from §4).
5. **Concurrency cap.** `W's currently-claimed items < WORKER_DEFAULT_CONCURRENCY_CAP` (default 2, per PEP §12, `aigarth-cloud-evolution-pep-v0.2.md:415`).

**Lease semantics (v1):**

- **Assignment:** when the scheduler picks a worker, it inserts a `work_results` row with `claimed_by = W.worker_id`, `lease_expires_at = now + 30s`, `status = "claimed"`. The `work_items.status` flips to `running`.
- **Extension:** each heartbeat extends the lease by 30s. A worker that heartbeats every 5s therefore always has a fresh lease.
- **Expiry:** the assignment worker (`services/work/src/workers/assignment.ts`, polled every 5s, per PEP §33 Task 8, `aigarth-cloud-evolution-pep-v0.2.md:1220`) runs a `SELECT * FROM work_results WHERE lease_expires_at < now() AND status = "claimed"` and returns the work item to the queue: `work_items.status = "queued"`, `work_results.status = "expired"`. The worker's reputation takes a small hit (PEP §15 V02).
- **Result submission:** `POST /v1/work/items/:work_id/result` (worker-signed) creates a new `work_results` row with `status = "submitted"`, transitioning the work item into the verifier's queue.
- **Idempotency:** a worker that double-submits the same `result_hash` within 60s gets the original `work_results.id` back, not a duplicate row.

**Priority preemption (Phase 27.B, PEP §14, `aigarth-cloud-evolution-pep-v0.2.md:464`):** v1 does NOT preempt running items on a new higher-priority submission. Preemption requires a work item to be *cancellable mid-run*, which is out of scope for the v1 envelope. The build stream must document this; the orchestrator can raise a follow-up ADR.

**Three scheduler invariants the build stream must enforce:**

1. **The scheduler never assigns a work item to a worker with `status = "offline"` even if `last_heartbeat_at` is recent.** A worker can be marked `offline` by the verifier (e.g., three consecutive expired leases); a recent heartbeat from a worker that the server has marked `offline` is *not enough* to clear the status.
2. **The scheduler never assigns a work item to a worker that registered the same `kind` as the work item's `payer.kind`** (when the payer is an Organism, not a user). v0.2 §5 (`aigarth-cloud-evolution-pep-v0.2.md:155-156`) lists `Worker` and `Organism` as distinct primitives; the scheduler must not allow a worker to "self-execute" a work item it produced. This is a closed-loop integrity check.
3. **The scheduler is single-leader per Work Runtime deployment.** The Phase 27 build does not implement distributed consensus on scheduler state. The assignment worker uses a `SELECT ... FOR UPDATE SKIP LOCKED` style of claim to prevent two scheduler instances from assigning the same work item to two workers (the same v2-upgrade-path pattern noted in `services/training/src/workers/job-runner.ts:11-13`).

## 6. Verification

Verification is what makes a work item a *useful* work item, not just an executed one. v0.2 §15 (`aigarth-cloud-evolution-pep-v0.2.md:479-498`) is the source of truth. The v1 stack is the **minimal viable verification** that catches the obvious attacks; the four deferred mechanisms are explicitly named so the build stream does not half-implement them.

**v1 stack (4 mechanisms, all in MVP):**

| Mechanism | Cost | Catches | Default |
|---|---|---|---|
| **Replication (3/3)** | 3× compute | One malicious worker | All non-deterministic work |
| **Deterministic re-run** | 1× verifier compute | "Did not run" attacks on deterministic algorithms | All `algorithm.deterministic = true` work |
| **Challenge (1/100)** | 1/100 of normal compute | "Did not run" / "ran on wrong payload" | Always-on; the challenger (`services/work/src/workers/challenger.ts`) issues known-answer work items to random workers |
| **Result commitments (commit-reveal)** | 2 round-trips | Late-stage result tampering | All non-deterministic work; the worker commits a `payload_hash` at claim time, reveals the result at submission |

**Reputation** (rolling 30d, per PEP §12, `aigarth-cloud-evolution-pep-v0.2.md:423`) is the *fifth* mechanism but is not a "verification" mechanism per se — it is the *consequence* of failed verification. It is stored on `workers.capabilities.reputation`, decays on every failed replication or missed challenge, and gates eligibility (the 0.5 floor from §5).

**Three deferred mechanisms (explicitly out of scope for v1):**

1. **TEE attestation (SGX/SEV)** — Phase 30+. Per PEP §15 (`aigarth-cloud-evolution-pep-v0.2.md:488`): *"Defer until Aigarth hardware ships."* The envelope's `verification.method = "tee"` is reserved in the enum but the build stream rejects it at submit with 400.
2. **ZK proofs (zkML)** — Research only. Per PEP §15 (`aigarth-cloud-evolution-pep-v0.2.md:489`): *"Not MVP."* Same treatment as TEE.
3. **Staking + slashing** — Phase 30+. Per PEP §15 (`aigarth-cloud-evolution-pep-v0.2.md:490`): *"Requires Qubic-side stake."* Same treatment.

The three adversarial test cases in the PEP §15 V01-V03 (per `aigarth-cloud-evolution-pep-v0.2.md:492-497`) are the *minimum bar* for the verifier build. The build stream must ship tests for:

- **V01 — Honest:** three workers, deterministic algorithm. All three produce the same `result_hash`. Verifier accepts (`work_items.status = "verified"`, `result.replicas_agreed = "3/3"`).
- **V02 — Malicious:** one of three workers returns a fake plausible result. Verifier rejects (2/3 majority). The malicious worker's reputation decays by a configurable amount (`REPUTATION_DECAY_MALICIOUS`).
- **V03 — Byzantine:** all three workers return different results. Verifier marks `work_items.status = "disputed"`. The escalation path (who decides who is right) is an Open Question (§12).

**Two verifier invariants:**

1. **A `verified` work item can never be re-opened.** Once `work_items.status = "verified"`, the verifier's `work_audit` row is the immutable record. The build stream must reject any `POST /v1/work/items/:work_id/dispute` on a `verified` item. Disputes are for `running` or `failed` items only.
2. **A `disputed` work item is held in escrow until resolution.** The accountant (§7) does not emit a `WorkUsageEvent` for a disputed item. The build stream must check `work_items.status` before billing.

The v1 stack is **not** a final answer. The platform's stance on when to upgrade from replication+challenge+reputation to TEE/ZK/staking is an Open Question (§12 BLOCKER 1) and is intentionally left to a future ADR — the deferred mechanisms all require external infrastructure (Aigarth hardware for TEE, zkML provers for ZK, Qubic-side stake contracts for staking) that does not exist in Phase 27.

## 7. Accounting

The accountant is the credit / billing bridge. v0.2 §15's "result is reward" is the loop; the accountant closes it by writing to `services/billing` and (in the future) to `services/qubic`. v0.2 §27 (`aigarth-cloud-evolution-pep-v0.2.md:868-870`) is the economics context: *"first establish UsefulWork → MeasurableValue. Then investigate Value → Reward → ComputeMarket."* v1 ships the MeasurableValue ledger; the ComputeMarket is Phase 30+.

**Two ledgers the build stream must maintain in `services/work`:**

1. **Per-work-item ledger** (`work_audit` table, PEP §33 Task 7, `aigarth-cloud-evolution-pep-v0.2.md:1202`). Append-only; one row per state transition. Source of truth for "did this work item settle, and at what cost?" Mirrors the audit pattern at `services/compute/src/services/jobs.ts:189-199` (`logActivity` on every transition).
2. **Per-worker ledger** (`worker_challenges` table + reputation decay rows). Append-only; one row per verification event (replication pass/fail, challenge pass/fail, dispute outcome). Source of truth for "is this worker trustworthy?"

**The billing bridge (`WorkUsageEvent`):**

The build stream writes a Zod-validated `WorkUsageEvent` that mirrors `services/billing/src/services/tissueUsage.ts:24-35`:

```ts
// services/work/src/services/accountant.ts
// ADR 006 — WorkUsageEvent (mirrors TissueUsageEvent at services/billing/src/services/tissueUsage.ts:24-35)
export const WorkUsageEventSchema = z.object({
  userId: z.string().uuid(),                              // work_items.payer (resolved to user)
  orgId: z.string().uuid().optional(),                    // not in v1; future
  workId: z.string().regex(/^wki_[0-9A-HJKMNP-TV-Z]{26}$/), // ULID
  workType: z.enum(["materials_simulation", "video_evaluation", "trinary_decision", "dft_relaxation", "awork_1"]),
  algorithmVersion: z.string().regex(/^v\d+\.\d+\.\d+$/),
  costQubic: z.string().regex(/^\d+$/),
  replicas: z.number().int().min(1).max(5),
  verificationMethod: z.enum(["replication", "challenge", "deterministic"]),
  replicasAgreed: z.string().regex(/^\d+\/\d+$/),         // e.g., "3/3"
  workerId: z.string().regex(/^wrk_[0-9A-HJKMNP-TV-Z]{26}$/),
  requestId: z.string().min(1).max(120),                  // idempotency key
  occurredAt: z.coerce.date().optional(),
});
export type WorkUsageEvent = z.infer<typeof WorkUsageEventSchema>;
```

The accountant calls `services/billing`'s equivalent of `recordTissueUsage(event: TissueUsageEvent)` (line 45 of `services/billing/src/services/tissueUsage.ts`) on `work_items.status = "verified"` ONLY. Disputed and failed items are *not* billed (the worker may or may not be paid for partial work; that decision is Phase 30+).

**Three accountant invariants:**

1. **The `WorkUsageEvent` is emitted exactly once per work item.** The accountant uses an idempotency key (`work_audit.id`) to prevent double-billing on retry. The build stream's retry path (e.g., after a NATS disconnect) must use the same `requestId`.
2. **The `costQubic` value is computed at submit time, not at verify time.** This is the same pattern as `services/compute/src/services/jobs.ts:56-59` (`estimateJobCost`) — credit pre-authorization at submit, settlement at completion. A spike in replication cost (e.g., a worker that had to redo the work) does not retroactively change the cost. The v1 cost formula is `base_cost + replicas * replica_cost`; the build stream must document both terms.
3. **The accountant is the only path from `services/work` to `services/billing`.** No route in `services/work` may POST a `WorkUsageEvent` directly; the call must go through `accountant.ts`. This is the same gate that `services/tissue`'s `billingHook.ts` enforces (a single function the routes call, not a direct HTTP).

**What this ADR does NOT decide about accounting:**
- The exact QUBIC settlement path (escrow against an existing `services/compute` reservation, or a new escrow in `services/work`). v0.2 §11 (`aigarth-cloud-evolution-pep-v0.2.md:369-371`) names the `reward` block but the settlement is in §14's deferred budget work. This is an Open Question (§12 NON-BLOCKER).
- AIGARTH token integration (Phase 30+). v0.2 §3 (`aigarth-cloud-evolution-pep-v0.2.md:94`) confirms v1 is QUBIC-only.

## 8. Routes

The thirteen Work Runtime routes (PEP §31, `aigarth-cloud-evolution-pep-v0.2.md:1004-1016`) are the public surface. The build stream implements the 13 listed below; the brief's "9" is a stale count from an earlier PEP draft. The §31 list is the source of truth.

```
POST   /v1/work/items                              # submit a work item
GET    /v1/work/items                              # list (filter: status, type, payer, since)
GET    /v1/work/items/:work_id                     # read
POST   /v1/work/items/:work_id/cancel              # cancel a queued item (issuer only)
POST   /v1/work/items/:work_id/result              # worker submits a result (HMAC-signed)
POST   /v1/work/items/:work_id/dispute             # any party disputes; status -> "disputed"
POST   /v1/work/workers                            # register a worker (signed manifest)
GET    /v1/work/workers                            # list (filter: status, kind, location)
POST   /v1/work/workers/:worker_id/heartbeat       # extend lease + liveness
GET    /v1/work/workers/:worker_id/jobs            # list work items currently assigned to W
POST   /v1/work/workers/:worker_id/results         # batch result submission (for replication roll-up)
GET    /v1/work/algorithms                         # list registered algorithms
POST   /v1/work/algorithms                         # register a new algorithm (admin-only)
```

**Plus one internal route (not in the public §31 list, but required by Task 8):**

```
POST   /v1/internal/work/items/:work_id/assign     # manual assignment for testing
                                                  # (PEP §33 Task 8, aigarth-cloud-evolution-pep-v0.2.md:1221)
                                                  # requires INTERNAL_TOKEN per Phase 18 closeout pattern
```

**Route → service function map (build stream contract):**

| Route | Service function | Notes |
|---|---|---|
| `POST /v1/work/items` | `submitWorkItem(input: SubmitWorkItemInput)` in `services/work/src/services/items.ts` | Validates envelope (§3 invariants); emits `aigarth.work.item.submitted` NATS event |
| `GET /v1/work/items` | `listWorkItems(filter: ListWorkItemsFilter)` | Cursor-paginated; default limit 50, max 200 (mirrors `services/compute/src/services/jobs.ts:266-279`) |
| `GET /v1/work/items/:work_id` | `getWorkItem(workId: string)` | Returns envelope + result + audit tail |
| `POST /v1/work/items/:work_id/cancel` | `cancelWorkItem(workId: string, userId: string)` | Issuer-only; 409 if `status != "queued"` |
| `POST /v1/work/items/:work_id/result` | `submitWorkResult(workId, workerId, result)` | Verifier-enqueued; HMAC-signed worker manifest required |
| `POST /v1/work/items/:work_id/dispute` | `disputeWorkItem(workId, partyId, reason)` | Any party; pauses settlement; routes to verifier queue |
| `POST /v1/work/workers` | `registerWorker(manifest: WorkerManifest)` | Validates container signature (§12 OQ); rejects `kind` not in {`local`} for v1 |
| `GET /v1/work/workers` | `listWorkers(filter: ListWorkersFilter)` | Returns `last_heartbeat_at`, not just `status` |
| `POST /v1/work/workers/:worker_id/heartbeat` | `heartbeat(workerId)` | Idempotent; extends lease on all claimed items |
| `GET /v1/work/workers/:worker_id/jobs` | `listWorkerJobs(workerId)` | Returns work items where `claimed_by = workerId` |
| `POST /v1/work/workers/:worker_id/results` | `submitWorkResultsBatch(workerId, results[])` | For replication roll-up; each result routes to verifier individually |
| `GET /v1/work/algorithms` | `listAlgorithms()` | Public; returns name, version, container, deterministic, supported verification methods |
| `POST /v1/work/algorithms` | `registerAlgorithm(input: RegisterAlgorithmInput)` | Admin-only (issuer must have `admin:work:write` scope per `services/identity`); not exposed to regular users |

**Three route-layer invariants:**

1. **No route exposes `work_audit` directly.** The `GET /v1/work/items/:work_id` response includes a `result` block with a 10-row audit tail, but the full `work_audit` table is service-internal. Consumers that need the full history read it via `services/billing`'s usage endpoint, which aggregates from the event log.
2. **The cancel route is the only mutating route on a `running` item that the issuer can call.** The worker cannot cancel; only the issuer (or an admin) can. A worker that wants to abandon a work item lets the lease expire (§5). This asymmetry is intentional: a worker that "cancels" an assigned item is a *failed* worker, not a cancelled one.
3. **The `INTERNAL_TOKEN` pattern (Phase 18 closeout, per `AGENTS.md`) applies to `/v1/internal/work/*` and `/v1/internal/work/items/:work_id/assign`.** Service-to-service calls (e.g., the `services/work` assignment worker calling back into itself for re-assignment) must carry the bearer token whose value matches `INTERNAL_TOKEN` on the target. The dev default is `internal_dev_token_change_me`; both `services/identity` and `services/economy` set it, and `services/work` must set it too.

## 9. Consequences (positive)

1. **The platform gains a generalised work abstraction.** Three fundamentally different workloads (neural trinary decision, materials DFT relaxation, video consistency scoring) now share one envelope, one scheduler, one verifier, and one accounting path (per the G01 test in PEP §19, `aigarth-cloud-evolution-pep-v0.2.md:382-388`). The runtime is the smallest possible substrate for the "experience → learning → hypothesis → compute → verification → adaptation" loop (`aigarth-cloud-evolution-pep-v0.2.md:68`).

2. **The Organism primitive becomes executable.** ADR 005 ships the schema and the routes but leaves the loop's "compute" half unspecified. The Work Runtime is the *executor* the Organism calls: `POST /v1/work/items` from a tissue's actuator (PEP §5, `aigarth-cloud-evolution-pep-v0.2.md:149`) emits a work item, and the Organism's `compute_consumed` JSONB (ADR 005 §3) is updated by the Work Runtime as items settle. Without this ADR, the Organism is decorative.

3. **The verification stack is honest about its limits.** The v1 four-mechanism stack (replication + challenge + reputation + result commitments) catches the obvious attacks and explicitly defers TEE/ZK/staking (PEP §15, `aigarth-cloud-evolution-pep-v0.2.md:488-490`). A consumer that reads `work_items.status = "verified"` knows exactly what level of assurance that label carries. Future upgrades have named triggers (§12 BLOCKER 1).

4. **The four-tier compute model gives the platform a clean forward path.** Tiers 1-4 are named (local → federated → OC → multi-workload) and the `workers.kind` enum lists all five v0.2 §12 values. Phase 28 ships Tier 2; Phase 29 ships Tier 3; Phase 30+ ships Tier 4. The schema, routes, and worker manifest are forward-compatible; no Phase 28 build has to migrate Phase 27's tables.

5. **The accountant is the single bridge to `services/billing`.** Mirroring the `TissueUsageEvent` pattern (`services/billing/src/services/tissueUsage.ts:24-58`), the `WorkUsageEvent` is the only path from `services/work` to `services/billing`. A future change to billing aggregation (e.g., rolling up tissue + work usage into a single invoice) touches one event schema, not two services' worth of routes.

## 10. Consequences (negative)

1. **`services/training` will treat work items as training jobs.** The training orchestrator's lease-claim pattern at `services/training/src/workers/job-runner.ts:64-86` (poll `claimNextQueuedJob` → `runJob` → auto-publish) looks superficially identical to the Work Runtime's assignment worker. A future maintainer wiring training's compute bridge to `services/work` will pass a `training_recipe` payload to `POST /v1/work/items` and try to write the result via `POST /v1/work/items/:work_id/result` directly — bypassing the scheduler. The result: a `work_items` row with `algorithm.name = "trinary_classifier"` and no worker assigned, no lease, no replication, and no reputation impact. The training job will be reported "complete" while no work has been done. The fix is a hard guardrail in `services/training/src/services/computeBridge.ts`: any call from the training bridge to `services/work` must go through the scheduler's queue, not direct result submission. The build stream must add a vitest case that exercises this misread path (a `runTrainingJob` call that writes a work item result directly to `/v1/work/items/:work_id/result` without an assignment) and asserts the route returns 409.

2. **`services/compute` reservations and `services/work` reward escrow are not the same money.** The existing reservation engine at `services/compute/src/services/jobs.ts:144-152` pre-authorizes credit against `reservations.usedQubic` for compute jobs. A consumer who tries to "pay for a work item" by passing a `reservationId` to `POST /v1/work/items` will not get any credit hold — the Work Runtime has its own settlement flow (§7), and routing reservations through it will silently bypass the credit check. The two ledgers are not interchangeable. The fix is a 400 at the route layer: `POST /v1/work/items` must reject any `reservationId` field with `"reservationId is not a valid field for work items; use reward.payer"`. The build stream must add a test that submits an item with a `reservationId` and asserts the 400.

3. **`services/training`'s auto-retrain consumer will misread `work_items.status = "verified"` as a "model retrain needed" signal.** The retrain cron at `services/training/src/workers/retrain-cron.ts:22-46` polls `runRetrainScan()` on `/v1/internal/anns/retrain-scan` (line 30) every `RETRAIN_SCAN_INTERVAL_MS` and triggers retraining on degraded model performance. A future maintainer adding a subscription on `work_items.status = "verified"` to the same scan will mistake every verified work item (the normal happy path) for a "the model got worse" signal and start firing retrain loops on every Organism experiment. The result: a retrain storm that thrashes the existing 5-recipe training queue. The fix is a hard guardrail in `services/training/src/services/retrainTrigger.ts` (or wherever `runRetrainScan` reads its input): the scan must check the `source` of each row and skip any source that maps to the `work_items` table. The build stream must add a test that calls `runRetrainScan` with a payload that includes a `verified` work item and asserts no retrain job is enqueued.

4. **The Work Item's `status` enum overlaps with `services/compute`'s `jobs.status`.** Both have `queued | running | completed | failed` shapes (compare `services/compute/src/services/jobs.ts:3-6` with the envelope status at §3). A dashboard that reads both tables and renders a unified "tasks" view will conflate them, mixing per-user compute jobs (`services/compute.jobs.userId`-bound, see line 133) with per-Organism work items (`services/work.work_items.payer`-bound). The two ledgers are not interchangeable: a compute job's `creditUsedQubic` is a single QUBIC value; a work item's `costQubic` is a `base + replicas * replica` expression. The fix is a hard namespace in any shared dashboard view: a "compute job" and a "work item" are different UI objects, and a future "tasks" page must distinguish them, not unify them. The build stream must document this in the dashboard's `/services` page (`apps/dashboard`) when adding the work-runtime ping target.

5. **The verification v1 stack looks like a final answer but is not.** A future consumer (especially an external partner) that sees `work_items.status = "verified"` will assume the result is trust-rooted. It is not — the trust root is the platform's own deployment, with 3-worker replication catching only one attacker at a time (PEP §15 V02, `aigarth-cloud-evolution-pep-v0.2.md:496`). The "verified" label is a *probabilistic* assertion under the v1 stack, not a cryptographic one. A partner integration that wires a Qubic OC processor into a downstream contract (Phase 29, Tier 3) will be mis-marketing the v1 guarantees. The fix is a permanent footer in the Proof Lab and on every public "verified work item" view: *"v1 verification: 3-worker replication + 1/100 challenge + rolling 30d reputation. Not ZK-backed. See ADR 006 §6."* The build stream must add the footer to the public surface in the same commit that ships `POST /v1/work/items`.

6. **The work-item envelope's `algorithm.container` is a freeform string with no signature pinning in the v1 wire.** v0.2 §12 (`aigarth-cloud-evolution-pep-v0.2.md:425`) says "the container is signed at registration; the worker is not allowed to run unsigned code" but the spec for *how* the signature is verified at *job-assignment time* is not in the PEP. A worker that registers a `trinary_classifier` container with a valid signature but then runs a different container at execution time (because the runtime doesn't pin by hash) will produce a "verified" result for arbitrary work. The v1 reputation decay catches this slowly, after damage is done. The fix is a `container_hash` field added to the envelope at assignment time and a worker-side runtime hook that re-validates the hash before container start. This is partially in the PEP §12 OQ and is fully addressed in §12 OQ 2 below.

## 11. Alternatives considered

**a) Extend `services/compute` to host the Work Runtime.** Rejected. `services/compute` is the *reservation engine*: it pre-authorizes credit against `reservations.usedQubic` (`services/compute/src/services/jobs.ts:179-187`), refunds on cancel (lines 311-319), and broadcasts to Qubic (the `broadcastJob` function at line 222, even in stub mode). It is not a *general work scheduler* — its `jobs` table is per-user (line 133: `eq(jobs.userId, userId)`) and its 4-value `type` enum (`contract_call | training | inference | general`, line 39) is too coarse to express the Work Item envelope's algorithm + verification + reward shape. Adding `work_items` to `services/compute` would require widening the `type` enum to a freeform string (breaking the existing constraint) AND adding a per-algorithm container registry AND a per-worker reputation model AND replication logic AND a challenge worker. The reservation engine is the wrong shape for any of those. The PEP §30 (`aigarth-cloud-evolution-pep-v0.2.md:947`) is explicit: *"All Work Runtime tables live in the new `services/work`."* Phase 27 ships a new service, not a widening of an existing one.

**b) Extend `services/training` to host the Work Runtime.** Rejected. `services/training` is a *specific recipe executor*: its 5 recipes (`mlp_classifier`, `cnn_classifier`, `text_classifier`, `gradient_boost_tabular`, `trinary_classifier`, per the project `AGENTS.md`) are training-shaped, its compute bridge (per `services/training/src/workers/job-runner.ts:16-21`) is a single-purpose `runTrainingJob` call, and its outputs are ANNs (it auto-publishes to `services/ann` via `publishTrainingResult` at `services/training/src/workers/job-runner.ts:101-114`). The Work Item envelope's three test workloads (neural, materials DFT, video consistency, per PEP §11 G01) include a DFT relaxation — which is not a training job. Conflating training with the Work Runtime would force the training service to know about DFT and video consistency, which it does not and should not. The training service is a *consumer* of the Work Runtime (Phase 19C.6: `services/training` calls `services/compute` via its compute bridge; Phase 27 can route through `services/work` instead), not a host for it.

**c) Build the Work Runtime as a sidecar inside `services/tissue`.** Rejected. `services/tissue` is a *stateless per-call contract*: a tissue fans out to ANNs, combines their decisions with one of five consensus policies (`majority`, `unanimous`, `any`, `veto_aware`, `short_circuit`, per the project `AGENTS.md`), returns a signed `IntentEnvelope`, and the call ends. An Organism is stateful across experiences (ADR 005 §1); a Work Item is *also* stateful across its lifecycle (`queued → running → verified | failed | disputed`). Co-locating a stateful, replicated, reputation-scored work-execution engine inside a stateless per-call decision engine would either (i) force the Tissue service to track per-work-item state and break the stateless invariant that downstream consumers rely on, or (ii) require every Work Item operation to be a one-shot Tissue call, which makes the lease, the replication, the challenge worker, and the per-worker reputation impossible to model. The two services have fundamentally different state shapes; the right move is a new service, not a sidecar.

## 12. Open questions

Decisions the build stream must make before or during Phase 27 / Wave 3 implementation. Marked `BLOCKER` (must be resolved before the related code can ship) or `NON-BLOCKER` (can ship with a documented default; resolved in a follow-up ADR).

1. **`BLOCKER` — Verification upgrade path from v1 (replication + challenge + reputation) to TEE / ZK / staking.** v0.2 §15 (`aigarth-cloud-evolution-pep-v0.2.md:481-490`) defers all three to Phase 30+ or "research", but does not name the *trigger* for upgrading. Candidate triggers:
   - **Volume trigger:** once `count(work_items where status = 'verified')` exceeds N, upgrade by adding a TEE attestation requirement to the envelope.
   - **Value trigger:** once `sum(work_items.cost_qubic) over rolling 30d` exceeds M QUBIC, upgrade.
   - **Adversarial trigger:** once `count(work_items where status = 'disputed') / count(work_items where status = 'verified')` exceeds ratio R, upgrade.
   - **Decision trigger:** the Aigarth Cloud team votes to upgrade at a specific epoch, document-gated.

   The build stream must pick a default (volume trigger is the simplest) and document the function. The decision belongs in this ADR, not the PEP, because it changes the *guarantee* the platform is making under the "verified" label — and that guarantee is the contract a partner integration relies on. Deferred mechanisms in PEP §15 are research goals; the upgrade *path* is a product commitment.

2. **`BLOCKER` — Dispute resolution flow when 3 replicas disagree (Byzantine case, PEP §15 V03, `aigarth-cloud-evolution-pep-v0.2.md:498`).** The PEP says *"verifier marks `disputed`, escalates"* but the escalation mechanism is unnamed. Candidate resolutions:
   - **Deterministic re-run on a high-reputation worker:** the challenger issues a known-answer re-run to a worker with `reputation > 0.9`; the re-run is binding.
   - **Manual admin review:** `POST /v1/internal/work/items/:work_id/resolve` with `INTERNAL_TOKEN`, an admin picks the winning result, the others' workers take a reputation hit.
   - **Refund to payer:** the work item is `failed`; the `WorkUsageEvent` is not emitted; the payer gets the credit back. This is the cheapest resolution but it punishes honest workers who happened to disagree with two malicious ones.

   The build stream must pick one (or a hybrid) and document the flow in the dispute route. The decision is BLOCKER because without it, a `disputed` work item is permanently stuck — no consumer can rely on the platform to ever resolve it.

3. **`NON-BLOCKER` — Default per-worker concurrency cap value (currently 2 from PEP §12, `aigarth-cloud-evolution-pep-v0.2.md:415`).** v0.2 §12 names 2 as the v1 default; the build stream should make this a config value (`WORKER_DEFAULT_CONCURRENCY_CAP`) so it can be tuned per-deployment (a 64-core worker can run more concurrent items than a 4-core worker; the cap should scale). The hard cap at 5 (from §3 envelope invariant 2) is a *separate* limit; the per-worker cap is a *soft* scheduling limit. v1 can ship with `WORKER_DEFAULT_CONCURRENCY_CAP = 2` and `WORKER_HARD_MAX_CONCURRENCY = 5`; the v1.1 tuning is a config flip, not a code change.

4. **`NON-BLOCKER` — Algorithm container signature scheme.** PEP §12 (`aigarth-cloud-evolution-pep-v0.2.md:425`) says the container is signed at registration but does not pick a scheme. Candidate schemes:
   - **Cosign (Sigstore):** the build stream signs with a project key; the runtime verifies with a public key in `services/identity`. Most modern, but requires a Sigstore deployment.
   - **Notary v2 (Docker Content Trust):** the existing Docker signing primitive. Built into the Docker daemon. Less modern than Sigstore but more portable.
   - **HMAC-SHA-256 keyed on the algorithm registry:** the runtime signs on `registerAlgorithm` and verifies on `submitWorkResult`. Matches the ADR 003 Trinary pattern. Cheapest to ship in v1.

   The build stream should ship with HMAC-SHA-256 (matches ADR 003) and defer Sigstore to v2. The signature is verified at *job-assignment time* (the runtime pins the hash the worker must run) and at *result-submission time* (the runtime confirms the worker ran the pinned hash). This is the fix for negative consequence 6.

5. **`NON-BLOCKER` — Lease duration (currently 30s, heartbeat 5s, miss threshold 30s, all from PEP §12, `aigarth-cloud-evolution-pep-v0.2.md:419-420`).** v0.2 §12 names 30s; the build stream should make this a config value (`WORK_LEASE_DURATION_MS`, `WORK_HEARTBEAT_INTERVAL_MS`, `WORK_OFFLINE_AFTER_MS`) so different deployment profiles (a local single-process worker vs a federated cross-region worker) can tune them. v1 can ship with the PEP defaults; the v1.1 tuning is a config flip, not a code change.

6. **`NON-BLOCKER` — QUBIC settlement path for work items.** v0.2 §11 (`aigarth-cloud-evolution-pep-v0.2.md:369-371`) names `currency = QUBIC` but the settlement (where the QUBIC actually moves) is in §14's deferred budget work. Candidate paths:
   - **Reuse `services/compute` reservations:** the work item's `reward.amount` pre-authorizes against the user's `reservations.usedQubic`; settlement on `verified`. This reuses the existing credit ledger.
   - **New escrow in `services/work`:** a new `work_escrow` table; the work item holds the credit in escrow until verified. Cleaner separation, but a new ledger.
   - **Direct AigarthPool transfer:** the `WorkUsageEvent` triggers an AigarthPool distribution (per `services/aigarthpool`'s 30/60/10 split). Most aligned with the Qubic thesis, but a Phase 20 dependency.

   The build stream should ship with option (a) — reuse the existing `services/compute` reservations — and document the migration path to option (c) for the AigarthPool integration. The decision is NON-BLOCKER because the `WorkUsageEvent` itself (§7) is the immediate contract; the settlement path can change without breaking the event schema.

7. **`NON-BLOCKER` — Worker `kind` enum strictness for v1.** PEP §12 lists five values (`local | remote | oc-processor | neuraxon | human-via-oracle`, `aigarth-cloud-evolution-pep-v0.2.md:399`); v1 only implements `local` (§4 invariant 2). The build stream should reject the other four at registration with a 400, but the rejection message should distinguish "tier not yet available" (for `oc-processor` and `neuraxon`, which are *coming*) from "tier explicitly not supported" (for `human-via-oracle`, which is a Phase 27.D research item with no clear path). The DB enum keeps all five; the route layer is the gate.

---

**Wave 3 acceptance gate (Build Tasks 7-10, per `docs/evolution/CHECKPOINT-2026-08-12.md:165-188` and PEP §33, `aigarth-cloud-evolution-pep-v0.2.md:1193-1252`):** `pnpm --filter @aigarth/work typecheck`, `pnpm --filter @aigarth/work test`, `pnpm --filter @aigarth/work db:migrate` on a fresh DB. The 13 routes in §8 are exercised with curl or Vitest HTTP tests, not just typecheck. The 60 vitest cases across the four tasks (15 + 20 + 25, per `aigarth-cloud-evolution-pep-v0.2.md:1211`, `:1224`, `:1238`) all pass. The `WorkUsageEvent` is observed end-to-end: a submitted work item → scheduler assignment → worker result → verifier accept → `recordWorkUsage` call to `services/billing`. A FAIL on any check returns the deliverable to its producer with the specific gap named. A PASS is reported back with `VERDICT: PASS` + evidence.
