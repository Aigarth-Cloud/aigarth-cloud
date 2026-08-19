# Aigarth Cloud Evolution PEP

## From Neural Networks to Evolving Useful Intelligence

**Document type:** Product Evolution Proposal (PEP)
**Status:** Draft v0.1 — pending architecture review
**Date:** 2026-08-10
**Author:** Aigarth Cloud Architecture, Research, Product Evolution & Engineering Team
**Reviewers:** Engineering, Product, Founders
**Builds on:** Phase 17 (Material Science), Phase 18 (Trinary Intelligence Layer), Phase 19 (Datasets & Training Orchestration), Phase 20-24 (Pool / Snap / Treasury / Presale), Neuraxon v2.0 paper, Qubic public roadmap (Feb-Aug 2026)

---

## 0. Reading order

This is a 27-section engineering document. Most readers should skim the **Executive Summary (§1)**, the **Current Architecture Audit (§2)**, the **Aigarth Thesis (§28)**, and the **First 10 Engineering Tasks (§29)**, then come back for the rest. ADRs and code reviews should reference the **Risk Register (§24)** and **Kill List (§25)**.

A copy of this document is registered with the dashboard command centre at `apps/dashboard/src/lib/repo.ts` via `register-evolution-pep.ts`. The doc lives at the canonical path `docs/proposals/aigarth-cloud-evolution-pep.md`.

---

## 1. Executive Summary

The preceding strategy conversation is **partially correct, partially misaligned with reality, and partially already executed**. The good parts — Neuraxon as a neural substrate, Qubic OC as outbound compute, BPP-9000 as a useful-work precedent, the "intelligent tissue" framing, a materials-science flagship — are real. The misalignments matter:

| Claim in the conversation | Reality on 2026-08-10 | Severity |
|---|---|---|
| "Aigarth has no generalized learning architecture yet" | Aigarth has **Trinary Intelligence Layer** (Phase 18) shipped, with 222 tests, 100% coverage on the trinary package, and a real `services/tissue` runtime on port 7008 | High — overstates the gap |
| "Build a 'Tissue' primitive" | A tissue primitive already exists. The Phase 18 launch is live in dev + staging. | High — already built |
| "Use Neuraxon 2.0 as the substrate" | Neuraxon 2.0 is **not yet integrated** in any Aigarth service. Per ADR 003: "Neuraxon v2.0 is a research paper (not deployed), and Aigarth is described in §8 of the paper as a separate framework that would be hybridized with Neuraxons in a 'Neuraxon-ITU.' That hybridization has not happened." | Critical — factually wrong |
| "Qubic OC is the muscles / external organs" | OC is **outbound**: Qubic smart contracts send authorized instructions to external systems, which execute and return signed results. Aigarth would be a *target* of OC, not a provider of mining compute. The 451/676 computor signature threshold, not a marketplace, is the trust model. | High — flips the architecture |
| "BPP-9000 is a case study of heterogeneous mining" | BPP-9000 is the **current** uPoW algorithm (live Epoch 224, late July 2026). It is one algorithm, not a heterogeneous system. Qubic's design is "one algorithm at a time + DOGE (Scrypt) parallel." | High — misframes the precedent |
| "Materials Science is a new use case" | Phase 17 (Material Science Intelligence ANN) shipped Phase 0 on 2026-08-02: architecture eval, blog article, dashboard `/material-science` page, marketing page, tracker. The 8-ANN coordinator pattern is already designed. | High — already done |
| "Build a 'Universal Useful Work Protocol'" | This is **genuinely novel research** and is **not** what Qubic provides today. Building it would be an Aigarth-side R&D project, not a Qubic integration. | Medium — right idea, wrong framing |

The **Aigarth Thesis** (§28) the PEP defends: Aigarth should evolve from "ANN marketplace" to **"platform for growing, evaluating, and deploying useful computational intelligences"** — but the Organism primitive must be **added on top of** the existing Trinary Intelligence Layer, not built from scratch. Neuraxon integration is a **medium-term research target, not a now-dependency**. Qubic OC is an **outbound-invocation model, not a compute marketplace**. BPP-9000 is **one workload, not a paradigm**.

The first 10 engineering tasks (§29) are concrete, bounded, and can begin immediately. None require Neuraxon, Qubic protocol changes, or a rewrite of the Trinary Intelligence Layer.

---

## 2. Current Architecture Audit

The platform is far more advanced than the conversation thread implies. **Phase 19 is at 92%** and most of what the thread asks for has been *designed* and *partially shipped* under different names.

### 2.1 Service map (verified)

| Port | Service | Phase | Status | Purpose |
|---|---|---|---|---|
| 7001 | identity | 1 | Live | JWT auth, wallets, orgs, MFA, audit |
| 7002 | qubic | 3 + 22 + 23 | Live | Wallet, AigarthPool watcher, governance, Qearn watcher, rate limits, circuit breaker |
| 7003 | compute | 2 | Live | Regions, clusters, reservations, jobs, escrow, qearn-lock, USD price oracle worker |
| 7004 | gateway | 7 + 18C | Live | OpenAI-compatible API; trinary `response_format` opt-in |
| 7005 | billing | 4 | Live | Subscriptions, invoices, payments, credits, tissue usage events |
| 7006 | ann | 5 + 18B + 19D + 20.4 | Live | Registry, versions, marketplace hooks, retrain, trinary `/decide`, AigarthPool stake endpoints, decision outcome tracking, auto-retrain, A/B shadow, predicted-vs-actual |
| 7007 | marketplace | 6 + 18E | Live | Listings, offers, purchases, auctions, tissue listings |
| 7008 | tissue | 18D | Live | Tissue registry, `/v1/tissues/:slug/decide`, 5 consensus policies, licenses, decision history, billing hook, marketplace counter |
| 7009 | dataset | 19B | Live | First-class datasets, schema sniff, public catalog, connectors, SDK resource |
| 7010 | economy | 18 | Live | Qearn watcher, splits, settleRun |
| 7011 | training | 19C | Live | 5 training recipes (incl. trinary_classifier), real LLM invocation, compute bridge (stub+http), SSE progress, auto-publish to ANN |

Plus `services/aigarthpool` (Phase 20) with the QPI contract and TypeScript simulator; `services/economy` is the splits engine.

### 2.2 Package map (verified)

| Package | Purpose | Status |
|---|---|---|
| `@aigarth/sdk` | Typed client SDK (Python, TS, Go, Rust) | Live |
| `@aigarth/trinary` | Trinary protocol, signed envelope, consensus algebra | Live (100% coverage, 90 tests) |
| `@aigarth/aigarthpool` | AigarthPool client (simulator + RPC) | Live |
| `@aigarth/config` | Shared config + env resolution | Live |
| `@aigarth/observability` | Tracing, logging, metrics | Live |
| `@aigarth/ui` | Shared component library | Live |
| `@aigarth/utils` | Shared utilities | Live |

### 2.3 The Trinary Intelligence Layer (Phase 18, shipped)

This is the single most important fact for evaluating the thread:

- Every `/decide` on `services/ann` returns a signed `IntentEnvelope` with `state ∈ {-1, 0, +1}`, `confidence`, `authority`, `reasoning`, `reversibility`, `time_horizon`, plus HMAC-SHA-256 signature and `schema_version: 1`.
- `services/tissue` composes ANNs into a single decision using 5 policies: `majority`, `unanimous`, `any`, `veto_aware`, `short_circuit`.
- Tissues can be listed on the marketplace at a per-decision price in QUBIC; billing flows through automatically.
- The `@aigarth/trinary` package is **Neuraxon-inspired, not Neuraxon-built**. It can adopt a Neuraxon runtime later without protocol changes (ADR 003 §6).

**Implication:** the thread's "Tissue" primitive is **already shipped, with a different scope** (ANN composition, not evolution). The Organism primitive must extend the Tissue, not replace it.

### 2.4 Training & feedback (Phase 19, ~92%)

- 5 training recipes: `mlp_classifier`, `cnn_classifier`, `text_classifier`, `gradient_boost_tabular`, **`trinary_classifier`**
- Real LLM invocation in `/decide` (Phase 19C.3, stub + OpenAI-compatible backends)
- Compute bridge: `TRAINING_COMPUTE_MODE=stub|http` (off-chain by default; can hit real Qubic OC when ready)
- SSE progress stream; auto-publish new ANN version on success; semver bump + `isLatest` promotion
- Decision outcome tracking: `POST /v1/anns/:id/decisions/:decision_id/outcome` (30 tests)
- Auto-retrain trigger: drift + outcome rate, opt-in per ANN (21 tests, cron loop)
- A/B shadow deployment for ANN versions (`active` / `shadow` / `canary` / `deprecated`)
- Predicted vs actual UI in `/dashboard/garden`

**Implication:** the "experience → learning → adaptation" loop is **partially built**. The Organism primitive (genome, environment, fitness, evolution) is the missing piece.

### 2.5 Material Science (Phase 17, Phase 0 done)

The 8-ANN coordinator (Research Director, Literature, Simulation, Physics, Design, Optimization, Experiment, Validation) is **already designed and evaluated**. The eval found a 50-100× cost multiplier vs video (DFT dominates at 87% of a ~52 QU workflow) and explicitly stated: "Aigarth cannot do experiments. What it can do is plan the experiment, predict its outcome, validate against historical lab data, and log the result for the next iteration."

The thread's "Materials Brain" / "8-tissue architecture" / "chemistry tissue + physics tissue + …" is **already the Phase 17 proposal**. We must build on it, not duplicate it.

### 2.6 On-chain settlement (Phase 20-23, shipped)

- AigarthPool QPI contract (4 procedures, 4 queries, 4 events, defaults 30/60/10 split)
- Multi-sig treasury with sibling contract pattern
- M3 rate limits (`MAX_STAKE_PER_TX=1M`, `MAX_STAKE_PER_USER_PER_EPOCH=5M`)
- M4 circuit breaker (`paused` flag)
- p3 Qearn watcher + stake-attribution audit
- Hardware-gated behind AIO Dev Kit (Phase 20.6 still open)

**Implication:** the on-chain substrate is real. We can record organism lineage and fitness on-chain when we're ready.

### 2.7 Hardware presale (Phase 24, shipped)

`apps/web/app/(marketing)/products/seeds/page.tsx` + `services/escrow` + `services/presale` + USD price oracle + Qearn lock wrapper. 8 SP in 2h 30m. Otto One presale pattern adapted for QUBIC-native two-stage payment with yield opt-in.

### 2.8 What's NOT in the repo

| Gap | Status | Source |
|---|---|---|
| Neuraxon runtime in any service | **Not started** | ADR 003 §6 — "A Neuraxon runtime can land in 19+ and would consume the same protocol" |
| Organism primitive (genome, environment, fitness, lineage, evolution) | **Not started** | This PEP proposes it as Phase 26 |
| Work Runtime / task scheduler / verifier | **Partial** — `services/compute` has a job runner; no general task abstraction | This PEP proposes it as Phase 27 |
| "Universal Useful Work Protocol" | **Not started** — and should not start until Phase 28+ | This PEP proposes it as long-term research |
| Functional Materials Science environment (only marketing page + eval exist) | **Phase 1 backlog** (5 done of 13) | Phase 17 |
| Functional Video Generation environment (only marketing page exists) | **Not started** | Phase 17 sister use case |

---

## 3. Neuraxon Technical Assessment

**Status of Neuraxon 2.0 (verified 2026-08-10):**

- Open-sourced on GitHub (`DavidVivancos/Neuraxon`); first commit in repo ~Feb 2026; latest commit May 28, 2026
- Trinary, continuous-time, bio-inspired (not conventional ANNs)
- `cuNxon` CUDA library released May 2026 → GPU acceleration
- ARC-AGI-3 score: 0.21% as of July 22, 2026 (doubled from 0.13%)
- Peer-reviewed paper at ICMLT Berlin (May 20-22, 2026); accepted at AGI-26 conference
- Hugging Face demo available
- Qubic's stated plan: integrate Neuraxon into the network so miners can run Neuraxon workloads on GPU

**Aigarth's relationship to Neuraxon (verified):**

- ADR 003: trinary state lives at the **ANN boundary**, not the neuron level. Every ANN in the live platform today returns either an OpenAI-shaped text response or a label. The trinary envelope is the *protocol*, not the *runtime*.
- "Neuraxon-ITU" hybridization has not happened. No Aigarth service imports Neuraxon. No training recipe targets a Neuraxon substrate.
- The thread's claim that "Aigarth uses Neuraxon as the substrate" is factually wrong.

**Verdict:**

| Dimension | Assessment |
|---|---|
| **Maturity** | EXPERIMENTAL. Research framework, peer-reviewed, open source, but not production-ready for Aigarth's scale. ARC-AGI-3 at 0.21% is a milestone, not a benchmark. |
| **CPU capability** | CONFIRMED. Neuraxon 2.0 doubles ARC-AGI-3 score on CPU alone, zero operating cost. |
| **CUDA capability** | CONFIRMED via cuNxon (May 2026). 5M+ CUDA developers lowers the integration barrier. |
| **Licensing** | Open source. Compatible with Aigarth's open-science stance. |
| **Integration into Aigarth** | NOT STARTED. The `@aigarth/trinary` package is the closest thing and is Neuraxon-*inspired*, not Neuraxon-*built*. |
| **Recommended Aigarth role** | Add a new training recipe `neuraxon_classifier` in `services/training` that delegates to a Neuraxon runtime in a sandboxed worker (Phase 26.E). Until then, treat Neuraxon as a research target, not a dependency. |

**Do NOT assume Neuraxon is the substrate. Treat it as one of several possible substrates, alongside conventional ANNs, transformers, and the existing Trinary envelope protocol.**

---

## 4. Qubic Capability Assessment

**Three pillars of Qubic (verified 2026-08-10):**

1. **Smart contracts** — Live since network launch. QPI-based. 676 computors.
2. **Oracle Machines** — Live on mainnet since **February 11, 2026**. 27,800+ queries before DOGE launch; 600,000+ queries in Epoch 210 alone. Caches with TTL. Persistent TCP. Subscriptions supported.
3. **Outsourced Computations (OC)** — First code shipped to mainnet in **Epoch 223** (late July 2026); full production targeted for **July 29, 2026** (per the May 28 AMA roadmap) or **early-to-mid August** (per the July 23 recap).

**What OC actually is (verified):**

OC is a mechanism for **Qubic smart contracts to send authorized instructions OUT to external systems**, which execute and return signed results. The 4-stage authorization: (1) smart contract invokes OC, (2) every computor records parameters, (3) computors independently sign, (4) once 451/676 (two-thirds) have signed, the request is authorized. Each computor forwards the signed bundle to a separate processor machine that performs the off-chain task.

> "Outsourced Computations have nothing to do with renting out compute power. It is the mechanism that allows a Qubic smart contract to send an authorized instruction outward, where an external system acts on it." — Qubic, "Three Pillars" blog, 2026

**Aigarth's relationship to Qubic OC (clarification):**

- The conversation thread frames OC as "external muscles / external organs" — implying Aigarth would CALL Qubic to get compute. **This is backwards.**
- The correct model: Aigarth **registers as an OC processor** (or a set of processors). Qubic smart contracts **invoke** Aigarth to perform off-chain work. Aigarth returns signed results. The 451/676 computor signature bundle is the trust primitive.
- AigarthPool (Phase 20) is already a Qubic-side consumer of the protocol (it accepts Qearn stakes and emits splits events). A new `@aigarth/oc-processor` package would let Aigarth-side services be OC processor targets.

**BPP-9000 (verified):**

- Activates at **Epoch 224** (late July 2026). Live.
- Trains a brain-inspired network to predict Bitcoin hourly price movement (1 year of data).
- 3 output states: up, down, unknown.
- Score = (1 − error rate) over the full year. Goal: zero errors.
- Single algorithm, single objective, single reward function. **Not** a heterogeneous mining system.

**DOGE parallel mining (verified):**

- Live since April 1, 2026. ASICs run Scrypt. CPU/GPU runs BPP-9000. **Parallel, not alternating.** This is Qubic's only current form of "heterogeneous" compute: one classical (Scrypt) + one neural (BPP-9000). The thread's "heterogeneous mining marketplace" idea is NOT what Qubic has built.

**Verdict:**

| Claim | Reality |
|---|---|
| "Qubic supports Oracle Machines" | LIVE since Feb 11, 2026. Aigarth can read OM data via existing `services/qubic` integration. |
| "Qubic supports OC" | LIVE (Epoch 223, late July 2026). Aigarth can register as an OC processor. |
| "OC is a compute marketplace" | NO. OC is an outbound instruction mechanism. Aigarth would be a *target*, not a *renter*. |
| "BPP-9000 is a precedent for heterogeneous mining" | BPP-9000 is one algorithm. Qubic's design is "one + DOGE." The "Universal Useful Work Protocol" the thread proposes is a genuine Aigarth R&D idea, not a Qubic capability. |
| "Aigarth can integrate with Qubic today" | YES, for read-side (OM subscriptions, transaction monitoring, AigarthPool events). YES, for write-side (AigarthPool stakes, AigarthPool splits). LIMITED, for OC (would need an OC processor worker, ~2-3 SP). |

---

## 5. BPP-9000 Analysis

**As a case study, BPP-9000 proves five things:**

1. **Useful PoW can be defined for an abstract task** (Bitcoin price prediction) with a measurable score.
2. **The algorithm is replaceable** — Qubic shipped BPP-9000 as a successor to earlier uPoW algorithms without rewriting consensus.
3. **The reward function is independent of the work performed** — uPoW is consensus + useful work, not "compute-for-rent."
4. **Network operators can choose to participate** in useful work over classical hashing. This is participation-driven, not consensus-mandated.
5. **Documentation-driven rollout works** — Qubic distributes algorithm specs to computors and miner developers; testing is public; activation is epoch-gated.

**BPP-9000 does NOT prove:**

- That arbitrary useful work is verifiable. BPP-9000 is a closed-form objective; many scientific workloads (DFT, MD, materials simulation) are not.
- That heterogeneous mining is economically rational. DOGE is the only parallel workload, and it's classical, not useful.
- That a marketplace for useful work exists. There is no third-party "BPP-10000 marketplace."
- That miners can be rewarded fairly for arbitrary compute. BPP-9000's reward is a single number (error rate) over a known dataset.

**Implication for Aigarth:**

BPP-9000 is a *precedent* for "useful work as a network primitive," not a *template* for "heterogeneous useful compute." Aigarth's Work Runtime (§9) can borrow BPP-9000's *packaging discipline* (versioned algorithm, epoch-gated activation, public spec) without inheriting its *single-objective model*.

**Concretely:** Aigarth's Work Runtime should ship its first workload as `awork-1` (a generic BPP-style task), spec'd exactly like BPP-9000, with the same epoch-gated activation discipline. The first workload is the simplest possible — a deterministic numerical computation with a closed-form correct answer. This is the "fitness" primitive, not the "useful mining" primitive. **Naming matters: do not call it mining. Call it a work item.**

---

## 6. Useful Work Architecture

The thread's "Universal Useful Work Protocol" (UWP) is the right *direction* but the wrong *name*. Here's the corrected architecture.

### 6.1 The four-tier model

```
┌──────────────────────────────────────────────────────────────────┐
│ Tier 1: Aigarth Work Runtime (LOCAL)                              │
│   - Work item registry (CRUD)                                     │
│   - Scheduler (FIFO + priority + capability match)                │
│   - Worker pool (local CPU + GPU)                                 │
│   - Result verifier (replication + challenge)                     │
│   - Per-item accounting (compute consumed, reward credited)       │
│   - State: PostgreSQL + NATS                                     │
│   - This is what ships in Phase 27                                │
├──────────────────────────────────────────────────────────────────┤
│ Tier 2: Aigarth Distributed Runtime (FEDERATED)                  │
│   - Multiple Aigarth Cloud deployments share work via signed RPC  │
│   - Each site can be a producer, consumer, or both                │
│   - State: shared via Qubic transaction metadata + local DB       │
│   - This is what ships in Phase 28                                 │
├──────────────────────────────────────────────────────────────────┤
│ Tier 3: Qubic Outbound Computation (ON-CHAIN)                    │
│   - Smart contract invokes Aigarth OC processor                   │
│   - Aigarth registers as a processor via @aigarth/oc-processor   │
│   - 451/676 computor signature bundle is the trust primitive       │
│   - State: Qubic mainnet                                          │
│   - This is what ships in Phase 29                                 │
├──────────────────────────────────────────────────────────────────┤
│ Tier 4: Arbitrary Useful Work (FUTURE RESEARCH)                  │
│   - Multiple workload types in a single scheduler                 │
│   - Cross-workload economic balance (premium on rare work)        │
│   - On-chain attestation of arbitrary computation                 │
│   - State: TBD                                                    │
│   - This is Phase 30+ research, contingent on Tier 3 success      │
└──────────────────────────────────────────────────────────────────┘
```

### 6.2 Why four tiers

- **Tier 1** lets Aigarth develop and experiment without Qubic dependency. Local development and CI.
- **Tier 2** lets Aigarth Cloud sites federate work among themselves, with Qubic as the settlement layer. This is the realistic near-term future.
- **Tier 3** is the *correct* Qubic integration model. Not "Aigarth calls Qubic for compute." Aigarth *is* the compute, and Qubic calls it.
- **Tier 4** is where the thread's "Universal Useful Work Protocol" actually lives. It is **not** an immediate deliverable. Tier 3 has to work first.

### 6.3 The work item envelope

A single work item is the smallest unit of computation. It is **not** a smart contract. It is **not** a transaction. It is an off-chain data structure that can be settled on Qubic.

```yaml
work_item:
  work_id: wki_8c3f4d2e              # ULID, Aigarth-side
  type: materials_simulation         # namespace.type
  spec_version: 1                    # bumped on schema break
  input:
    payload_hash: sha256:abc...      # the input deck is in MinIO; this is the pointer
    payload_uri: s3://aigarth/...
    payload_size_bytes: 184320
  algorithm:
    name: dft_relaxation
    version: v0.3.1
    container: registry.aigarth.cloud/sim/dft:v0.3.1
    deterministic: true              # if true, output is reproducible from input + algo
  requirements:
    cpu_cores: 8
    memory_gb: 32
    gpu: optional                    # 'required' | 'optional' | 'none'
    gpu_kind: any
    estimated_runtime_s: 600
  verification:
    method: replication              # 'replication' | 'challenge' | 'deterministic' | 'tee' | 'zk'
    replicas: 3
    challenge_work_id: null          # set if method=challenge
  reward:
    currency: QUBIC
    amount: 1000000                  # 1M Qu-bit = 0.001 QUBIC
    payer: ann-creator-uuid
  status: queued | running | verified | failed | disputed
  result:
    payload_hash: sha256:def...
    completed_by: worker-uuid
    completed_at: 2026-08-10T15:32:11Z
    replicas_agreed: 3/3
  audit:
    created_at: ...
    created_by: ...
    settlement_tx: null              # Qubic tx hash, set when settled on Tier 3
```

**Key design decisions:**

- The work item is **envelope-only**. Inputs and outputs are content-addressed in MinIO. The work item is small (~1 KB), auditable, and signed.
- `deterministic: true` is a first-class property. Deterministic work (DFT, MD, NN forward pass) is verifiable by re-running. Non-deterministic work (Monte Carlo, stochastic optimization) needs challenge tasks or replication + statistical agreement.
- `replicas` is the MVP verification mechanism. Three workers run the same input; outputs must agree. Failure modes (all three disagree, two agree one doesn't) are explicit.
- The envelope is **not** Qubic-native. It is Aigarth-native. Settlement happens via Qubic transactions, but the work itself is off-chain.

### 6.4 What this is NOT

- It is **not** a "mining algorithm marketplace." Work items are paid in QUBIC by their creator, not rewarded by Qubic consensus.
- It is **not** a "generalized BPP-9000." BPP-9000 is consensus. This is application-level work, settled optionally on Qubic.
- It is **not** a "compute rental platform." The thread's framing of "rent someone's gaming PC" is wrong. Workers contribute to a *scheduled workload*, not a *rented machine*. Aigarth Cloud is the orchestrator, not the marketplace.

---

## 7. Organism Architecture

This is the **genuinely new primitive** the thread proposes. Everything else (Tissue, Work Runtime, OC integration) is either shipped or nearly so. Organisms are the new layer.

### 7.1 What an organism IS and IS NOT

**IS:**

- A first-class, persistent, versioned, lineaged computational identity
- An environment-bound adaptive system with mutable state
- A lineage-tracked experiment with parents, children, and forks
- A fitness-scored, evolution-capable unit
- A composite of tissues, sensors, actuators, memory, and a genome

**IS NOT:**

- An ANN. Tissues are made of ANNs. Organisms are made of tissues. The same way a brain is made of organs; organs are made of cells; cells are not brains.
- A long-running agent. Organisms can be batch (e.g., TireMind evaluates one candidate per minute) or persistent (e.g., a market predictor that runs forever).
- A workflow. A workflow has steps. An organism has lifecycle phases.
- A simulation. A simulation is one run. An organism is a *sequence* of runs with state carried between them.

### 7.2 Organism schema (proposed v0.1)

```ts
// @aigarth/ann — adds to the existing ANN primitive; does NOT replace it.

Organism {
  id: UUID
  slug: string                     // unique
  name: string
  description: string
  creatorId: UUID
  visibility: 'public' | 'unlisted' | 'private'
  status: 'draft' | 'active' | 'paused' | 'deprecated' | 'extinct'
  kind: 'researcher' | 'optimizer' | 'predictor' | 'synthesist' | 'custom'

  // Genome — the mutable, evolvable definition
  genome: OrganismGenome           // see below

  // Environment — where the organism lives
  environment: OrganismEnvironment // see below

  // Objective — what the organism is trying to do
  objective: OrganismObjective     // see below

  // Fitness — the current and historical score
  fitness: number                  // current
  fitnessHistory: { generation: number, fitness: number, timestamp: Date }[]

  // Lineage — parents, children, forks
  parentId: UUID?
  rootId: UUID                     // the founder of the lineage
  generation: number               // 0 = root, 1 = first mutation, etc.
  children: UUID[]

  // Memory — what the organism has learned
  memory: OrganismMemory           // see below

  // Compute accounting
  computeConsumed: {
    cpuSeconds: number
    gpuSeconds: number
    networkBytes: number
    workItemsCompleted: number
    qubicSpent: number
  }

  // Lifecycle metadata
  createdAt, updatedAt, deletedAt
  birthAt: Date                    // first activation
  deathAt: Date?                   // set when status='extinct' (e.g., fitness < threshold for N generations)
}

OrganismGenome {
  // Mutable, versioned, evolvable
  version: number                  // bumped on every mutation
  tissues: TissueRef[]             // references to existing tissues
  // Optional non-tissue components:
  llmHint: { model: string, promptTemplate: string }?
  simulator: { type: string, config: JSONB }?
  externalModel: { endpoint: string, config: JSONB }?
  // Mutation policy — how the genome changes
  mutation: {
    rate: number                   // 0..1
    operators: ('tissue_swap' | 'tissue_fork' | 'weight_perturb' | 'tissue_add' | 'tissue_remove')[]
  }
  // Recombination policy — how two organisms merge
  recombination: {
    enabled: boolean
    strategy: 'uniform' | 'single_point' | 'fitness_weighted'
  }
}

OrganismEnvironment {
  type: 'materials_simulation' | 'video_generation' | 'oracle_feed' | 'scientific_paper_corpus' | 'custom'
  config: JSONB                    // type-specific
  inputStreams: { name: string, source: string }[]   // e.g., "papers" → "https://arxiv.org/..."
  oracleSubscriptions: { name: string, om: string }[]
  feedbackChannels: { name: string, target: string }[]  // e.g., "lab_results" → "/v1/organisms/:id/feedback"
}

OrganismObjective {
  fitnessFunction: string          // code reference; e.g., "@aigarth/fitness:tire.v1"
  weights: Record<string, number>  // dimensions and their importance
  thresholds: { minFitness: number, maxStallGenerations: number }
  // The objective is FIRST-CLASS because it determines extinction
}

OrganismMemory {
  shortTerm: { key: string, value: any, ttl: number }[]   // in-memory
  longTerm: { key: string, value: any, writtenAt: Date }[] // durable, in DB
  episodic: { episodeId: UUID, input: any, output: any, fitness: number, timestamp: Date }[]
  // Episodic memory is the key to "evolution" — it records what was tried and what worked
}
```

### 7.3 Lifecycle (the new piece)

```
   CREATE                 ACTIVATE                EXPERIENCE                 ADAPT
   (draft)                (active)                 (running)                (active)
     │                       │                         │                       │
     │  POST /v1/organisms  │  POST .../activate      │  experiences stream   │  episodic memory
     │  + genome + env      │                         │  into episodic[]      │  weights updated
     │  + objective         │                         │                       │  fitness recalc
     │                       │                         ▼                       │
     │                       │                  ┌────────────────┐             │
     │                       │                  │   EVALUATE     │             │
     │                       │                  │  fitness       │             │
     │                       │                  │  per gen       │             │
     │                       │                  └───────┬────────┘             │
     │                       │                          │                      │
     │                       │                          ▼                      │
     │                       │                  ┌────────────────┐             │
     │                       │                  │   EVOLVE       │ ◀───────────┘
     │                       │                  │  mutate        │   may trigger EVOLVE
     │                       │                  │  recombine     │   on threshold
     │                       │                  │  fork          │
     │                       │                  └───────┬────────┘
     │                       │                          │
     │                       │                          ▼
     │                       │                  ┌────────────────┐
     │                       │                  │   CHILD        │  POST /v1/organisms (parentId=this)
     │                       │                  │   for next gen │
     │                       │                  └────────────────┘
     │                       │
     │                       ▼
     │              ┌────────────────┐
     │              │   EXTINCT      │  if fitness < minFitness for maxStallGenerations
     │              │   (extinct)    │  or explicit POST .../extinct
     │              └────────────────┘
```

**The non-obvious design point:** Evolution happens **per the mutation policy in the genome**, not on a schedule. The organism evolves when its episodic memory crosses a threshold (e.g., 100 new experiences since last mutation). The platform does not force evolution; it enables it.

### 7.4 Why this is "Organism" not "Tissue"

The existing Tissue is **stateless per call**. A tissue receives an input, fans out to member ANNs, combines envelopes, returns a signed decision. It does not retain state between calls. (The decision history is logged, but it's audit, not memory.)

An Organism is **stateful across experiences**. The genome mutates. Memory persists. Fitness is tracked across generations. Lineage is parented.

In biological terms:
- ANN = a cell
- Tissue = an organ (composes cells into a function)
- Organism = a body (composes organs, retains state, lives in an environment, can reproduce)

### 7.5 Marketplace representation

A published Organism is a "Computational Species" listing:

```
ThermoMind v17
├─ Creator: aigarth-research
├─ Generation: 17
├─ Lineage: thermomind-root → ... → v17
├─ Fitness: 94.7
├─ Architecture: 4 tissues (chemistry, physics, thermal, friction) + 1 simulator
├─ Environment: materials_simulation (battery cathode domain)
├─ Objective: weighted(0.20 safety, 0.15 durability, ...)
├─ Compute consumed: 4.8M work items, 19,442 CPU-hr, 311 GPU-hr, 82,103 oracle queries
├─ Discoveries: 14,200 candidates explored, 247 published, 3 licensed
├─ License: commercial, $X per fork
└─ Provenance: signed genome hash, on-chain lineage root
```

A fork is a new Organism with `parentId` set. A new generation is a new Organism with `parentId` and a mutated genome. The marketplace surface is read-only and lineage-traceable.

### 7.6 Phased introduction

Do NOT ship the full Organism primitive at once. Phase 26 introduces it in three sub-phases:

- **26.A** — `Organism` schema + CRUD + lineage; no automatic evolution. The user mutates the genome manually. The first fitness-tracking prototype. ~3 SP.
- **26.B** — Auto-mutation per genome policy. Episodic memory is the source of truth. The first "growing intelligence" demo. ~4 SP.
- **26.C** — Recombination + marketplace lineage view. The first commercial Organism listing. ~3 SP.

Total: ~10 SP for the primitive. Compare to the Tissue primitive, which was ~14 SP across 18A-18F.

---

## 8. Tissue Architecture (extending the existing)

The existing Tissue (Phase 18D) is **state-free per call**. For the Organism to use Tissues effectively, we add:

- **Stateful tissue** (`/v1/tissues/:slug/decide/stateful`): an opt-in variant that accepts and returns a state envelope. The tissue writes its accumulated state to a per-tissue key after each call. The Organism owns the state key.
- **Tissue memory**: episodic memory entries can be aggregated into a tissue-level long-term memory, queryable via `/v1/tissues/:slug/memory?since=...&kind=...`.
- **Tissue-as-organ**: an Organism can be built *entirely* from a single Stateful Tissue. This is the simplest Organism. Useful for "I just want one tissue that learns" cases.

This is additive. The existing stateless Tissue API is unchanged. New routes are added. No migration.

---

## 9. Work Runtime (Tier 1, local)

### 9.1 Why this is separate from `services/compute`

`services/compute` today is the **Aigarth Core scheduler**: it manages reservations, regions, clusters, jobs, escrow. It's the substrate for capacity.

The Work Runtime is **higher-level**: it accepts *work items* (defined in §6.3) and routes them to *workers* (which may be `services/compute` jobs, external Docker containers, Neuraxon runtimes, OC processors, or human-via-Oracle channels). It is the application's view of "where does work go."

### 9.2 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Work Runtime (services/work, port 7012 — proposed)           │
│                                                              │
│  ┌────────────────┐    ┌─────────────────┐                  │
│  │  Work Registry │    │  Worker Registry │                  │
│  │  (Postgres)    │    │  (Postgres + NATS│                  │
│  │  work_items    │    │  worker_id,      │                  │
│  │  + results     │    │  capabilities,   │                  │
│  │  + audit       │    │  heartbeat)      │                  │
│  └────────┬───────┘    └───────┬─────────┘                  │
│           │                    │                              │
│           ▼                    ▼                              │
│  ┌─────────────────────────────────────────┐                │
│  │           Scheduler                     │                │
│  │  input: (work_item, available_workers)  │                │
│  │  output: assignment (worker_id, lease)  │                │
│  │  policies:                               │                │
│  │    - capability_match (required:hw)       │                │
│  │    - priority + FIFO                     │                │
│  │    - cost_aware (cheapest replica)       │                │
│  │    - locality_aware (same region)        │                │
│  └────────────────┬────────────────────────┘                │
│                   │                                          │
│                   ▼                                          │
│  ┌─────────────────────────────────────────┐                │
│  │           Verifier                      │                │
│  │  - replication: 3 workers, must agree    │                │
│  │  - challenge: known-answer spot check    │                │
│  │  - deterministic: re-run, compare hash   │                │
│  │  - tee: SGX/SEV attestation              │                │
│  │  - on failure → mark work_item disputed  │                │
│  └────────────────┬────────────────────────┘                │
│                   │                                          │
│                   ▼                                          │
│  ┌─────────────────────────────────────────┐                │
│  │           Accountant                    │                │
│  │  - per-worker ledger (compute consumed)  │                │
│  │  - per-work-item cost (final)            │                │
│  │  - per-organism rollup                   │                │
│  │  - billing hook to services/billing       │                │
│  └─────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

### 9.3 Worker types

A worker registers itself with its capabilities:

```ts
{
  worker_id: "wrk_local_cpu_01",
  kind: "local" | "remote" | "oc-processor" | "neuraxon" | "human-via-oracle",
  capabilities: {
    cpu_cores: 8,
    memory_gb: 32,
    gpu: "none" | "rtx_4090" | "h100" | "any",
    algorithms: ["neuraxon_classifier", "dft_relaxation", "md_step", ...],
    runtime: "docker" | "wasm" | "native",
    location: "us-east-1",
    reputation: 0.97,                 // rolling 30d
    disputes: 0                       // unresolved
  }
}
```

The first worker is the local Docker runner — a Python process that polls the work queue, pulls the work item, downloads the payload, runs the algorithm container, uploads the result, and signs the response. The container is signed at registration; the worker is *not* allowed to run unsigned code.

### 9.4 Verification — start simple, earn the right to be complex

The PEP **does not** recommend building cryptographic verification on day one. The MVP verification model is:

1. **Replication (3 workers).** Three workers run the same input. All three must agree on the output hash. Quorum = 3/3. Disagreement → manual review.
2. **Deterministic re-run.** If the algorithm is marked `deterministic: true`, the verifier re-runs the work item itself on a known-good worker. Output hash must match. This is a 4th vote, not a replacement.
3. **Challenge tasks.** Once per N=100 work items, the verifier issues a known-answer challenge to a random worker. Failure → reputation penalty.
4. **Reputation.** Per-worker reputation. Disputes, missed challenges, timeouts, all reduce reputation. Below 0.5 → worker is suspended.

**Do NOT** add ZK proofs, TEE attestation, or staking/slashing in v1. Earn the right by demonstrating that replication + challenge + reputation catches the obvious attacks. (Most attacks in compute marketplaces are "didn't actually run the work" and "made up a plausible result" — replication + challenge catch both.)

### 9.5 Billing

Every work item has a reward. The reward is paid by the *creator* (the Organism or the user) and credited to the *worker(s)* that completed it. The Work Runtime emits a `WorkUsageEvent` that `services/billing` consumes. Existing per-line-item overage accounting (used for tissues) is reused — `overage_work` line item.

---

## 10. Dynamic Compute Architecture

The thread's "dynamic heterogeneous compute marketplace" is the right *direction*. The realistic *implementation* is:

- **Tier 1 (Phase 27):** Local compute only. One Aigarth deployment. Workers are local Docker containers.
- **Tier 2 (Phase 28):** Federated. Multiple Aigarth deployments share work via signed RPC. Workers can be in any deployment.
- **Tier 3 (Phase 29):** OC. Aigarth registers as an OC processor. Qubic smart contracts invoke Aigarth for off-chain work. Workers can be triggered by OC requests.
- **Tier 4 (Phase 30+, future research):** Arbitrary useful work. Multiple workload types. Cross-workload economic balance. On-chain attestation of arbitrary computation.

**What this is NOT:**

- Not a "miner comes to Aigarth and rents a machine." Workers are *contributors to scheduled work*, not renters.
- Not a "lender of spare cycles." The Work Runtime schedules; workers don't volunteer.
- Not a "competitor to Akash / Render / io.net." Those are general-purpose compute marketplaces. Aigarth's Work Runtime is *application-specific*: it serves Organisms, not arbitrary tenants.

The closest analogue is **Celery + Flower + RabbitMQ**, with replication, signed work items, and OC settlement. That's the right starting point.

---

## 11. Verification Architecture

The verification problem is **the** research risk. The thread acknowledges this; this PEP makes it concrete.

| Mechanism | Performance | Cost | Security | MVP | Notes |
|---|---|---|---|---|---|
| Replication (3 workers) | Low (3x compute) | High (3x) | High for deterministic | ✅ | Default for v1 |
| Deterministic re-run | Medium (1x verifier compute) | Medium | High if algorithm is deterministic | ✅ | Use when `deterministic: true` |
| Challenge tasks | Low (1/100 overhead) | Very low | Catches "did not run" | ✅ | Always-on in v1 |
| Result commitments (commit-reveal) | Low | Very low | Low alone | ✅ | Used for non-deterministic |
| Reputation | Zero runtime cost | None | Indirect | ✅ | Always-on |
| TEE attestation (SGX/SEV) | Low (TEE overhead) | High (specialized hardware) | Very high | ❌ v1, ✅ v2 | Defer until Aigarth hardware nodes ship |
| ZK proofs (zkML, etc.) | High prover cost | Very high | Highest | ❌ | Research, not MVP |
| Staking + slashing | Zero runtime cost | Capital lockup | High if stake is meaningful | ❌ v1 | Requires Qubic-side stake |
| Trusted hardware attestation (TPM/TEE) | Low | Medium | Medium | ❌ v1 | Defer |

**MVP verification = replication + challenge + reputation + result commitments.** This is the simplest viable stack that catches the obvious attacks. Don't add cryptographic complexity until you can demonstrate that the MVP fails to catch a real attack.

---

## 12. Materials Science Architecture

The Phase 17 architecture evaluation is the foundation. This PEP *builds on* it, not *replaces* it. Read `docs/use-cases/material-science-eval.md` first.

**Key takeaways from Phase 17:**

- The 8-ANN coordinator (Research Director, Literature, Simulation, Physics, Design, Optimization, Experiment, Validation) maps cleanly onto the existing ANN primitive
- DFT dominates cost (87% of a ~52 QU workflow); per-stage pre-flight estimates are mandatory
- The platform can plan, predict, validate, log — but cannot do physical experiments
- Qubic OC is *especially* suited to material science (distributed simulation compute)
- The largest blocker is K12 signature verification (shared with video)

**What this PEP adds:**

- **Materials Science becomes an Organism** (TireMind-001, see §13). Not 8 disconnected ANNs but a single evolving Organism with the 8 ANNs as tissues, a fitness function, and episodic memory.
- **Work Runtime** (Phase 27) becomes the substrate for the Simulation tissue's DFT calls. Each DFT relaxation is a work item; replication is 3 workers; reward is per-candidate.
- **Oracle Machine** integration (already live) becomes the channel for *external lab data* — the feedback loop the Phase 17 evaluation flagged as missing.
- **TireMind** is the *flagship* Organism, not the only Materials Science Organism. ClimateMind, AlloyMind, CatalystMind can follow the same template.

---

## 13. TireMind-001

**Objective (per the user's brief):** Develop computationally promising candidates for a safer, non-pneumatic or puncture-resistant tire/material system that:
- does not depend on air pressure in the conventional sense
- minimizes catastrophic burst/failure modes
- maintains acceptable safety
- provides good wet/dry performance
- reduces rolling resistance
- provides long service life
- is affordable to manufacture
- can incorporate recycled end-of-life tire materials
- maximizes recyclability
- reduces environmental impact

**Architectural mapping (per this PEP):**

TireMind-001 is an Organism. Its genome contains 7 tissues, one simulator, and one fitness function.

**Genome:**

```yaml
kind: "researcher"
genome:
  version: 1
  tissues:
    - tissue_ref: "chemistry-tire-v1"   # composition → molecular properties
    - tissue_ref: "mechanical-tire-v1"  # composition → strength / elasticity / fatigue
    - tissue_ref: "thermal-tire-v1"     # composition → temperature behavior
    - tissue_ref: "friction-tire-v1"    # surface/material → grip
    - tissue_ref: "aging-tire-v1"       # material → degradation
    - tissue_ref: "manufacturing-tire-v1"  # composition → production cost
    - tissue_ref: "sustainability-tire-v1" # material → lifecycle/recyclability
  simulator:
    type: "fea_lattice"
    config: { /* solver: Code_Aster / Abaqus / openFOAM */ }
  llm_hint:
    model: "aigarth-meridian-1"         # for hypothesis generation
    prompt_template: "@aigarth/prompts:tire-hypothesis-v1"
  mutation:
    rate: 0.1
    operators: ["tissue_swap", "tissue_fork", "weight_perturb", "tissue_add", "tissue_remove"]
  recombination:
    enabled: true
    strategy: "fitness_weighted"

environment:
  type: "materials_simulation"
  config:
    material_universe:
      - natural_rubber, synthetic_elastomers, tpe, polyurethane
      - devulcanized_rubber, recycled_rubber
      - silica, carbon_black, cellulose, graphene, nanocellulose
      - recycled_plastics, bio_polymers, resins
      - lattice_structures, foams, composites
    constraint_max_recycled_content: 0.60
    constraint_max_cost_relative_to_baseline: 1.20
  input_streams:
    - name: "papers"
      source: "arxiv:cond-mat.mtrl-sci"
    - name: "patents"
      source: "uspto:tires"
  oracle_subscriptions:
    - name: "natural_rubber_price"
      om: "qubic:commodity:natural_rubber_usd_per_kg"
    - name: "carbon_black_price"
      om: "qubic:commodity:carbon_black_usd_per_kg"
  feedback_channels:
    - name: "lab_results"
      target: "/v1/organisms/tiremind-001/feedback"

objective:
  fitness_function: "@aigarth/fitness:tire.v1"
  weights:
    safety: 0.20
    durability: 0.15
    rolling_efficiency: 0.15
    wet_grip: 0.10
    dry_grip: 0.10
    thermal_stability: 0.10
    recyclability: 0.10
    manufacturability: 0.05
    cost_efficiency: 0.05
  thresholds:
    min_fitness: 70
    max_stall_generations: 20
```

**Fitness function (`@aigarth/fitness:tire.v1`):**

```python
# @aigarth/fitness/tire/v1.py — first-class, versioned, executable

def fitness(candidate: dict, oracle_data: dict) -> dict:
    """Returns {score: float, components: dict, rationale: str}.
    Same input → same output. Deterministic. Auditable.
    """
    s = (
        candidate['safety_score'] * 0.20 +
        candidate['durability_score'] * 0.15 +
        candidate['rolling_resistance_inv'] * 0.15 +
        candidate['wet_grip'] * 0.10 +
        candidate['dry_grip'] * 0.10 +
        candidate['thermal_stability'] * 0.10 +
        candidate['recycled_content'] * candidate['recyclability'] * 0.10 +
        candidate['manufacturability'] * 0.05 +
        candidate['cost_efficiency'] * 0.05
    )
    return {
        "score": s,
        "components": {...},
        "rationale": "..."  # generated by LLM hint, signed by organism
    }
```

**Evolutionary loop:**

```
Gen 0
  ↓
10,000 candidate formulations
  ↓
chemistry tissue (predicts molecular properties)
  ↓
mechanical tissue (predicts strength)
  ↓
thermal tissue (predicts heat behavior)
  ↓
friction tissue (predicts grip)
  ↓
aging tissue (predicts degradation)
  ↓
manufacturing tissue (predicts cost)
  ↓
sustainability tissue (predicts recyclability)
  ↓
FEA lattice simulation (structural performance)
  ↓
fitness function (weighted score)
  ↓
Top 500
  ↓
Mutation (tissue_swap, weight_perturb, etc.) + Recombination
  ↓
5,000 new candidates (Gen 1)
  ↓
...
  ↓
Gen N — best candidate → publish to marketplace → optional Oracle → lab
  ↓
Lab result → /v1/organisms/tiremind-001/feedback
  ↓
Episodic memory updated
  ↓
Gen N+1 begins with grounded evidence
```

**Why this is NOT "another LLM inventing materials":**

- The tissues are **specialized ANNs** trained on materials data, not general LLMs
- The simulator is a **numerical solver**, not an LLM
- The fitness function is **deterministic and versioned**
- The episodic memory includes **real lab results** when available
- The mutation operators are **bounded and auditable**

**Why this is NOT "solving the tire problem":**

- We are not promising TireMind will find a new tire compound. We are demonstrating the loop.
- The first deliverable is **Aigarth Evolution Run #001** — 1,000 generations of a constrained candidate space, measured in compute consumed, best fitness, generation diversity, prediction accuracy, and cost per discovery.
- A "promising candidate" is **a hypothesis worth testing in a real lab**, not a product.

**Tier of work items (DFT relaxation):**

- `algorithm: dft_relaxation` (e.g., VASP, Quantum ESPRESSO, or surrogate)
- `deterministic: true` (DFT is reproducible)
- `replicas: 3` (3 workers, quorum)
- `estimated_runtime_s: 600` (10 minutes per candidate)
- `reward: 1,000,000 Qu-bit` (0.001 QUBIC) — internal credits, no on-chain settlement in Phase 27

A 1,000-candidate generation is ~3M work items × 1,000 seconds = ~83 days on one worker. With 100 workers in parallel: ~20 hours. This is the actual cost of one generation. The cost story MUST be visible to the user *before* commitment, per the Phase 17 evaluation.

---

## 14. Video Intelligence Architecture

The video page (`/use-cases/video-synthesis`) is currently a marketing page. This PEP proposes:

- **VideoMind** is an Organism with the following genome:
  - World Model Tissue (Neuraxon or transformer — predicts next-frame coherence)
  - Temporal Memory Tissue (persistent across clips)
  - Physics Evaluator Tissue (consistency: momentum, lighting, occlusion)
  - Semantic Evaluator Tissue (does the video match the prompt)
  - External Video Model (Higgsfield Sora-class — generation)
  - Optional: External LLM Hint (script planning)
- The Organism does NOT generate video directly. It **orchestrates** the external video model and **evaluates** the output.
- The result: a video generation system that can self-detect inconsistencies and request regeneration. Not Sora; a *coherence layer* over Sora.

This is **Phase 30+** in this PEP. The video use case is real but secondary to Materials Science. Materials Science has a quantitative fitness function (DFT, FEA); video has a qualitative one (subjective quality + physics + semantics). Materials Science is the better flagship.

---

## 15. Marketplace Architecture

The existing marketplace (Phase 6) supports ANN and Compute listings. This PEP adds:

- **Organism listing** (Phase 26.C) — lineaged, versioned, fitness-scored
- **Work item marketplace** (Phase 27) — *not* a rental; an outbound feed of work items a worker can opt to consume
- **Discovery lineage** (Phase 28) — browse the lineage tree of an Organism, see forks, see fitness over generations

The marketplace does **not** become a "general AI app store" (per the conversation thread's "Google Play Store for artificial organisms" framing). It stays focused on the Aigarth primitives: ANNs, Tissues, Organisms, and the work items that feed them.

---

## 16. Economic Model

**Reward flows (per the conversation, refined):**

| Event | Payer | Receiver | Amount |
|---|---|---|---|
| Organism creates a work item | Organism (or its creator) | Worker (via Work Runtime) | Work item's `reward.amount` |
| Work item verified | — | Worker | Credited via `WorkUsageEvent` |
| Organism fitness improves | — | Creator | Royalty share (existing Aigarth mechanism) |
| Organism forked | Forker | Parent creator | License fee (existing) |
| External lab experiment | Organism (or grant) | Lab | Negotiated; settled in QUBIC via OC |
| Oracle subscription | Organism (or its creator) | Oracle operator | Existing Oracle Machine economics |
| Worker proves useful work (Tier 4, future) | Network (Qubic uPoW) | Worker | QUBIC reward (replaces or supplements BPP-9000) |

**Anti-speculation guardrails:**

- Organism fitness is **measured, not declared**. The platform measures; it does not trust creator claims.
- Work item rewards are **paid by the creator, not minted by the platform**. The QUBIC moves from the creator's account to the worker's account; nothing new is created.
- Lineage is **append-only**. No retroactive fitness changes; no back-dating.
- Discovery bounties (Phase 30+) are **funded from a fixed budget** (e.g., 100M QUBIC per year), not from inflation.

---

## 17. Security Model

**Threat model (per the conversation, formalized):**

| Threat | Mitigation | MVP status |
|---|---|---|
| Worker claims to have run work but didn't | Replication + challenge tasks | ✅ |
| Worker returns a fake plausible result | Replication (3/3) + deterministic re-run | ✅ |
| Worker colludes with creator | Reputation decoupled from creator; cross-worker replication across deployments | ✅ Tier 2+ |
| Organism creator inflates fitness | Fitness measured by platform, not declared; lineage append-only | ✅ |
| Organism creator back-dates lineage | Append-only log; on-chain lineage root (Phase 29) | ⏳ Phase 29 |
| Oracle lies about external data | OM uses Qubic's 451/676 quorum; data signed by OM | ✅ already live |
| Smart contract mis-routes work to malicious processor | OC authorization requires 451/676 signatures | ✅ already live |
| LLM prompt injection in tissue generation | Trinary envelope is a typed contract; LLM output is post-validated | ✅ |
| Spam / Sybil on Organism creation | Identity service rate limits + paid compute | ✅ |

**Key security property:** *The platform is not the trust root; Qubic is.* For Tier 3 (OC), the trust root is the 451/676 computor signature. For Tier 1 and 2, the trust root is the Aigarth deployment itself, but cross-deployment work and OC settlement move trust to Qubic.

---

## 18. Data Model

The Organism primitive adds these tables. All are owned by **`services/ann`** (extending the existing service) so the data model stays co-located with the ANN primitive. (A separate `services/organism` is unnecessary; Organism is the evolutionary cousin of ANN, not a separate domain.)

```sql
-- Phase 26.A

organisms (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  creator_id UUID NOT NULL REFERENCES users(id),
  visibility TEXT NOT NULL CHECK (visibility IN ('public','unlisted','private')),
  status TEXT NOT NULL CHECK (status IN ('draft','active','paused','deprecated','extinct')),
  kind TEXT NOT NULL,
  genome JSONB NOT NULL,                      -- OrganismGenome
  environment JSONB NOT NULL,                -- OrganismEnvironment
  objective JSONB NOT NULL,                  -- OrganismObjective
  fitness DOUBLE PRECISION,
  parent_id UUID REFERENCES organisms(id),
  root_id UUID NOT NULL REFERENCES organisms(id),
  generation INT NOT NULL DEFAULT 0,
  compute_consumed JSONB NOT NULL DEFAULT '{}'::jsonb,
  birth_at TIMESTAMPTZ,
  death_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX organisms_creator_idx ON organisms(creator_id) WHERE deleted_at IS NULL;
CREATE INDEX organisms_parent_idx ON organisms(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX organisms_root_idx ON organisms(root_id) WHERE deleted_at IS NULL;
CREATE INDEX organisms_status_idx ON organisms(status) WHERE deleted_at IS NULL;

organism_memories (
  id UUID PRIMARY KEY,
  organism_id UUID NOT NULL REFERENCES organisms(id),
  kind TEXT NOT NULL CHECK (kind IN ('short_term','long_term','episodic')),
  payload JSONB NOT NULL,
  written_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX organism_memories_organism_kind_idx ON organism_memories(organism_id, kind);

organism_fitness_history (
  id UUID PRIMARY KEY,
  organism_id UUID NOT NULL REFERENCES organisms(id),
  generation INT NOT NULL,
  fitness DOUBLE PRECISION NOT NULL,
  components JSONB NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX organism_fitness_history_organism_idx ON organism_fitness_history(organism_id, generation);
```

**Phase 27 (Work Runtime) tables** (separate service, `services/work`):

```sql
work_items (
  id UUID PRIMARY KEY,
  work_id TEXT UNIQUE NOT NULL,              -- ULID
  type TEXT NOT NULL,                        -- namespace.type
  spec_version INT NOT NULL,
  payload_hash TEXT NOT NULL,
  payload_uri TEXT NOT NULL,
  payload_size_bytes BIGINT NOT NULL,
  algorithm JSONB NOT NULL,
  requirements JSONB NOT NULL,
  verification JSONB NOT NULL,
  reward JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','running','verified','failed','disputed')),
  result JSONB,
  audit JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  settlement_tx TEXT                         -- Qubic tx, set in Phase 29
);

workers (
  id UUID PRIMARY KEY,
  worker_id TEXT UNIQUE NOT NULL,
  kind TEXT NOT NULL,
  capabilities JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','suspended','offline')),
  reputation DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  disputes INT NOT NULL DEFAULT 0,
  last_heartbeat_at TIMESTAMPTZ
);
```

**No migration risk.** All new tables, no changes to existing schema.

---

## 19. API Model

**Phase 26 (Organism) — new routes, all under `services/ann` (or new `services/organism` if preferred; recommend co-locating):**

```
POST   /v1/organisms                       # create draft
GET    /v1/organisms                       # list public
GET    /v1/organisms/:slug                 # retrieve
PATCH  /v1/organisms/:slug                 # update (creator only)
POST   /v1/organisms/:slug/activate        # draft → active
POST   /v1/organisms/:slug/pause           # active → paused
POST   /v1/organisms/:slug/fork            # create child organism (parentId set)
POST   /v1/organisms/:slug/mutate          # bump genome version
POST   /v1/organisms/:slug/recombine       # merge with another organism
GET    /v1/organisms/:slug/lineage         # ancestor tree
GET    /v1/organisms/:slug/fitness         # fitness history
GET    /v1/organisms/:slug/memory          # episodic memory
POST   /v1/organisms/:slug/feedback        # external feedback (e.g., lab result)
POST   /v1/organisms/:slug/extinct         # explicit extinction
```

**Phase 27 (Work Runtime) — new routes, new `services/work` (port 7012 proposed):**

```
POST   /v1/work/items                      # create work item
GET    /v1/work/items                      # list (paginated, filterable)
GET    /v1/work/items/:work_id             # retrieve
POST   /v1/work/items/:work_id/cancel      # cancel before completion
POST   /v1/work/workers                    # register worker
GET    /v1/work/workers                    # list workers
POST   /v1/work/workers/:worker_id/heartbeat
GET    /v1/work/workers/:worker_id/jobs    # assigned work items
POST   /v1/work/workers/:worker_id/results # submit result
GET    /v1/work/algorithms                 # registered algorithms
POST   /v1/work/algorithms                 # register new algorithm (admin)
```

**Phase 29 (OC Processor) — new package `@aigarth/oc-processor`:**

```ts
import { registerAsProcessor, onInvocation } from "@aigarth/oc-processor";

registerAsProcessor({
  processor_id: "aigarth-cloud-materials",
  capabilities: ["materials_simulation", "dft_relaxation"],
  fee_qubic: "1000000",  // per-invocation
  endpoint: "https://aigarth.cloud/oc/materials"
});

onInvocation(async (invocation) => {
  const workItem = mapToWorkItem(invocation);
  return await workRuntime.execute(workItem);
});
```

---

## 20. UI/UX Evolution

The conversation's "watch intelligence grow" UX is correct. The existing Garden (`/dashboard/garden`) is the right home.

**Phase 26.D — Garden Organism view (additive to Garden):**

```
┌────────────────────────────────────────────────────────────┐
│ Aigarth Cloud                    ORGANISM 042 — TireMind-17  │
├──────────────┬──────────────────────────────┬──────────────┤
│              │                              │              │
│  TISSUES     │     LIVE NEURAL FIELD       │  STATE       │
│              │                              │              │
│ ● Chemistry  │   · · ● · · · ●             │ Fitness 94.7 │
│ ● Mechanical │ · ● █ █ ● · · · ·           │ Gen 17       │
│ ● Thermal    │   ● █ █ █ ●                 │ Drift 0.03   │
│ ● Friction   │     · ● ·                   │              │
│ ● Aging      │                              │ Memory:      │
│ ● Manuf.     │                              │  1,247 epi.  │
│ ● Sustain.   │                              │              │
│              │                              │              │
├──────────────┴──────────────────────────────┴──────────────┤
│ COMPUTE                                                    │
│ CPU ████████████░░   GPU ██████░░░   OC ███████░░          │
│ Oracle █████░░░░░    Local ████████░░                       │
├────────────────────────────────────────────────────────────┤
│ EXPERIENCE STREAM                                          │
│ 14:32 mutation: tissue_swap(chemistry)                     │
│ 14:31 fitness 91.4 → 93.2 (friction +0.6)                  │
│ 14:29 rejected hypothesis: λ=0.42, recyclability < 0.4     │
│ 14:22 requested simulation: candidate TM-17-884219         │
│ 14:20 fork created: TireMind-18-0 (parent=17)              │
└────────────────────────────────────────────────────────────┘
```

The "LIVE NEURAL FIELD" is **art-directed**, not literal. It visualizes the organism's recent activity: nodes are tissues, edges are recent decisions, intensity is fitness delta. **It is not a Neuraxon internal diagram.** The point is to make the organism feel *alive* without claiming more than we can show.

**Key UX principles:**

- The user is **not training a model**. They are **growing an intelligence**.
- The fitness curve is **append-only and audited**. No retconning.
- The lineage is **visible**. Every fork is a sibling. Every mutation is logged.
- The compute breakdown shows **where the work went**: CPU, GPU, OC, Oracle, local.
- The user can **fork, pause, and reactivate** at any time.

**Marketing page update (Phase 17 Phase 1+):** the materials-science page should NOT change its headline until the first Organism has a measured fitness history. The existing Phase 17 marketing copy is correct as a *vision*; it is not a *product claim* until backed by data.

---

## 21. Phased Roadmap

This is a realistic, dep-ordered roadmap that does NOT skip the work required to earn the next phase.

| Phase | Name | User value | Technical deliverables | What NOT to build yet | Est. SP | Demo |
|---|---|---|---|---|---|---|
| **26** | Organism Primitive | Create, evolve, and lineage-track an intelligence | Organism schema, CRUD, lineage, fitness tracking, episodic memory, auto-mutation, marketplace listing; Garden Organism view | Work Runtime; OC processor; Neuraxon runtime; recombination v2 | ~10 | "TireMind v0 → v3" with measured fitness curve |
| **27** | Work Runtime (Tier 1, local) | Submit a work item; get a verified result | `services/work` (port 7012); worker registry; scheduler; verifier (replication + challenge + reputation); accountant; billing hook; first algorithm: `awork-1` (a generic numerical benchmark) | Federated runtime; OC processor; ZK proofs; TEE attestation | ~12 | "Aigarth Evolution Run #001" — 1,000 generations, 1M work items, measured cost |
| **28** | Federated Work Runtime (Tier 2) | Multiple Aigarth deployments share work | Signed work-item RPC; worker cross-registration; cross-deployment replication; reputation portability | OC processor; on-chain attestation; Neuraxon runtime | ~8 | "Aigarth Federation #001" — 3 deployments, 100 workers |
| **29** | Qubic OC Processor (Tier 3) | Qubic smart contracts invoke Aigarth for off-chain work | `@aigarth/oc-processor`; processor registration; invocation handler; 451/676 signature verification; result attestation on chain | Multiple workload types; cross-workload economics | ~6 | "Qubic smart contract invokes TireMind; Aigarth returns 3 DFT results; Qubic records the attestation" |
| **30** | Multiple Workload Types (Tier 4) | Run materials + video + climate + drugs on the same Work Runtime | Multi-workload scheduler; economic balancing; per-workload reputation; work-type-specific verification (DFT: replication, video: perceptual hash) | Universal Useful Work Protocol as consensus change; ZK proofs; cross-chain settlement | ~10 | "TireMind + ClimateMind + DrugMind running on the same Work Runtime" |
| **31** | Neuraxon Runtime Integration | A training recipe that targets a Neuraxon substrate | `@aigarth/neuraxon-runner` (sandboxed worker); `neuraxon_classifier` training recipe; runtime delegation protocol; GPU support via cuNxon | Production-scale Neuraxon; whole-organism Neuraxon replacement; structural plasticity | ~8 | "TireMind tissue v0 trained on Neuraxon vs transformer; benchmark delta" |

**Phases 32+ are research-only** and explicitly NOT in the engineering roadmap. They are in §23 (Research Backlog) only.

---

## 22. Engineering Backlog (concrete, immediate)

The First 10 tasks below (§29) are the immediate, next-sprint work. This section is the longer-term backlog, organized by area.

### 22.1 Organism service (Phase 26)

- `services/ann` schema migration: add `organisms`, `organism_memories`, `organism_fitness_history` tables
- Organism CRUD routes
- Lineage route (recursive parent walk)
- Genome mutation route (version bump + new genome)
- Recombination route (merge two genomes)
- Marketplace: Organism listing type (similar to tissue listing)
- Garden Organism view (UI)
- SDK: `client.organisms.{create, retrieve, fork, mutate, listDecisions, listLineage, getFitness}`

### 22.2 Work Runtime (Phase 27)

- `services/work` skeleton (port 7012)
- Work item schema, work item CRUD
- Worker registry, worker heartbeat
- Local Docker worker (`packages/worker-local` — a Python daemon)
- Scheduler: capability match + priority + FIFO
- Verifier: replication + challenge + reputation
- Accountant: per-work-item ledger, billing hook
- First algorithm: `awork-1` (deterministic numerical benchmark)

### 22.3 OC Processor (Phase 29)

- `@aigarth/oc-processor` package
- 451/676 signature verification
- Processor registration
- Invocation handler (work item → OC request, then OC request → work item)
- Result attestation (signed result back to Qubic)

### 22.4 Cross-cutting

- Organism + Work Runtime + OC need an audit log
- All three need an SSE progress stream (mirror Phase 19C.5)
- All three need predicted-vs-actual UI in Garden
- All three need internal-token gates for service-to-service calls

### 22.5 Documentation

- Update `docs/ARCHITECTURE.md` to include Organism + Work Runtime
- New ADR: "Organism Primitive" (parallel to ADR 003 for Trinary)
- New ADR: "Work Runtime" (parallel to ADR 001 for Intelligence Economy)
- New ADR: "OC Processor" (the correct Qubic integration model)
- Update `docs/PRD.md` §3 Users to add "Intelligence Growers" as a primary user

---

## 23. Research Backlog

Ranked by **Impact × Feasibility × Novelty**, with explicit **Research Risk** and **Dependency**.

| # | Question | Impact | Feasibility | Novelty | Research Risk | Dependency |
|---|---|---|---|---|---|---|
| 1 | Verifiable useful computation: can replication + challenge + reputation scale to 10,000 workers? | High | Medium | High | High — adversarial environment | Phase 27 |
| 2 | Can a Neuraxon substrate outperform a transformer on materials tasks at equivalent compute? | High | Medium | High | Medium — Neuraxon is research, not product | Phase 31 |
| 3 | Universal Useful Work Protocol: is there a consensus-safe way to schedule arbitrary useful work in a uPoW? | Very High | Low | Very High | Very High — requires Qubic protocol change | None near-term |
| 4 | Cross-workload economic balance: how do you prevent all workers from doing the most-rewarded work? | High | Medium | Medium | Medium | Phase 30 |
| 5 | Organism-level learning: does evolving the genome beat hand-curating it? | High | Low | Very High | Very High — needs years of experiments | Phase 26 |
| 6 | Multi-agent intelligence: can Organisms share tissue libraries without breaking fitness attribution? | Medium | Medium | High | Medium | Phase 30 |
| 7 | Scientific discovery bounties: are fixed-budget bounties a sustainable funding mechanism? | Medium | High | Medium | Low | Phase 30+ |
| 8 | Federated trust: can multiple Aigarth deployments share work without a central trust root? | High | Low | High | High | Phase 28 |
| 9 | Physical-world feedback: how do real lab experiments enter the organism's memory cleanly? | High | Medium | Medium | Medium | Phase 27 + Oracle |
| 10 | On-chain lineage attestation: is Qubic the right chain, or is a sidechain appropriate? | Medium | Medium | Low | Low | Phase 29 |

---

## 24. Risk Register

| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| 1 | **Neuraxon is not production-ready when we need it.** | High | High | Treat Neuraxon as a research target, not a dependency. Phase 31 is contingent. Use the existing ANN primitive for production work. |
| 2 | **Work Runtime is gamed by collusion.** | Medium | High | Reputation decoupled from creator; cross-deployment replication (Phase 28); challenge tasks; eventual ZK proofs in Tier 4. |
| 3 | **OC processor is DoS'd by malicious Qubic smart contracts.** | Medium | High | Rate limits per caller; fee requirements; circuit breaker (existing M4 pattern). |
| 4 | **Organism creators fake fitness history.** | Low | High | Fitness measured by platform, not declared; append-only log; on-chain lineage root in Phase 29. |
| 5 | **TireMind's DFT cost surprises users.** | High | High | Per-stage pre-flight estimates (already flagged in Phase 17 eval); per-stage credit deduction; MLIP surrogates. |
| 6 | **The Organism primitive is over-engineered before validating demand.** | Medium | High | Phase 26.A ships the schema + CRUD only. Auto-mutation (26.B) is gated on 26.A success. |
| 7 | **Qubic OC mainnet is later than July 29, 2026.** | Medium | Medium | Phase 29 is the LAST in the roadmap. All earlier phases work without OC. |
| 8 | **Worker reputation is hard to bootstrap.** | Medium | Medium | Start with `reputation = 1.0` for all workers; decay on disputes; grow on successful runs. |
| 9 | **The "Live Neural Field" UI overpromises.** | Medium | High | The UI is explicitly art-directed. Marketing copy must distinguish "visualization" from "literal internal state." |
| 10 | **K12 signature verification is still blocking.** | Confirmed | High | Already shared with Phase 16 (video) and Phase 17 (material science). Solving it once (~3 SP using `@noble/curves`) unlocks all three. |

---

## 25. Kill List

Things from the conversation that should **NOT** be built yet, or **NOT at all**.

| Idea | Verdict | Why |
|---|---|---|
| "Universal mining algorithm" | **KILL** | Misnomer. Qubic has one algorithm at a time. The "Universal Useful Work Protocol" idea is a research project, not a Qubic integration. |
| "Dynamic switching between mining algorithms on the network" | **KILL** | Not Qubic's design. Out of Aigarth's control. |
| "Outsourced Computing as a compute marketplace for Aigarth" | **REFRAME** | OC is outbound, not inbound. Aigarth is the *processor*, not the *renter*. |
| "Replace the entire Aigarth ANN primitive with Neuraxon" | **KILL** | Neuraxon is not production-ready. The Trinary envelope is the right substrate. |
| "Build a 'Google Play Store for artificial organisms'" | **KILL** | Wrong scope. Aigarth marketplace is for Aigarth primitives, not third-party apps. |
| "Aigarth invents a new tire compound" | **KILL** | Not a deliverable. The deliverable is the *loop* that produces a hypothesis. |
| "LLM-in-the-loop is the only way to do materials science" | **KILL** | The fitness function is deterministic. The LLM is a *hint*, not the substrate. |
| "Real-time video generation with the same Organism architecture" | **DEFER** | Video is secondary. Materials science is the flagship. |
| "Multi-organism symbiosis (organisms share tissues)" | **DEFER** | Phase 30+ research. Premature now. |
| "On-chain lineage attestation in Phase 26" | **DEFER** | Phase 29. The append-only log is sufficient in 26. |
| "Staking + slashing for workers" | **DEFER** | Requires Qubic-side stake. Phase 30+ research. |
| "TEE attestation for workers" | **DEFER** | Phase 30+. Replication + challenge is sufficient for v1. |
| "ZK proofs for arbitrary work" | **DEFER** | Phase 30+ research. |
| "Replace Trinary envelope with Neuraxon-native envelope" | **KILL** | The Trinary envelope is the contract. Neuraxon can be a *backend*, not a replacement. |

---

## 26. Success Metrics

Phase 26 (Organism Primitive):

- [ ] 1 published Organism on the marketplace
- [ ] 100 generations of TireMind-001 with measured fitness history
- [ ] First documented fork (parent → child)
- [ ] First user who is NOT the engineering team using the Organism UI

Phase 27 (Work Runtime):

- [ ] 1M work items processed
- [ ] 95% replication agreement rate
- [ ] < 0.1% dispute rate
- [ ] First algorithm (`awork-1`) verified end-to-end

Phase 28 (Federated):

- [ ] 3 Aigarth deployments in federation
- [ ] Work item successfully executed across deployments
- [ ] Reputation portability demonstrated

Phase 29 (OC):

- [ ] Aigarth registered as a Qubic OC processor
- [ ] 1 OC invocation from a Qubic smart contract successfully executed
- [ ] Result attested on chain

Phase 30+ (Multi-workload):

- [ ] 3 distinct workload types (materials, video, climate) on one Work Runtime
- [ ] Cross-workload economic balance demonstrated
- [ ] First non-materials Organism published

---

## 27. Demonstration Strategy

**Demo 1: "TireMind v0 → v3" (Phase 26.D, ~2h after 26.A ships)**
- Manually create TireMind with 7 tissues, run 10 generations
- Show fitness curve, mutation log, lineage
- **Claim:** "We can measure intelligence growing."
- **Honesty:** No auto-mutation yet; no Work Runtime; the simulator is mocked.

**Demo 2: "Aigarth Evolution Run #001" (Phase 27, ~1 day after 27 ships)**
- 1,000 generations of TireMind on a constrained candidate space
- 1M work items, replication verified
- Show compute consumed, best fitness, generation diversity, cost per discovery
- **Claim:** "Aigarth can run a useful-work loop at scale."
- **Honesty:** Local only; no federation; no OC.

**Demo 3: "Qubic calls Aigarth" (Phase 29)**
- Deploy a Qubic smart contract that invokes TireMind
- Show 3 DFT results returned; show Qubic attestation
- **Claim:** "Qubic's OC works end-to-end with Aigarth."
- **Honesty:** Single workload, single processor, no economic balancing.

**Demo 4: "The first promising tire candidate" (Phase 30+)**
- 10,000 generations of TireMind with MLIP surrogates + replication
- Top candidate: composition, predicted properties, fitness, uncertainty
- **Claim:** "Aigarth produced a hypothesis worth testing in a real lab."
- **Honesty:** A *hypothesis*, not a product. Real lab validation is the next step.

**The killer demo is NOT a chatbot. The killer demo is a candidate material, with a measured fitness curve, that a human researcher decides is worth testing.**

---

## 28. THE AIGARTH THESIS

**Aigarth is a platform for growing useful computational intelligences.**

Aigarth is not an ANN marketplace. ANNs are cells. Aigarth is the laboratory, the nervous system, and the ecosystem that lets cells compose into tissues, tissues compose into organisms, and organisms grow, evolve, and earn their place.

Aigarth is not a "compute rental marketplace." Workers contribute to scheduled work, not rented machines. The Work Runtime is the substrate for distributed cognition, not the substrate for cloud VMs.

Aigarth is not "Qubic's UI." Aigarth is the substrate for useful work that Qubic invokes via Outsourced Computations. Qubic is the trust root; Aigarth is the compute.

Aigarth does not invent general-purpose AI from scratch. It uses Neuraxon 2.0 as one possible substrate (when Neuraxon is production-ready), conventional ANNs as another, transformers as another, the Trinary envelope as the universal protocol across all of them. The substrate is a choice; the protocol is the contract.

Aigarth's first organism is TireMind-001: a research organism for non-pneumatic, recyclable tire materials. The organism runs distributed DFT simulations, evolves its hypotheses, and produces a candidate worth testing in a real lab. The killer demo is not a chatbot; the killer demo is a candidate material with a measured fitness curve.

Aigarth's marketplace is for Aigarth primitives: ANNs, Tissues, Organisms, work items. Not third-party apps. The lineage of an Organism — parent, child, fitness, generation — is the marketplace's most important surface.

Aigarth's economics reward *useful intelligence creation*, not speculation. Rewards flow from creators to workers; nothing is minted. Discoveries are funded from a fixed budget. On-chain attestation comes last, not first.

Aigarth evolves. The current platform is at Phase 24, with Trinary Intelligence Layer shipped, training orchestration in place, datasets first-class, and the Qubic on-chain substrate in test. The next phase is the Organism primitive. The phase after that is the Work Runtime. The phase after that is Qubic OC integration. The phases after that are research.

Aigarth is built by a small team, on a tight cadence, with documented decisions, real test coverage, and an obsession with not overpromising. Every phase ships a demo. Every claim is backed by a measured number. Every "neural network" in the marketing copy is, in the codebase, a specific, versioned, signable, auditable thing.

**That is Aigarth Cloud. That is what we are building.**

---

## 29. THE FIRST 10 ENGINEERING TASKS

These are concrete, scoped, and can begin **immediately** without waiting for another strategic document. Each is sized to fit one sprint (the recent cadence is 2-3h per SP). All 10 = ~25 SP, which is roughly 2-3 sprints at the recent velocity.

### Task 1 — Schema migration for `organisms` (Phase 26.A) — 1 SP

**File:** `services/ann/drizzle/NNNN_organism_init.sql`
**Work:**
- Add `organisms`, `organism_memories`, `organism_fitness_history` tables per §18
- Add `drizzle/meta/_journal.json` entry
- Run migration on local DB
- 5 vitest cases (insert, soft-delete, lineage query)
**Acceptance:** `pnpm --filter @aigarth/ann test` green; migration applies cleanly.
**Do NOT:** touch the existing ANN schema; add only.

### Task 2 — Organism CRUD routes (Phase 26.A) — 2 SP

**File:** `services/ann/src/routes/organisms.ts` + `services/ann/src/services/organisms.ts`
**Work:**
- `POST /v1/organisms` (create draft)
- `GET /v1/organisms` (list public, paginated)
- `GET /v1/organisms/:slug`
- `PATCH /v1/organisms/:slug` (creator only)
- `POST /v1/organisms/:slug/activate`
- `POST /v1/organisms/:slug/pause`
- Zod schemas; ownership checks; rate limit; audit log
- 15 vitest cases
**Acceptance:** routes green; SDK resource method `client.organisms.create` works.
**Do NOT:** add mutation, recombination, or memory endpoints — those are Tasks 3 and 4.

### Task 3 — Lineage and fitness history routes (Phase 26.A) — 1.5 SP

**File:** `services/ann/src/routes/organisms.ts` (extend) + `services/ann/src/services/lineage.ts`
**Work:**
- `GET /v1/organisms/:slug/lineage` — recursive parent walk; returns tree as JSON
- `GET /v1/organisms/:slug/fitness` — fitness history with pagination
- `POST /v1/organisms/:slug/fork` — create child (parentId set, generation = parent.generation + 1)
- 10 vitest cases (deep lineage, cycles impossible by construction, fork idempotency)
**Acceptance:** lineage tree of 5-generation organism returned correctly; fork creates a new organism with correct parent/root.
**Do NOT:** add auto-mutation yet.

### Task 4 — Episodic memory + manual mutation (Phase 26.A → 26.B bridge) — 2 SP

**File:** `services/ann/src/routes/organisms.ts` (extend) + `services/ann/src/services/memory.ts` + `services/ann/src/services/mutation.ts`
**Work:**
- `GET /v1/organisms/:slug/memory?kind=episodic&since=...` — episodic memory
- `POST /v1/organisms/:slug/memory` — write an episodic memory entry (signed by tissue or worker)
- `POST /v1/organisms/:slug/mutate` — manual genome mutation; bumps genome.version
- 12 vitest cases
**Acceptance:** an Organism can be manually mutated, and the memory log is auditable.
**Do NOT:** add auto-mutation (26.B); this is the manual primitive.

### Task 5 — Organism marketplace listing (Phase 26.C) — 2 SP

**File:** `services/marketplace/src/routes/organism-listings.ts` + `services/marketplace/src/services/organism-listings.ts`
**Work:**
- `POST /v1/marketplace/organism-listings` — wrap an Organism in a listing
- `GET /v1/marketplace/organism-listings` — list
- `GET /v1/marketplace/organism-listings/:id` — retrieve with lineage preview
- Per-Organism analytics: `total_forks`, `lineage_size`, `fitness_max`
- Pricing model: per-fork fee in QUBIC (NOT per-decision — Organism calls are not per-decision)
- Billing hook to `services/billing` (similar to tissue usage events)
- 10 vitest cases
**Acceptance:** an Organism can be listed; a fork is billable; analytics roll up.
**Do NOT:** add the `services/aigarthpool` stake integration yet — that's Phase 20+'s existing pattern, just port it.

### Task 6 — Garden Organism view (Phase 26.D, UI) — 2 SP

**File:** `apps/web/app/dashboard/garden/organism/[slug]/page.tsx` + `apps/web/components/organism/`
**Work:**
- Organism header (name, kind, generation, fitness, lineage root)
- Tissues grid (existing tissue cards, with the Organism context)
- Fitness curve (chart from `/v1/organisms/:slug/fitness`)
- Experience stream (SSE from `/v1/organisms/:slug/experience-stream` — a new SSE route)
- Lineage breadcrumb (parent → self)
- "Live neural field" art-directed visualization (CSS-only, no live data binding — explicit disclaimer)
- "Fork" and "Mutate" buttons (creator only)
**Acceptance:** viewing an Organism shows the full picture; forking creates a new lineage child.
**Do NOT:** claim the visualization is internal state. Add a "This is an art-directed visualization" caption.

### Task 7 — Work Runtime skeleton (Phase 27.A) — 2 SP

**File:** `services/work/` (new service, port 7012)
**Work:**
- `services/work` skeleton (Fastify + Drizzle + JWT + NATS, same shape as `services/tissue`)
- Schema: `work_items`, `workers`, `work_results`, `worker_challenges`, `work_audit`
- `POST /v1/work/items` (create)
- `GET /v1/work/items` (list, paginated, filterable)
- `GET /v1/work/items/:work_id` (retrieve)
- `POST /v1/work/workers` (register)
- `GET /v1/work/workers` (list)
- `POST /v1/work/workers/:worker_id/heartbeat`
- 15 vitest cases
- `pnpm dev` brings it up alongside the others
**Acceptance:** a work item can be created and a worker registered; the scheduler (Task 8) will use these.
**Do NOT:** add the scheduler, verifier, or accountant yet — those are Tasks 8-10.

### Task 8 — Work Runtime scheduler (Phase 27.B) — 2 SP

**File:** `services/work/src/services/scheduler.ts` + `services/work/src/workers/assignment.ts`
**Work:**
- Background worker (`workers/assignment.ts`) polls every 5s
- Matches queued work items to available workers by capability (CPU, GPU, algorithm, region)
- Assigns with a 30s lease; on heartbeat, extends; on lease expiry, returns to queue
- Priority: explicit `priority` field > FIFO
- Per-worker concurrency cap (default 2)
- 20 vitest cases (capability match, lease expiry, priority preemption, idempotency)
**Acceptance:** 100 work items get scheduled to 10 workers correctly; leases expire and items re-queue.
**Do NOT:** add the verifier yet — that's Task 9.

### Task 9 — Work Runtime verifier + accountant (Phase 27.C) — 2 SP

**File:** `services/work/src/services/verifier.ts` + `services/work/src/services/accountant.ts`
**Work:**
- Verifier: replication (3 workers must agree on `result.payload_hash`); challenge tasks (1/100 spot checks); reputation (rolling 30d)
- Accountant: per-work-item cost finalization; per-worker ledger; billing hook (`WorkUsageEvent` to `services/billing`)
- `POST /v1/work/items/:work_id/result` — submit result
- `POST /v1/work/items/:work_id/dispute` — mark disputed
- 25 vitest cases (replication agreement/disagreement, challenge pass/fail, reputation decay, dispute resolution)
**Acceptance:** a 3-worker replicated work item is verified; a failed replication marks the work item disputed; the worker's reputation decays.
**Do NOT:** add ZK proofs or TEE attestation.

### Task 10 — First algorithm: `awork-1` + TireMind scaffolding (Phase 27.D + TireMind 0.1) — 1.5 SP

**File:** `packages/awork-1/` (new) + `services/work/src/algorithms/awork-1.ts` + `docs/proposals/tiremind-001.md` (companion)
**Work:**
- `awork-1`: a deterministic numerical benchmark (e.g., matrix multiplication with a known answer, or a simple PDE solve). Containerized; reproducible.
- `services/work` algorithm registry: register `awork-1` as the first algorithm
- TireMind-001 companion doc: link to this PEP; document the 7 tissues, the fitness function, the data sources, the cost story
- 10 vitest cases (algorithm registration, deterministic verification, container build, container run)
**Acceptance:** a work item with `algorithm.name = "awork-1"` runs end-to-end on 3 workers, replication agrees, and the result is verified.
**Do NOT:** add the Tissue integration yet. `awork-1` is a standalone numerical benchmark. TireMind is documented but not running.

---

## 30. Sign-off

This PEP proposes:

- An evolution, not a rewrite. Everything shipped (Phases 0-24) is preserved.
- One genuinely new primitive (Organism) on top of the existing Trinary Intelligence Layer.
- One new service (Work Runtime) for distributed, verified work items.
- A correct understanding of Qubic OC (outbound, not inbound) and BPP-9000 (current uPoW, not a precedent for a marketplace).
- A phased, dep-ordered roadmap that does not skip the work required to earn each next phase.
- A clear kill list to prevent overreach.
- Ten engineering tasks that can begin immediately.

**Reviewers:** Engineering, Product, Founders
**Next action:** ADR 005 — Organism Primitive (parallel to ADR 003 for Trinary)
**Decision needed:** approve Phase 26 (Organism Primitive, 10 SP) and Phase 27 (Work Runtime, 12 SP) as the next two phases; defer Phases 28-31 pending Phase 27 success.

---

## Appendix A — Verified external references (2026-08-10)

- Neuraxon 2.0 open-sourced: <https://github.com/DavidVivancos/Neuraxon>
- Qubic All-Hands Recap (July 23, 2026): <https://qubic.org/blog-detail/qubic-all-hands-recap-july-23-2026>
- Qubic OC Tech-on-Deck AMA (June 2026): <https://qubic.org/blog-detail/qubic-outsourced-computation-tech-on-deck-ama-june-2026>
- Qubic Three Pillars (smart contracts + OMs + OC): <https://qubic.org/blog-detail/qubic-three-pillars-smart-contracts-oracle-machines-outsourced-computation>
- Qubic Oracle Machines production: <https://qubic.org/blog-detail/qubic-all-hands-recap-april-30-2026>
- Qubic OC shipped to mainnet (Epoch 223): <https://qubic.org/blog-detail/qubic-all-hands-recap-july-23-2026>
- BPP-9000 activates at Epoch 224: <https://qubic.org/blog-detail/qubic-all-hands-recap-july-23-2026>
- CuNxon CUDA library (May 2026): <https://qubic.org/blog-detail/qubic-all-hands-recap-may-14-2026>
- Neuraxon 2.0 peer-reviewed at ICMLT Berlin (May 20-22, 2026): <https://qubic.org/blog-detail/qubic-all-hands-recap-may-14-2026>
- Neuraxon 2.0 accepted at AGI-26: <https://ourcryptotalk.com/news/qubic-neuraxon-accepted-agi-26-conference>
- Neuraxon 2.0 ARC-AGI-3 = 0.21% (July 22, 2026): <https://qubic.org/blog-detail/qubic-all-hands-recap-july-23-2026>

## Appendix B — Aigarth Cloud internal references

- `docs/ARCHITECTURE.md` — 16-phase service map
- `docs/PRD.md` — Product Requirements (vision, users, surfaces, metrics)
- `docs/DATA-MODEL.md` — 82+ domain objects
- `docs/ROADMAP.md` — phase-by-phase build plan; Phases 0-19 + 20-24 (current)
- `docs/architecture-decisions/003-trinary-protocol-v1.md` — ADR 003 (Trinary Intelligence Layer, shipped)
- `docs/architecture-decisions/004-dataset-licensing.md` — ADR 004 (Datasets)
- `docs/launches/phase-18-trinary-launch.md` — Phase 18 launch summary
- `docs/use-cases/material-science-eval.md` — Phase 17 architecture evaluation
- `docs/deliveries/phase-N-delivery.md` — per-phase delivery reports (Phases 0-24)
- `services/tissue` — port 7008, the existing Tissue primitive
- `services/training` — port 7011, training orchestrator
- `services/dataset` — port 7009, first-class datasets
- `services/compute` — port 7003, Aigarth Core scheduler
- `services/ann` — port 7006, ANN registry + retrain + trinary
- `services/aigarthpool` — QPI contract + simulator (Phase 20)
- `packages/trinary` — `@aigarth/trinary` (signed envelope, 4 consensus policies)
- `packages/aigarthpool` — `@aigarth/aigarthpool` (simulator + RPC client)
