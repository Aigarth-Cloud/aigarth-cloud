# Aigarth Cloud Evolution PEP — v0.2

## From Neural Networks to Evolving Useful Intelligence

**Document type:** Product Evolution Proposal (PEP)
**Version:** 0.2 (Research Draft, superprompt-aligned)
**Status:** Architecture review / experimental
**Date:** 2026-08-11
**Supersedes:** v0.1 (2026-08-10) — `aigarth-cloud-evolution-pep.md`
**Author:** Aigarth Cloud Architecture, Research, Product Evolution & Engineering Team
**Reviewers:** Engineering, Product, Founders
**Builds on:** v0.1 PEP, Phases 0-24, ADR 003 (Trinary Protocol), ADR 004 (Datasets), Phase 17 (Material Science), Phase 19 (Training + Feedback Loops), Neuraxon v2.0 paper, Qubic public roadmap (Feb-Aug 2026)

---

## 0. Reading order

- **Skim:** §1 Falsification Audit, §2 Executive Summary, §3 Current Architecture, §28 Roadmap, §32 Final Thesis, §33 First 10 Tasks.
- **Read for engineering:** §3, §5 (Object Model), §6 (Organism), §11 (Work Unit), §15 (Verification), §18 (Proof Lab), §21 (Baselines), §33 (Tasks).
- **ADRs / code reviews:** §26 (Security), §27 (Economics), §29 (Kill List), §30 (Data Provenance).

**Companion files** (preserved from v0.1, still canonical):
- `aigarth-cloud-evolution-pep.md` — v0.1 long-form, ~38 min
- `aigarth-cloud-evolution-pep-summary.md` — 8-min executive summary
- `aigarth-cloud-evolution-pep-roadmap-impact.md` — phase mapping

**v0.2 vs v0.1 delta:** v0.2 reorganises v0.1 into the 30-section superprompt structure, adds Proof Lab (§18), Proof Test Suite (§19), Public Proof Lab UX (§23), Capability Card (§24), Data Provenance (§25), Baselines (§20), Ultimate Proof (§22), Worker Model (§12), Active Experiment Selection (§10), Adaptation Equation (§8), Discovery (§9), Generalized Work Unit (§11), Core Object Model (§5), Foundational Optimization (§7), plus a Final Thesis (§32) that maps the boxed equation. File paths in §33 are verified against the current code on 2026-08-11.

---

## 1. Falsification Audit

**The first responsibility of the team is to falsify the thesis.** This section enumerates what the superprompt claims, what the codebase actually does, and where the thesis may break.

| Superprompt claim | Codebase reality (2026-08-11) | Class | Verdict |
|---|---|---|---|
| "Aigarth has no generalized learning architecture" | Trinary Intelligence Layer shipped (Phase 18, 222 tests, 100% coverage on `@aigarth/trinary`); `services/tissue` on port 7008 composes ANNs into signed decisions; Phase 19 added `trinary_classifier` training recipe, real LLM invocation in `/decide`, decision outcome tracking, auto-retrain, A/B shadow deployment | FACT | The generalised substrate exists in protocol form. The adaptive substrate (Organism) does not. |
| "Build a Tissue primitive" | Shipped as `services/tissue` (Phase 18D) with 5 consensus policies (`majority`, `unanimous`, `any`, `veto_aware`, `short_circuit`), HMAC-signed envelopes, decision history, marketplace counter | FACT | Already done. The Organism primitive must *extend* Tissue, not replace it. |
| "Neuraxon is the substrate" | Zero Neuraxon imports in any Aigarth service. Per ADR 003 §1: "Neuraxon v2.0 is a research paper (not deployed)… Aigarth is described in §8 of the paper as a separate framework that would be hybridized with Neuraxons in a 'Neuraxon-ITU.' That hybridization has not happened." | FACT | Misframed. Trinary envelope is Neuraxon-*inspired*; it is not Neuraxon-*built*. Treat Neuraxon as a research target, not a dependency. |
| "Qubic OC is the muscles / external organs" | OC is *outbound*: smart contracts send authorized instructions to external systems; 451/676 computor signature threshold is the trust primitive. Aigarth would be a *target* of OC, not a *consumer*. | FACT | Direction reversed. Aigarth registers as an OC *processor*; Qubic calls Aigarth. |
| "BPP-9000 is heterogeneous mining" | BPP-9000 is the current uPoW (Epoch 224, late July 2026) — one algorithm, one dataset, one objective, one reward function. Qubic's only "heterogeneous" model is BPP-9000 + DOGE/Scrypt in parallel. | FACT | Not a marketplace precedent. The "Universal Useful Work Protocol" is an Aigarth R&D idea, not a Qubic capability. |
| "Materials Brain is new" | Phase 17 8-ANN coordinator (Research Director, Literature, Simulation, Physics, Design, Optimization, Experiment, Validation) designed and evaluated; ~50-100× cost multiplier vs video, DFT dominates at 87% of a ~52 QU workflow | FACT | Already designed. Build on Phase 17, do not duplicate. |
| "Build an Organism primitive" | Not started. Grep returns zero matches for `organism` in any service or apps. | PROPOSED | Genuinely new layer. v0.1 §7 + this v0.2 §6. |
| "Build a generalised task abstraction T = (I,A,O,K,V,R)" | Partial. `services/compute` has a job runner (`src/services/jobs.ts`, `src/workers/job-monitor.ts`) with reservations, escrow, qearn-lock. But there is no general `work_items` table, no per-algorithm container, no replication verification, no per-worker reputation. | PROPOSED | New service `services/work` (proposed port 7012). v0.1 §9 + this v0.2 §11-§15. |
| "Build a Proof Lab" | Not started. No `proof` or `organism` files under `apps/web/`. The dashboard has `material-science.tsx` and `tissues.tsx` pages but no Proof Lab. | PROPOSED | New surface. This v0.2 §18, §23. |
| "Fork, evolve, recombine organisms" | Not started. | PROPOSED | Phase 26.A-C. |
| "A database record changing is not sufficient for adaptation" | Correct. v0.1 §7.4 is explicit: Tissue is stateless per call; Organism must be stateful across experiences. | VALIDATED | The new primitive must hold mutable genome + episodic memory + lineage, not just audit logs. |
| "Baselines are mandatory" | New rule. No baseline framework exists today. | PROPOSED | This v0.2 §20. |
| "ZK / TEE / staking in v1" | Should not ship in v1. Replication + challenge + reputation catches the obvious attacks. | SPECULATIVE | v0.1 §11 + this v0.2 §15 defer. |

**Where the thesis may break (ranked):**

1. **The Organism primitive is over-engineered before validating demand.** Mitigation: ship 26.A (CRUD) before 26.B (auto-mutation). v0.1 §24 risk #6.
2. **The Work Runtime is gamed by collusion.** Mitigation: replication across deployments (Phase 28), challenge tasks, eventual ZK. v0.1 §24 risk #2.
3. **TireMind's DFT cost surprises users.** Mitigation: per-stage pre-flight estimates (Phase 17 eval §1), per-stage credit deduction, MLIP surrogates. v0.1 §24 risk #5.
4. **Neuraxon never reaches production.** Mitigation: Neuraxon is not on the critical path. Phase 31 is contingent. v0.1 §24 risk #1.
5. **The "Live Neural Field" UI overpromises.** Mitigation: explicit "art-directed visualization" caption; no live data binding. v0.1 §24 risk #9.
6. **K12 signature verification is still blocking.** Confirmed; ~3 SP to solve using `@noble/curves`. Shared with Phase 16 (video) and Phase 17 (material). v0.1 §24 risk #10.

---

## 2. Executive Summary

The superprompt asks whether Aigarth Cloud can become "progressively more useful" by combining adaptive neural substrates, persistent memory, evolutionary mechanisms, distributed heterogeneous computation, external information, verification, and objective-driven experimentation. **Aigarth has the right foundations; it does not yet have the adaptive layer.**

**What is true (FACT):** The Trinary Intelligence Layer (Phase 18) is live. Training orchestration (Phase 19) is real. AigarthPool (Phase 20) is on-chain. Phase 17 designed the Material Science 8-ANN coordinator. The Trinary envelope is the universal protocol; Neuraxon is *not* integrated.

**What is new (PROPOSED):** the **Organism** primitive (genome, environment, fitness, lineage, episodic memory) on top of the existing Trinary layer, and the **Work Runtime** (`services/work`, port 7012) for distributed, verified, paid-for work items. Together they let the platform run the "experience → learning → hypothesis → compute → verification → adaptation" loop in production.

**What we kill (KILL/DEFER):** "Universal mining algorithm" (misnomer), "OC as a marketplace" (it is outbound), "replace ANN with Neuraxon", "Google Play Store for organisms" (wrong scope), "ZK / TEE / staking in v1".

**The Aigarth Thesis:** *Aigarth is a platform for growing useful computational intelligences.* The killer demo is not a chatbot; it is a candidate material with a measured fitness curve.

---

## 3. Current Architecture Audit (2026-08-11)

**Service map (verified):**

| Port | Service | Status | Purpose |
|---|---|---|---|
| 7001 | `services/identity` | Live | JWT, wallets, orgs, MFA, audit |
| 7002 | `services/qubic` | Live | Wallet, AigarthPool watcher, governance, Qearn, rate limits, circuit breaker |
| 7003 | `services/compute` | Live | Regions, clusters, reservations, jobs, escrow, qearn-lock, USD price oracle |
| 7004 | `services/gateway` | Live | OpenAI-compatible API; trinary `response_format` opt-in |
| 7005 | `services/billing` | Live | Subscriptions, invoices, payments, credits, tissue usage events |
| 7006 | `services/ann` | Live | Registry, versions, marketplace hooks, retrain, trinary `/decide`, AigarthPool stake, decision outcomes, auto-retrain, A/B shadow, predicted-vs-actual |
| 7007 | `services/marketplace` | Live | Listings, offers, purchases, auctions, tissue listings |
| 7008 | `services/tissue` | Live | Tissue registry, `/v1/tissues/:slug/decide`, 5 consensus policies, licenses, decision history, billing hook |
| 7009 | `services/dataset` | Live | First-class datasets, schema sniff, public catalog, connectors, SDK resource |
| 7010 | `services/economy` | Live | Qearn watcher, splits, settleRun |
| 7011 | `services/training` | Live | 5 training recipes (incl. `trinary_classifier`), real LLM invocation, compute bridge (stub+http), SSE progress, auto-publish |
| 7012 (proposed) | `services/work` | **NOT BUILT** | Work Runtime, workers, scheduler, verifier, accountant — Phase 27 |
| — | `services/aigarthpool` | Live (5/6) | QPI contract + TypeScript simulator, 30/60/10 split |

**Package map (verified):** `@aigarth/sdk`, `@aigarth/trinary` (100% coverage, 90+ tests), `@aigarth/aigarthpool`, `@aigarth/config`, `@aigarth/observability`, `@aigarth/ui`, `@aigarth/utils`.

**Trinary Intelligence Layer (Phase 18, shipped):** Every `/decide` on `services/ann` returns a signed `IntentEnvelope` (`state ∈ {-1, 0, +1}`, `confidence`, `authority`, `reasoning`, `reversibility`, `time_horizon`, HMAC-SHA-256 signature, `schema_version: 1`). `services/tissue` composes ANNs into a single decision using 5 policies. The `@aigarth/trinary` package is Neuraxon-*inspired* — not Neuraxon-*built* — and can adopt a Neuraxon runtime later without protocol changes (ADR 003 §6).

**Training & feedback (Phase 19, ~92%):** 5 recipes (`mlp_classifier`, `cnn_classifier`, `text_classifier`, `gradient_boost_tabular`, **`trinary_classifier`**), real LLM in `/decide`, compute bridge, SSE progress, auto-publish to ANN, decision outcomes (`ann_decision_outcomes` table), auto-retrain trigger, A/B shadow deployment, predicted-vs-actual UI in `/dashboard/garden`.

**What is NOT in the repo:**

| Gap | Source |
|---|---|
| Neuraxon runtime in any service | ADR 003 §6 |
| Organism primitive | This PEP §6 |
| Work Runtime / `services/work` | This PEP §11-§15 |
| Proof Lab public page | This PEP §18 |
| Capability Card | This PEP §24 |
| Functional Materials Science environment (only marketing page + eval exist; 5 of 13 backlog tasks done) | Phase 17 |
| Functional Video Generation environment (only marketing page exists) | Phase 17 sister use case |

---

## 4. Neuraxon Technical Assessment

**Status (verified 2026-08-11):** Open-sourced on GitHub (`DavidVivancos/Neuraxon`); first commit ~Feb 2026; latest commit May 28, 2026. Trinary, continuous-time, bio-inspired. `cuNxon` CUDA library released May 2026. ARC-AGI-3 score: 0.21% (July 22, 2026, doubled from 0.13%). Peer-reviewed at ICMLT Berlin (May 20-22, 2026); accepted at AGI-26.

**Aigarth's relationship to Neuraxon (verified):** Per ADR 003, the trinary state lives at the **ANN boundary**, not the neuron level. Every ANN in the live platform today returns either an OpenAI-shaped text response or a label. The trinary envelope is the *protocol*, not the *runtime*. **No Aigarth service imports Neuraxon. No training recipe targets a Neuraxon substrate.** Grep for `neuraxon` returns only docs, ADR 003, and the `trinary` package's Neuraxon-influenced design notes.

| Dimension | Assessment |
|---|---|
| Maturity | EXPERIMENTAL. Research framework, peer-reviewed, open source, not production-ready. |
| CPU capability | CONFIRMED. Neuraxon 2.0 doubles ARC-AGI-3 on CPU alone. |
| CUDA capability | CONFIRMED via cuNxon (May 2026). |
| Licensing | Open source. Compatible with Aigarth's open-science stance. |
| Integration into Aigarth | NOT STARTED. |
| Recommended role | Add `neuraxon_classifier` recipe in `services/training` (Phase 31) that delegates to a Neuraxon runtime in a sandboxed worker. Until then, Neuraxon is a research target, not a dependency. |

**Conclusion:** Do not assume Neuraxon is the substrate. Treat it as one of several possible substrates (alongside conventional ANNs, transformers, the existing Trinary envelope protocol).

---

## 5. Core Aigarth Object Model

The first-class primitives. Each is classified as **runtime abstraction**, **persistent entity**, **API**, **event**, **metadata**, or **derived state**.

| Primitive | Class | Lives in | Notes |
|---|---|---|---|
| `Organism` | persistent entity | `services/ann` (new tables) | Stateful, lineaged, fitness-scored (Phase 26) |
| `Genome` | persistent entity (JSONB) | `organisms.genome` | Mutable, versioned, evolvable |
| `Tissue` | persistent entity + runtime | `services/tissue` | Composes ANNs into a signed decision (Phase 18D, live) |
| `Neuron` | derived state | ANN internal weights | Not first-class; recorded in `ann_versions.weights_hash` |
| `Synapse` | derived state | ANN internal topology | Not first-class; topology changes logged in `ann_versions` |
| `Memory` | persistent entity | `organism_memories` (new) | short-term, long-term, episodic |
| `Environment` | persistent entity (JSONB) | `organisms.environment` | Where the organism lives; input streams + oracle subs |
| `Sensor` | runtime abstraction | tissue input + oracle subscriptions | Pulls from environment |
| `Actuator` | runtime abstraction | tissue output + work-item creation | Pushes to environment |
| `Objective` | persistent entity (JSONB) | `organisms.objective` | Fitness function + weights + thresholds |
| `Constraint` | persistent entity (JSONB) | `organisms.objective.thresholds` | min fitness, max stall generations |
| `Fitness` | persistent entity | `organisms.fitness` + `organism_fitness_history` | Measured, not declared |
| `Experience` | event + persistent entity | `organism_memories` (episodic) | What was tried, what happened |
| `Experiment` | event + persistent entity | `organism_memories` + `work_items` | The work-item-driven exploration loop |
| `Task` (= Work Item) | persistent entity | `work_items` (new in `services/work`) | The generalised unit of computation |
| `Worker` | persistent entity + runtime | `workers` (new in `services/work`) | Capability-tagged; reputation-scored |
| `Verifier` | runtime | `services/work/src/services/verifier.ts` | Replication + challenge + reputation |
| `Lineage` | persistent entity (FK chain) | `organisms.parent_id` / `root_id` | Append-only |
| `Mutation` | event | `organism_memories` | Bumps `genome.version` |
| `Evolution` | event chain | lineage + fitness history | Not a primitive; an emergent property of mutation + selection over generations |
| `Dataset` | persistent entity | `services/dataset` (Phase 19B, live) | Versioned, schema-sniffed, connector-aware |
| `Simulation` | runtime | work item, `algorithm.container` | Executed by a worker |
| `Oracle` | runtime + persistent entity | `services/qubic` OM subscriptions (live since Feb 11, 2026) | TTL-cached, signed |

**Rule:** a primitive is a *database entity* only if it needs to be queryable across requests. Runtime abstractions (Sensor, Actuator, Verifier) are not entities; they are service-internal code paths.

---

## 6. Organism

The genuinely new primitive. The superprompt's definition:

```
O = (G, N, M, E, S, A, Φ, H)
```

where `G` = genome, `N` = neural substrate, `M` = memory, `E` = environment, `S` = sensors, `A` = actuators, `Φ` = objectives/fitness, `H` = historical experience.

**v0.2 implementation in `services/ann`** (additive; no migration to existing schema):

```ts
// services/ann/src/db/schema.ts — additively extend
organisms (
  id uuid PK,
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  creator_id uuid NOT NULL,           -- ref users in services/identity
  visibility text CHECK IN ('public','unlisted','private'),
  status text CHECK IN ('draft','active','paused','deprecated','extinct'),
  kind text,                          -- 'researcher' | 'optimizer' | 'predictor' | 'synthesist' | 'custom'
  genome jsonb NOT NULL,              -- {tissues, llm_hint, simulator, external_model, mutation, recombination}
  environment jsonb NOT NULL,         -- {type, config, input_streams, oracle_subs, feedback_channels}
  objective jsonb NOT NULL,           -- {fitness_function, weights, thresholds}
  fitness double precision,
  parent_id uuid REFERENCES organisms(id),
  root_id uuid NOT NULL,              -- the founder of the lineage
  generation int NOT NULL DEFAULT 0,
  compute_consumed jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {cpu_s, gpu_s, network_b, work_items, qubic}
  birth_at timestamptz,
  death_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

organism_memories (
  id uuid PK,
  organism_id uuid REFERENCES organisms(id) NOT NULL,
  kind text CHECK IN ('short_term','long_term','episodic'),
  payload jsonb NOT NULL,
  written_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

organism_fitness_history (
  id uuid PK,
  organism_id uuid REFERENCES organisms(id) NOT NULL,
  generation int NOT NULL,
  fitness double precision NOT NULL,
  components jsonb NOT NULL,          -- per-dimension weights + values
  recorded_at timestamptz NOT NULL DEFAULT now()
);
```

**Lifecycle:** `CREATE → ACTIVATE → EXPERIENCE → EVALUATE → ADAPT → EVOLVE → FORK → REPEAT → EXTINCT`. Evolution is gated on the genome's mutation policy, not on a platform-wide schedule. An Organism mutates when its episodic memory crosses a threshold (e.g., 100 new experiences since last mutation). The platform enables evolution; it does not force it.

**Stateful Tissue (additive to existing `services/tissue`):**
- New opt-in route: `/v1/tissues/:slug/decide/stateful` accepts + returns a state envelope. The tissue writes accumulated state to a per-tissue key after each call. The Organism owns the state key.
- New route: `/v1/tissues/:slug/memory?since=…&kind=…` for tissue-level memory.
- Tissue-as-organ: an Organism can be built from a single Stateful Tissue.

**Why "Organism" not "Tissue":** the existing Tissue is *stateless per call* — it fans out, combines, returns, and the call ends. An Organism is *stateful across experiences* — its genome mutates, its memory persists, its fitness is tracked across generations, its lineage is parented. Cells → Organs → Bodies.

---

## 7. Foundational Aigarth Optimization

The superprompt's proposed objective:

```
A* = arg max_{O, π, C, E}  E [ U(O,E) + α·D(O,E) + β·I(O,E) + γ·G(O,E) − λ·C − μ·R ]
```

where `U` = useful outcome, `D` = discovery value, `I` = information gained, `G` = generalization, `C` = compute cost, `R` = risk/constraint violation, `O` = organism, `π` = policy, `C` = compute allocation, `E` = environment.

**v0.2 verdict:** This is *useful as a design compass, not as a runtime objective*. Reasons:

1. `U` and `D` and `I` are *not directly measurable* in production. The platform must approximate them. TireMind's `fitness` (§13) is one concrete approximation: `U + G` rolled into a weighted multi-objective score; `D` is the *novelty* term (not yet in the score); `I` is the *uncertainty reduction* term (not yet).
2. `C` is measurable (per-work-item cost) and is the only term with a clean ledger today.
3. `R` is enforceable as a *constraint*, not a *penalty*: refused experiments > expensive experiments.
4. The weights `α, β, γ, λ, μ` are *organism-level* (in `objective.weights`), not platform-level. The platform does not pick them.

**Refined formulation (v0.2):** drop the `arg max` framing (we never search the full joint space). Replace with a *per-generation* update rule that each organism runs locally:

```
O_{t+1} = L(O_t, x_t, y_t, E_t, C_t, H_t)            — adaptation (§8)
F_{t+1} > F_t                                            — fitness improvement (the central inequality)
E[ U(O, E) ] > E[ U(O_baseline, E) ]                   — beats the baseline (§20)
ΔF_Aigarth / C_Aigarth  >  ΔF_baseline / C_baseline    — beats on discovery efficiency (§21)
```

`F_{t+1} > F_t` is the *minimal claim* we must defend. If we cannot defend it experimentally, the thesis breaks. v0.2 §18 (Proof Lab) and §22 (Ultimate Proof) are the experimental apparatus.

---

## 8. Adaptation Equation

The superprompt proposes:

```
O_{t+1} = L(O_t, x_t, y_t, E_t, C_t, H_t)
```

**The non-trivial question is whether `O_{t+1} ≠ O_t` is measurable.** In v0.2:

- A *database record* changing (e.g., `organisms.genome` JSONB being replaced) is not sufficient. That is audit, not adaptation.
- A *Tissue call* returning a different state is not sufficient. That is one call, not learning.
- What IS sufficient: (a) the genome is *mutable and versioned* (genome.version bumped); (b) memory is *episodic and queryable*; (c) fitness is *measured against a held-out test set* by the platform, not declared by the creator; (d) the lineage is *append-only*; (e) the Work Runtime can replay the work items that produced the new fitness and reproduce the result.

**Concrete measurability tests (N01, N03, N04, G01 in the Proof Test Suite §19):**

- **N01 — Adaptive Learning:** environment A → train → environment B → return to A. The organism must show statistically significant learning relative to an unadapted baseline.
- **N03 — Structural Adaptation:** prove that genome.version bumps, tissue weight changes, and memory writes are *internal* to the Organism (not just a database audit log). This requires the genome to be a *typed, signed, versioned artifact* (not freeform JSONB), and the memory to be *signed by the writer* (tissue or worker).
- **N04 — Evolution:** start a population `P_0 = {O_1, …, O_n}`, repeat selection → mutation → evaluation → `P_{t+1}`, test `F(P_{t+1}) > F(P_t)` over multiple runs with a held-out fitness oracle.

**Implementation requirement:** the Organism's `computeConsumed` must be tracked by the Work Runtime, not by the Organism itself. The Organism cannot lie about how much compute it burned. This is a security property, not a logging property.

---

## 9. Discovery

The superprompt's framing:

```
z* = arg max_{z ∈ Z} F(z)
Aigarth maintains F̂_θ(z); reality produces F_real(z)
ε = F_real(z) − F̂_θ(z)
θ_{t+1} = L(θ_t, z_t, F_real(z_t))
```

**v0.2 translation into the Aigarth primitives:**

- `z` is a candidate (a tire formulation for TireMind, a clip for VideoMind, an ANN hyperparameter for any training recipe).
- `Z` is the search space. For TireMind, `Z` is bounded by `organisms.environment.config.material_universe`.
- `F` is the fitness function. TireMind's is `@aigarth/fitness:tire.v1` — a deterministic, versioned, executable function in `packages/fitness/` (Phase 26.D, new).
- `F̂_θ(z)` is the *predicted* fitness from a tissue. The error `ε` is the difference between the predicted fitness and the *measured* fitness from the next round.
- `θ_{t+1}` is the *next-generation* genome. The training of `θ_{t+1}` is itself a work item.

**v0.2 ask:** can the platform demonstrate that learning from observations improves future decisions? The Proof Lab (§18) hosts the experiment. N02 (§19) — *Persistent Memory* — measures the cost of relearning after removal and return:

```
C_relearn,A^memory  <  C_relearn,A^naive
```

If this inequality holds experimentally, the discovery loop works. If it does not, the platform has memory but no learning, and the Organism primitive is decorative.

---

## 10. Active Experiment Selection

The superprompt proposes:

```
a* = arg max_a  ( ΔU(a) + γ·ΔI(a) ) / C(a)
```

i.e., the next experiment is the one that maximises (expected utility gain + expected information gain) per unit cost. v0.2's O02 test (§19) requires the Organism to choose *between candidate experiments* according to this rule and beat both random selection and greedy fitness selection.

**Why this matters:** if the platform only chooses the best-known candidate, it never explores. Pure exploitation is locally optimal and globally suboptimal. The active-experiment-selection rule is the difference between *a search* and *a hill-climb*.

**v0.2 implementation (Phase 26.B):** the Organism's `genome.mutation.operators` includes `experiment_select`. The default strategy is *upper-confidence bound* on a per-dimension basis (a per-`objective.weights` UCB). The platform does not implement UCB for the user; the user defines the strategy in their fitness function.

**Critique:** the `(ΔU + γ·ΔI) / C` form is correct for *known* U and I. When the search space is large (tire formulations: ~10⁹), the platform must approximate. v0.2's O02 test uses a small (~10⁴) candidate space where U and I can be estimated.

---

## 11. Generalized Work Unit

The superprompt proposes `T = (I, A, O, K, V, R)` — inputs, algorithm, objective, constraints, verification, reward — and demands that every workload be expressible as a Task.

**v0.2 maps this to the Work Item envelope** (defined in v0.1 §6.3, verified against `services/compute/src/services/jobs.ts`):

```yaml
work_item:
  work_id: wki_<ulid>
  type: materials_simulation | video_evaluation | trinary_decision | dft_relaxation | awork_1 | ...
  spec_version: 1
  input:
    payload_hash: sha256:<...>
    payload_uri: s3://aigarth/...
    payload_size_bytes: <int>
  algorithm:
    name: <algorithm-slug>
    version: v<semver>
    container: registry.aigarth.cloud/<algo>:<version>
    deterministic: <bool>
  requirements:
    cpu_cores: <int>
    memory_gb: <int>
    gpu: none | optional | required
    gpu_kind: any | rtx_4090 | h100
    estimated_runtime_s: <int>
  verification:
    method: replication | challenge | deterministic | tee | zk
    replicas: 3
    challenge_work_id: null
  reward:
    currency: QUBIC
    amount: <int-qu-bit>     # 1M Qu-bit = 0.001 QUBIC
    payer: <user-or-organism-uuid>
  status: queued | running | verified | failed | disputed
  result:
    payload_hash: sha256:<...>
    completed_by: <worker-uuid>
    completed_at: <iso>
    replicas_agreed: 3/3
  audit:
    created_at, created_by, settlement_tx
```

**Tested against three fundamentally different workloads (G01, G03 in §19):**

- **Neural workload:** trinary_classifier training job → work item with `algorithm.name = "trinary_classifier"`, `verification.method = "replication"`, `replicas = 3`.
- **Materials workload:** DFT relaxation → work item with `algorithm.name = "dft_relaxation"`, `deterministic = true`, `verification.method = "deterministic"` (re-run on a known-good worker).
- **Render/video workload:** video frame scoring → work item with `algorithm.name = "video_consistency_v1"`, `verification.method = "challenge"` (known-answer perceptual hash).

**The work-item envelope is the same. The algorithm differs. The verification method differs. The reward differs.** That is the test: can the same Work Runtime execute all three?

---

## 12. Worker Model

A worker advertises capabilities on registration. v0.2 schema (new in `services/work`):

```ts
{
  worker_id: "wrk_<ulid>",
  kind: "local" | "remote" | "oc-processor" | "neuraxon" | "human-via-oracle",
  capabilities: {
    cpu_cores: 8,
    memory_gb: 32,
    gpu: "none" | "rtx_4090" | "h100" | "any",
    algorithms: ["trinary_classifier", "dft_relaxation", "awork_1", ...],
    runtime: "docker" | "wasm" | "native",
    location: "us-east-1",
    reputation: 0.97,            // rolling 30d
    disputes: 0                  // unresolved
  },
  status: "active" | "suspended" | "offline",
  last_heartbeat_at: <iso>
}
```

**Scheduler:** `π(T, W) = f(capability, cost, latency, availability, reliability, verification)`. The v0.2 first implementation is greedy capability-match + FIFO + per-worker concurrency cap (default 2). Priority preemption is added in Phase 27.B. Cost-aware routing is added when the reward system can express it (Phase 27.C).

**Worker lifecycle:**
- **Join:** `POST /v1/work/workers` with signed manifest; server validates container signatures.
- **Heartbeat:** every 5s; on miss > 30s, marked `offline`.
- **Lease:** scheduler assigns a 30s lease; heartbeat extends; expiry returns the work item to the queue.
- **Result submission:** `POST /v1/work/items/:work_id/result`; verifier inspects.
- **Dispute:** `POST /v1/work/items/:work_id/dispute`; marks the item `disputed`; pauses credit.
- **Reputation:** rolling 30-day. Disputes and missed challenges decay reputation. Below 0.5 → suspended.

**First worker type:** a local Docker runner (Python daemon in `packages/worker-local/`). Polls the work queue, pulls the work item, downloads the payload from MinIO (`services/dataset` already has this pattern), runs the algorithm container, uploads the result, signs the response. The container is signed at registration; the worker is not allowed to run unsigned code.

---

## 13. Heterogeneous Compute

The superprompt asks: can the same experiment use multiple compute classes while improving throughput without destroying correctness or reproducibility?

**v0.2 architecture:**

| Compute class | First implementation | Where it lives | Verification |
|---|---|---|---|
| Local CPU | Docker runner | `packages/worker-local/` | Replication + deterministic re-run |
| Local GPU | Docker runner with NVIDIA runtime | `packages/worker-local/` (GPU profile) | Replication + deterministic re-run |
| Remote CPU | gRPC/HTTP federated worker | Phase 28 | Cross-deployment reputation |
| Remote GPU | gRPC/HTTP federated worker | Phase 28 | Cross-deployment reputation |
| Neuraxon runtime | Sandboxed worker in `packages/neuraxon-runner/` | Phase 31 | Replication + `neuraxon_classifier` recipe contract |
| Qubic OC processor | `@aigarth/oc-processor` (QPI listening side) | Phase 29 | 451/676 computor signature |
| Human via Oracle | Operator UI in `/dashboard` | Phase 27.D (long-tail) | Manual approval + audit |

**Tested in N08, N05, N06 in §19:**
- **N08 — Heterogeneous Compute:** the same `awork_1` work item runs on CPU, GPU, and remote worker. Correctness (output hash), speed, cost, reproducibility (deterministic re-run agrees) are measured. Throughput improves; correctness preserved.
- **N05 — Distributed Execution:** speedup = `T_1 / T_n`; efficiency = `speedup / n`. v0.2 target for `awork_1` on 4 workers: speedup ≥ 3.0, efficiency ≥ 0.75.

---

## 14. Dynamic Compute Allocation

The superprompt proposes:

```
π* = arg max_π  ( E[Utility] + E[Information] ) / ComputeCost
```

i.e., the scheduler should decide *what, where, when, at what priority, with what redundancy, under what budget*.

**v0.2 first implementation is conservative:**

- **What / where:** capability match + locality (same region preferred). Phase 27.B.
- **When / priority:** explicit `priority` field > FIFO. Phase 27.B.
- **What redundancy:** `replicas` field on the work item. Phase 27.C.
- **What budget:** per-organism `computeConsumed` quota enforced by the Work Runtime. Phase 27.C. Hard-stop at the budget.

**What v0.2 does NOT do in v1:**
- Predictive prefetching (Phase 30+).
- Cross-workload economic balancing (Phase 30+).
- Auction-based resource allocation (research, not MVP).

**N07 — Dynamic Scheduling test (§19):** start with Task A demand = high, Task B = medium, Task C = low. Reverse priorities mid-experiment. Measure rebalance time, utilization, throughput, cost, queue latency. Pass condition: rebalance time < 60s, utilization > 70% on the high-demand class within 5 min of the priority flip.

---

## 15. Verification

The superprompt's verification problem is the *single largest research risk* in the PEP. v0.2 commits to a **minimal viable verification stack** in v1 and earns the right to add complexity.

| Mechanism | Performance | Cost | Security | v0.2 MVP? | Notes |
|---|---|---|---|---|---|
| Replication (3 workers) | Low (3× compute) | High (3×) | High for deterministic | ✅ v1 | Default for v1 |
| Deterministic re-run | Medium (1× verifier compute) | Medium | High if `deterministic: true` | ✅ v1 | Triggered when algorithm is deterministic |
| Challenge tasks (1/100) | Low | Very low | Catches "did not run" | ✅ v1 | Always-on in v1 |
| Result commitments (commit-reveal) | Low | Very low | Low alone | ✅ v1 | For non-deterministic |
| Reputation | Zero runtime | None | Indirect | ✅ v1 | Always-on in v1 |
| TEE attestation (SGX/SEV) | Low (TEE overhead) | High (specialised hardware) | Very high | ⏳ Phase 30+ | Defer until Aigarth hardware ships |
| ZK proofs (zkML) | High prover cost | Very high | Highest | ⏳ Research | Not MVP |
| Staking + slashing | Zero runtime | Capital lockup | High if stake is meaningful | ⏳ Phase 30+ | Requires Qubic-side stake |

**Adversarial test cases (V01, V02, V03 in §19):**

- **V01 — Honest Verification:** three workers, deterministic algorithm. All three produce the same output hash. Verifier accepts.
- **V02 — Malicious Worker:** one of three workers returns a fake plausible result. Verifier rejects (2/3 majority required). Reputation decay.
- **V03 — Byzantine Workers:** two workers return `X`, one returns `Y`. Verifier rejects `Y` (majority). Now consider a second case: all three disagree. Verifier marks `disputed`, escalates.

**The principle:** *the platform is not the trust root; Qubic is.* For Tier 3 (OC), the trust root is the 451/676 computor signature. For Tier 1 (local), the trust root is the Aigarth deployment itself, with cross-deployment replication (Tier 2) moving trust toward Qubic. v0.2's Phase 29 OC processor is where this becomes real.

---

## 16. Qubic

Verified 2026-08-11.

**Three pillars of Qubic (live):**

1. **Smart contracts** — Live since network launch. QPI-based. 676 computors.
2. **Oracle Machines** — Live on mainnet since Feb 11, 2026. 27,800+ queries before DOGE launch; 600,000+ in Epoch 210 alone. Caches with TTL. Persistent TCP. Subscriptions supported.
3. **Outsourced Computations (OC)** — First code shipped to mainnet in Epoch 223 (late July 2026); full production targeted July 29, 2026 (May 28 AMA roadmap) or early-to-mid August (July 23 recap).

**What OC actually is (verified):** OC is a mechanism for **Qubic smart contracts to send authorized instructions OUT to external systems**, which execute and return signed results. The 4-stage authorisation: (1) smart contract invokes OC, (2) every computor records parameters, (3) computors independently sign, (4) once 451/676 (two-thirds) have signed, the request is authorised. Each computor forwards the signed bundle to a separate processor machine that performs the off-chain task.

> "Outsourced Computations have nothing to do with renting out compute power. It is the mechanism that allows a Qubic smart contract to send an authorised instruction outward, where an external system acts on it." — Qubic, "Three Pillars" blog, 2026

**v0.2's Qubic capability classification (per the superprompt §16):**

| Capability | Status (2026-08-11) | Aigarth use |
|---|---|---|
| Smart contracts | CURRENTLY POSSIBLE | `services/aigarthpool` already writes to chain (Phase 20) |
| Oracle Machines (read) | CURRENTLY POSSIBLE | `services/qubic` watches OM feeds (Phase 3, live) |
| Outsourced Computations (as processor) | CURRENTLY POSSIBLE (mainnet Epoch 223+) | Phase 29 — new `@aigarth/oc-processor` package |
| Compute marketplace via OC | SPECULATIVE | Not what OC is. Killed (v0.1 §25) |
| Custom uPoW integration | REQUIRES QUBIC PROTOCOL RESEARCH | Phase 30+ research |
| On-chain lineage attestation | CURRENTLY POSSIBLE (via arbitrary tx data) | Phase 29 |

**The superprompt's BPP-9000 framing is corrected:** BPP-9000 is the *current* uPoW (Epoch 224, live since late July 2026). One algorithm, one dataset (1 year of BTC hourly prices), one objective (3-state prediction), one reward function (1 − error rate). It is not a precedent for "heterogeneous mining." The closest parallel in Qubic is "BPP-9000 (neural) || DOGE (Scrypt, classical) running in parallel." The "Universal Useful Work Protocol" idea is *not* a Qubic integration; it is an Aigarth R&D project.

---

## 17. BPP-9000

BPP-9000 is the reference useful-workload in the superprompt. v0.2's classification:

**As a case study, BPP-9000 proves five things:**

1. Useful PoW can be defined for an abstract task (Bitcoin price prediction) with a measurable score.
2. The algorithm is replaceable — Qubic shipped BPP-9000 as a successor to earlier uPoW algorithms without rewriting consensus.
3. The reward function is independent of the work performed — uPoW is consensus + useful work, not "compute-for-rent."
4. Network operators can choose to participate in useful work over classical hashing. Participation-driven, not consensus-mandated.
5. Documentation-driven rollout works — Qubic distributes algorithm specs to computors and miner developers; testing is public; activation is epoch-gated.

**BPP-9000 does NOT prove:**

- Arbitrary useful work is verifiable. BPP-9000 is a closed-form objective; materials DFT is not.
- Heterogeneous mining is economically rational. DOGE is the only parallel workload, and it is classical, not useful.
- A marketplace for useful work exists. There is no third-party "BPP-10000 marketplace."
- Miners can be rewarded fairly for arbitrary compute. BPP-9000's reward is a single number (error rate) over a known dataset.

**v0.2 implication:** BPP-9000 is a *precedent* for "useful work as a network primitive," not a *template* for "heterogeneous useful compute." Aigarth's Work Runtime borrows BPP-9000's *packaging discipline* (versioned algorithm, epoch-gated activation, public spec) without inheriting its *single-objective model*.

**Concretely:** the first algorithm registered in `services/work` is `awork_1` (v0.1 §6.3) — a deterministic numerical benchmark, spec'd exactly like BPP-9000, with the same epoch-gated activation discipline. `awork_1` is the simplest possible workload (deterministic, known-answer). It is the *fitness* primitive, not the *useful mining* primitive. **Naming matters: do not call it mining. Call it a work item.**

---

## 18. Proof Lab

The superprompt's central claim: *do not ask visitors to believe Aigarth. Show them what Aigarth can prove.* v0.2's Proof Lab is the public surface for that.

**Route:** `/proof-lab` (new, in `apps/web/app/(marketing)/proof-lab/`).

**Page structure:**

```
┌────────────────────────────────────────────────────────────┐
│ AIGARTH PROOF LAB                                            │
│                                                              │
│  Can intelligence evolve its own way forward?                │
│                                                              │
│  Aigarth Cloud is building infrastructure for adaptive       │
│  artificial organisms that learn, experiment, use            │
│  computation and discover useful solutions.                 │
│  We are testing the hypothesis in public.                    │
│                                                              │
├────────────────────────────────────────────────────────────┤
│ Active Proofs                                                │
│                                                              │
│  N01  Adaptive Learning              🟡 In Progress          │
│       TireMind-001 · 8 tissues · 142 generations            │
│       Fitness 0.847 (started 0.311)                          │
│                                                              │
│  M01  Materials Prediction           🔵 Validated            │
│       Baseline comparison on Materials Project subset        │
│       Result: Aigarth tissue v3 = 0.91 F1; baseline = 0.84   │
│                                                              │
│  V01  Honest Verification            🔵 Validated            │
│       3-worker replication on awork_1: 99.97% agreement      │
│                                                              │
│  G01  Generalised Task Abstraction   🟠 Experimental         │
│       Three workloads (neural, materials, video) on one     │
│       Work Runtime. Work item envelope is shared.            │
│                                                              │
├────────────────────────────────────────────────────────────┤
│ Activity (last 30 days)                                       │
│  Experiments       32,901                                    │
│  Generations       1,247                                     │
│  Compute consumed  4.8M work items · 19,442 CPU-hr · 311 GPU-hr │
│  Worker count      87 active · 3 suspended                   │
│  Verification rate 99.7%                                     │
│  Discoveries       14 published · 3 licensed                 │
│  Failed hypotheses 412 (audit log)                           │
└────────────────────────────────────────────────────────────┘
```

**Per-proof card:**

```
QUESTION       Can an organism modify its internal state through experience?
BASELINE       Unadapted random-weight tissue, same compute budget
EXPERIMENT     Environment A → train → B → return to A. N=10 runs.
RESULT         Mean adaptation rate = 0.42 (95% CI [0.38, 0.46]).
               p < 0.001 vs. baseline (mean = 0.04).
EVIDENCE       /proof-lab/n01-adaptive-learning
               Raw telemetry: s3://aigarth-proof-lab/n01-raw.parquet
REPRODUCE      docker compose -f repro/n01-adaptive-learning.yml up
STATUS         🟡 In Progress
```

**Status semantics (per the superprompt):**

| Status | Meaning |
|---|---|
| ⚪ Proposed | Designed, not built |
| 🟠 Experimental | Built, single-run result, not yet replicated |
| 🟡 In Progress | Multiple runs in progress, not yet concluded |
| 🔵 Validated | Replicated; result published; re-runnable |
| 🟢 Proven | Validated + externally reproduced by an independent party |

**Implementation (Phase 26.D + 27.D):** a new `proof_runs` table in `services/ann`, an SSE channel for live proof progress, a static-exportable `/proof-lab` page that reads from the SDK. Each proof has a `proof_id`, a `question`, a `baseline_ref`, an `experiment_ref`, a `result_ref`, a `reproduce_ref`, and a `status`.

**The non-obvious design point:** the Proof Lab is *append-only* and *signed*. Once a result is published, it cannot be retconned. The platform's honesty is its most expensive product.

---

## 19. Proof Test Suite

The superprompt's mandatory benchmark families, mapped to v0.2's proposed implementation.

### 19.1 Adaptation (N-series)

| ID | Question | Pass condition |
|---|---|---|
| N01 | Can an organism modify its internal state through experience? | Statistically significant learning vs unadapted baseline over N=10 runs |
| N02 | Persistent memory: does prior experience reduce relearning cost? | `C_relearn,A^memory < C_relearn,A^naive` (t-test p < 0.05) |
| N03 | Structural adaptation: are the changes internal, not just audit? | Genome version bump + signed memory entries + held-out test set fitness improvement |
| N04 | Evolution: does a population improve over generations? | `F(P_{t+1}) > F(P_t)` over 20+ generations, N=5 seeds |
| N05 | Distributed execution: does parallelism help? | Speedup ≥ 3.0 on 4 workers; efficiency ≥ 0.75 on `awork_1` |
| N06 | Worker failure: does the system survive kills? | Recovery time < 60s; no work item lost; reputation decay |
| N07 | Dynamic scheduling: do resources follow priority? | Rebalance < 60s after priority flip; utilisation > 70% on high-demand class within 5 min |
| N08 | Heterogeneous compute: same result on CPU/GPU/remote? | Output hash matches; cost delta measured |

### 19.2 Verification (V-series)

| ID | Question | Pass condition |
|---|---|---|
| V01 | Honest verification: do 3 deterministic workers agree? | 3/3 agreement over 1000 work items |
| V02 | Malicious worker: does the verifier catch a fake? | Single malicious worker detected; reputation decay > 0.05 |
| V03 | Byzantine workers: how does the resolver handle disagreement? | 2/1 majority accepted; 1/1/1 marked `disputed`; resolution time < 60s |

### 19.3 Organism (O-series)

| ID | Question | Pass condition |
|---|---|---|
| O01 | Organism requests compute | The loop `Organism → Task → Compute → Result → Learning` completes; Organism state changes; lineage preserved |
| O02 | Active experiment selection | The organism's UCB-style selector beats random and greedy on (ΔU+γ·ΔI)/C over N=50 trials |
| O03 | Organism forking | Fork produces child with `parentId` set; lineage divergence measurable; both children trainable independently |

### 19.4 Oracle (Q-series)

| ID | Question | Pass condition |
|---|---|---|
| Q01 | Oracle integration: does an external observation change the organism? | An OM subscription event mutates `organism_memories` and the next fitness evaluation reflects it |
| Q02 | Qubic compute integration: latency / cost / reliability / throughput | A real OC invocation completes end-to-end; metrics match expectations |
| Q03 | Outsourced computing: external vs local | Local and external results agree on a deterministic workload; cost delta measured |

### 19.5 Generalisation (G-series)

| ID | Question | Pass condition |
|---|---|---|
| G01 | Generalised task abstraction | Three fundamentally different workloads (neural, materials, video) share the work-item envelope end-to-end |
| G02 | Dynamic workload switching | Resources migrate from Task A → Task C when priority flips; cost optimality within 10% |

### 19.6 Materials (M-series)

| ID | Question | Pass condition |
|---|---|---|
| M01 | Materials prediction | Held-out F1 ≥ 0.85 on Materials Project subset; baseline comparison reported |
| M02 | Materials discovery | Evolutionary search recovers a known good region in a constrained space with target hidden |
| M03 | Multi-objective optimisation | Pareto frontier exposed; not collapsed to a single score |
| M04 | TireMind-001 | Search `z=(M,S,P)`; 6-dimension fitness; safety / cost / durability / sustainability constraints honoured |
| M05 | Recycled-tire constraint | Pareto frontier shifts measurably at `Q_min ∈ {20%, 30%, 40%, 50%}` |
| M06 | Material + structural evolution | `M+S` evolution beats `M`-only on the same budget |

### 19.7 Video (VIDEO-01)

Aigarth does NOT generate video in v1. It **evaluates** external video (Higgsfield / Sora-class). Pass condition: Aigarth's evaluation identifies a real inconsistency (temporal / physical / semantic) in 5/10 generated clips; human evaluator agrees on 4/5.

### 19.8 Generalisation Test

Train/develop within one environment. Move to another. Measure `G = Performance_new / Performance_baseline`. Pass: `G > 0.7` (i.e., transfer is real, not catastrophic forgetting).

---

## 20. Baselines are Mandatory

The superprompt's rule: *every scientific proof must compare Aigarth against at least one baseline.* Preferred: Random Search, Grid Search, Evolutionary Algorithm, Conventional ML, Human Heuristic, Aigarth.

**v0.2 baseline matrix (per proof class):**

| Proof class | Required baseline | Optional baseline |
|---|---|---|
| N01-N04 | Random-weight tissue (no learning) | Pre-trained conventional MLP on the same task |
| N05-N06 | Single-worker run (no parallelism) | — |
| M01-M03 | XGBoost on the same features | Human-annotated subset (small) |
| M04-M06 | Material-only evolution | Random search over the same `Z` |
| VIDEO-01 | Human evaluator (5 clips) | — |
| G01 | Workload-specific scheduler (Celery) | — |
| V01-V03 | No-verifier control | Deterministic-re-run-only |

**Implementation:** every `proof_run` row includes a `baseline_results` JSONB with one entry per required baseline. The Proof Lab page shows the comparison side by side. **Aigarth never reports a number without a baseline.**

---

## 21. Discovery Efficiency

The superprompt's central efficiency metric:

```
DE = ΔF / C
```

v0.2 tracks three variants:

- `DE_perf = ΔF / C` — improvement in useful objective per unit compute.
- `DE_info = ΔI / C` — information gained per unit compute.
- `DE_discovery = NovelUsefulSolutions / C` — published discoveries per unit compute.

Where `ΔI` is the *reduction in uncertainty* about the next-best candidate (a Bayesian formulation of `I` from §10), `NovelUsefulSolutions` is the count of `discoveries` published (marketplace listings with `discoveries` provenance), and `C` is the per-organism `computeConsumed` ledger.

**N04 in §19 reports `DE_perf` per generation. M02 reports `DE_discovery`.** Both are required to defend the thesis that Aigarth is *more efficient* than the baselines, not just *more capable*.

---

## 22. Ultimate Proof

The superprompt's strongest experiment:

> Give the system an environment, an objective, constraints, available tools, and a finite compute budget. Do NOT provide the intermediate strategy. Allow Aigarth to: Observe → Hypothesise → Request Compute → Evaluate → Learn → Adapt → Repeat. Measure `F_final > F_baseline` and `ΔF_Aigarth / C_Aigarth > ΔF_baseline / C_baseline`.

**v0.2's concrete realisation — "Aigarth Evolution Run #001":**

- **Environment:** TireMind-001, battery cathode domain, `Z = ~10⁵` candidate formulations (a constrained subset, not the full space).
- **Objective:** `tire.v1` fitness (with `M01-M06` adaptations for battery): weighted(0.20 safety, 0.15 durability, 0.15 rolling_efficiency, 0.10 wet_grip, 0.10 dry_grip, 0.10 thermal_stability, 0.10 recyclability, 0.05 manufacturability, 0.05 cost_efficiency).
- **Constraints:** `RecycledContent(z) ≥ 0.30`; `Cost(z) ≤ 1.2 × baseline_cost`; no banned substances.
- **Available tools:** DFT relaxation (surrogate, MLIP-style), 7 tissue evaluations, fitness oracle, OM subscription to natural-rubber price (proxy: lithium carbonate).
- **Budget:** `C_max = 1,000,000 work items × 1,000s each / 100 workers ≈ 11.6 days` wall-clock.
- **Baselines:** random search, genetic algorithm (DEAP), XGBoost on hand-crafted features.
- **Pass condition:** `F_final^TireMind > F_final^random` AND `DE_perf^TireMind > DE_perf^GA` AND `DE_perf^TireMind > DE_perf^XGBoost`.

**This is the experiment the platform exists to run.** It is the difference between "Aigarth is a neural-network marketplace" and "Aigarth grows useful intelligence."

---

## 23. Public Proof Lab UX

Concrete layout (already in §18's ASCII sketch). Three principles:

1. **The user is not training a model. They are growing an intelligence.** Copy must say so.
2. **Every proof is signed, dated, and reproducible.** The audit log is the public-facing surface.
3. **No retconning.** Once a fitness curve is published, it is immutable. The Proof Lab does not have an "edit" button on past results.

**Marketing language rule:** "Aigarth can adapt" — claim requires a Proof Lab link. "Aigarth evolves" — claim requires a N04 result. "TireMind discovered a new candidate" — claim requires a Phase 30+ result. v0.1 §24 risk #9 (the "Live Neural Field" overpromising) is enforced at the copy level, not just the visualisation level.

**Footer:** every Proof Lab page links to `docs/proposals/aigarth-cloud-evolution-pep-v0.2.md` (this document), `docs/architecture-decisions/003-trinary-protocol-v1.md` (the protocol decision), and the open repository.

---

## 24. Capability Card

Per the superprompt, every Organism exposes a card. v0.2's capability card for TireMind-001 (illustrative; the actual data ships in Phase 26.D):

```
┌────────────────────────────────────────────────────────────┐
│ Organism: TireMind-001                                      │
│ Creator: aigarth-research                                  │
│ Status:  active · public                                   │
├────────────────────────────────────────────────────────────┤
│ Generation       37                                         │
│ Experiences      182,441                                    │
│ Experiments      32,901                                     │
│                                                              │
│ Initial Fitness  0.311                                      │
│ Current Fitness  0.847                                      │
│ Improvement      +172%                                      │
│                                                              │
│ Compute consumed                                            │
│   CPU time       19,442 hr                                  │
│   GPU time       311 hr                                     │
│   OC time        1,840 hr (Phase 29+)                       │
│   Oracle queries 82,103                                     │
│   QUBIC spent    12,400                                     │
│                                                              │
│ Tasks                                                       │
│   Verified       31,892                                     │
│   Failed         412                                        │
│   Disputed       23                                         │
│                                                              │
│ Lineage                                                      │
│   TireMind-001                                              │
│    └── 001A                                                  │
│         └── 001A7                                            │
│              └── 001A7C                                      │
│                                                              │
│ Current hypothesis                                          │
│   "Lignin-silica hybrid at 0.45 volume fraction,             │
│    lattice-mesh structure, candidate TM-17-884219"          │
│                                                              │
│ Next experiment                                              │
│   Replication of DFT relaxation on TM-17-884219              │
│   with 3 workers + 1 deterministic re-run                    │
│   Expected info gain: 0.06 (UCB estimate)                    │
│                                                              │
│ Confidence: 0.78 (held-out test set, N=200)                 │
└────────────────────────────────────────────────────────────┘
```

**Implementation:** `apps/web/app/dashboard/garden/organism/[slug]/page.tsx` (new, Phase 26.D) reads from `GET /v1/organisms/:slug` + `/fitness` + `/lineage` + `/memory`. The "Live Neural Field" is a CSS-only art-directed visualisation; an explicit caption marks it as such.

---

## 25. Data Provenance

The superprompt's rule: *every result must be traceable to Organism, Version, Genome, Dataset, Environment, Task, Worker, Algorithm, Compute, Result, Verification, Timestamp, Lineage.*

**v0.2 implementation:**

- `proof_runs.provenance` JSONB (in `services/ann`): `{ organism_slug, organism_version, genome_hash, dataset_uri, environment_hash, task_id, worker_id, algorithm, compute_ms, result_hash, verification_method, timestamp, lineage_root }`.
- `work_items.audit` JSONB (in `services/work`): the same fields for the work item, plus `replicas`, `challenge_results`, `reputation_at_completion`.
- `organism_fitness_history.provenance` JSONB: per-generation hash of the genome, the dataset, the environment, the work items that produced the fitness.

**A "provenance trail" is a query:** `SELECT … FROM proof_runs WHERE result_hash = ?`. The result is the full chain back to the originating Organism.

**Scientific reproducibility is a first-class requirement.** Every `proof_runs` row has a `reproduce_command` (the docker-compose / runbook that can re-execute the experiment from the captured inputs). The Proof Lab page renders this command on every card.

---

## 26. Security

The superprompt's red-team list, mapped to v0.2 mitigations:

| Threat | Mitigation | v0.2 status |
|---|---|---|
| Poisoned data | Dataset connector framework validates source signatures; SHA-256 content hash on every upload; per-dataset access control (ADR 004) | ✅ already in Phase 19B |
| Malicious workers | Replication + challenge + reputation + manual `dispute` API | ✅ Phase 27.C |
| Manipulated fitness | Fitness measured by platform, not declared by creator; append-only `organism_fitness_history`; on-chain lineage root in Phase 29 | ✅ + ⏳ |
| Reward farming | Work item reward is paid by the *creator* (the Organism or the user); worker ledger debits; per-organism `computeConsumed` quota | ✅ |
| Model collusion | Cross-worker replication across deployments (Phase 28); reputation decoupled from creator | ✅ + ⏳ |
| Fake compute | Per-worker heartbeat; lease expiry; known-answer challenges | ✅ |
| Replay attacks | Work item IDs are ULIDs (time-ordered, unique); signature includes `work_id` + `nonce` | ✅ |
| Sybil workers | Identity service rate limits + paid compute + minimum reputation threshold (0.3) before a worker can accept paid work | ✅ |
| Adversarial environments | Organism environment is typed and validated against a JSON schema; untrusted inputs must be in the payload, not the envelope | ✅ |
| Fraudulent scientific results | Append-only `proof_runs`; reproducibility command; published proofs are signed by the Organism's service key | ✅ |

**Key security property:** the platform is not the trust root; Qubic is. For Tier 3 (OC), the trust root is the 451/676 computor signature. For Tier 1 and 2, the trust root is the Aigarth deployment itself, but cross-deployment work (Phase 28) and OC settlement (Phase 29) move trust to Qubic.

---

## 27. Economics

The superprompt asks: do we need a token? v0.2's answer: **first establish UsefulWork → MeasurableValue. Then investigate Value → Reward → ComputeMarket.**

**Reward flows (v0.2):**

| Event | Payer | Receiver | Amount |
|---|---|---|---|
| Organism creates a work item | Organism (or its creator) | Worker (via Work Runtime) | Work item's `reward.amount` |
| Work item verified | — | Worker | Credited via `WorkUsageEvent` (already a pattern in `services/billing`) |
| Organism fitness improves | — | Creator | Royalty share (existing Aigarth mechanism, Phase 6 marketplace) |
| Organism forked | Forker | Parent creator | License fee (existing) |
| External lab experiment | Organism (or grant) | Lab | Negotiated; settled in QUBIC via OC (Phase 29) |
| Oracle subscription | Organism (or its creator) | Oracle operator | Existing OM economics (live) |
| Worker proves useful work (Tier 4, future) | Network (Qubic uPoW) | Worker | QUBIC reward (replaces or supplements BPP-9000) |

**Anti-speculation guardrails:**

- Organism fitness is **measured, not declared**. The platform measures; it does not trust creator claims.
- Work item rewards are **paid by the creator, not minted by the platform**. The QUBIC moves from the creator's account to the worker's account; nothing new is created.
- Lineage is **append-only**. No retroactive fitness changes; no back-dating.
- Discovery bounties (Phase 30+) are **funded from a fixed budget** (e.g., 100M QUBIC per year), not from inflation.

**v0.2 verdict on tokenomics:** *not* required for the MVP. The MVP runs on existing Aigarth credit mechanics + QUBIC-denominated work item rewards. A first-class `AIGARTH` token is deferred to Phase 30+ research, contingent on Phase 27's success.

---

## 28. Phased Implementation

v0.1's phased roadmap is preserved. Re-stated here for the superprompt's structure:

| Phase | Name | Deliverable | SP | Demo | Status |
|---|---|---|---|---|---|
| 0-15 | Foundation through Knowledge Layer | Phases 0-15 live | — | — | ✅ |
| 17 | Material Science 8-ANN coordinator | Phase 17 design + eval | — | — | Phase 0 done; backlog 5/13 |
| 18 | Trinary Intelligence Layer | `@aigarth/trinary`, `services/tissue` | — | — | ✅ Live |
| 19 | Datasets & Training Orchestration | Garden UX, datasets, training, feedback loops | — | — | 🟡 ~92%, closeout pending |
| 20-24 | AigarthPool, Snap, Treasury, Gates, Presale | On-chain + UX surfaces | — | — | ✅ Done / 5/6 |
| **26** | **Organism Primitive** | Schema, CRUD, lineage, fitness, memory, marketplace, Garden UI | ~10 | TireMind v0 → v3 | ⏳ Proposed |
| **27** | **Work Runtime — Tier 1 (local)** | `services/work` (port 7012), worker registry, scheduler, verifier, accountant, billing hook, `awork_1` | ~12 | Evolution Run #001 | ⏳ Proposed |
| **28** | **Federated Work Runtime — Tier 2** | Signed work-item RPC; cross-deployment replication | ~8 | Federation #001 | ⏳ Proposed |
| **29** | **Qubic OC Processor — Tier 3** | `@aigarth/oc-processor`; 451/676 signature verification | ~6 | Qubic calls Aigarth | ⏳ Proposed |
| **30** | **Multi-workload Work Runtime — Tier 4** | Multi-workload scheduler; cross-workload economics | ~10 | TireMind + ClimateMind + DrugMind | ⏳ Proposed |
| **31** | **Neuraxon Runtime Integration** | `neuraxon_classifier` training recipe; sandboxed worker | ~8 | Neuraxon vs transformer benchmark | ⏳ Proposed (contingent) |

**Total proposed: ~54 SP** = 5-6 sprints at recent velocity (~19 min/SP). Spans ~6-9 months at the recent cadence.

**Each phase requires:** objective, implementation, dependencies, tests, metrics, demo, risks, completion criteria (the superprompt §28 rule). v0.1 §22 covers these per phase; v0.2's First 10 Tasks (§33) are the immediate subset.

---

## 29. Kill List

The superprompt's rule: *the team must explicitly identify ideas that should NOT be built yet.* v0.1 §25 is preserved and extended:

| Idea | Verdict | Why |
|---|---|---|
| "Universal mining algorithm" | KILL | Misnomer. Qubic has one algorithm at a time. |
| "Dynamic switching between mining algorithms on the network" | KILL | Not Qubic's design. Out of Aigarth's control. |
| "Outsourced Computing as a compute marketplace" | REFRAME | OC is outbound. Aigarth is the *processor*, not the *renter*. |
| "Replace the entire Aigarth ANN primitive with Neuraxon" | KILL | Neuraxon is not production-ready. The Trinary envelope is the contract. |
| "Build a 'Google Play Store for artificial organisms'" | KILL | Wrong scope. Aigarth marketplace is for Aigarth primitives. |
| "Aigarth invents a new tire compound" | KILL | Not a deliverable. The deliverable is the *loop* that produces a hypothesis. |
| "LLM-in-the-loop is the only way to do materials science" | KILL | The fitness function is deterministic. The LLM is a *hint*. |
| "Real-time video generation with the same Organism architecture" | DEFER | Video is secondary. Materials science is the flagship. |
| "Multi-organism symbiosis" | DEFER | Phase 30+ research. |
| "On-chain lineage attestation in Phase 26" | DEFER | Phase 29. The append-only log is sufficient. |
| "Staking + slashing for workers" | DEFER | Requires Qubic-side stake. Phase 30+ research. |
| "TEE attestation for workers" | DEFER | Phase 30+. Replication + challenge is sufficient for v1. |
| "ZK proofs for arbitrary work" | DEFER | Phase 30+ research. |
| "Replace Trinary envelope with Neuraxon-native envelope" | KILL | The Trinary envelope IS the contract. Neuraxon can be a *backend*. |
| "First-class AIGARTH token in v1" | KILL | The MVP runs on existing Aigarth credits + QUBIC-denominated work item rewards. |
| "Material science that runs real lab experiments" | REFRAME | Aigarth plans, predicts, validates against historical data, logs. Real labs are external. |
| "Replace the ANN marketplace with an Organism marketplace" | KILL | The Organism listing is additive to the ANN listing. The marketplace surface is the same. |

---

## 30. Data Model (Recap of v0.1 §18)

All Organism tables live in `services/ann` (the natural home; no new service). All Work Runtime tables live in the new `services/work`. No migration to existing schemas.

**Phase 26.A — `services/ann` additive:**
- `organisms` (verified schema in §6)
- `organism_memories` (short-term, long-term, episodic)
- `organism_fitness_history` (per-generation)

**Phase 27 — new `services/work`:**
- `work_items` (the envelope in §11)
- `workers` (the manifest in §12)
- `work_results` (per-replica submissions, signed)
- `worker_challenges` (challenge task ledger)
- `work_audit` (every state transition)

**Phase 27 — new in `services/ann` (Proof Lab):**
- `proof_runs` (the superprompt's §18 surface)
- `proof_baselines` (per-baseline results, per §20)
- `proof_audit` (signatures, timestamps, lineage root)

**No migration risk.** All new tables, no changes to existing schema.

---

## 31. API Model (Recap of v0.1 §19)

**Phase 26 — new routes, all under `services/ann`:**

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

**Phase 26.D — Proof Lab routes:**

```
GET    /v1/proofs                   # list
GET    /v1/proofs/:proof_id         # retrieve
GET    /v1/proofs/:proof_id/runs    # all runs of a proof
GET    /v1/proofs/:proof_id/baselines
POST   /v1/proofs/:proof_id/run     # enqueue a new run
```

**Phase 27 — new routes, new `services/work` (port 7012):**

```
POST   /v1/work/items
GET    /v1/work/items
GET    /v1/work/items/:work_id
POST   /v1/work/items/:work_id/cancel
POST   /v1/work/items/:work_id/result
POST   /v1/work/items/:work_id/dispute
POST   /v1/work/workers
GET    /v1/work/workers
POST   /v1/work/workers/:worker_id/heartbeat
GET    /v1/work/workers/:worker_id/jobs
POST   /v1/work/workers/:worker_id/results
GET    /v1/work/algorithms
POST   /v1/work/algorithms
```

**Phase 29 — new package `@aigarth/oc-processor`:**

```ts
import { registerAsProcessor, onInvocation } from "@aigarth/oc-processor";

registerAsProcessor({
  processor_id: "aigarth-cloud-materials",
  capabilities: ["materials_simulation", "dft_relaxation"],
  fee_qubic: "1000000",
  endpoint: "https://aigarth.cloud/oc/materials",
});

onInvocation(async (invocation) => {
  const workItem = mapToWorkItem(invocation);
  return await workRuntime.execute(workItem);
});
```

**Phase 26.E — `packages/sdk` additive:**

```ts
client.organisms.create(...)
client.organisms.retrieve(slug)
client.organisms.fork(slug, { genome: ... })
client.organisms.mutate(slug, { genome: ... })
client.organisms.listDecisions(slug)
client.organisms.listLineage(slug)
client.organisms.getFitness(slug)
client.organisms.feedback(slug, payload)
client.proofs.list()
client.proofs.get(proofId)
```

---

## 32. Final Thesis

**What is Aigarth Cloud?**

> Aigarth is a platform for **growing useful computational intelligences**. It is not a neural-network marketplace, a compute rental platform, or Qubic's UI. It is a laboratory, a nervous system, and an ecosystem for growing intelligence.

**The preferred hypothesis to evaluate (the superprompt's final boxed equation):**

```
Aigarth  =  Adaptive Intelligence
         +  Memory
         +  Evolution
         +  Experimentation
         +  Distributed Computation
         +  Verification
         +  External Reality
```

**v0.2's response:** *do not accept this equation merely because it is elegant.* Test it experimentally.

| Term | Aigarth primitive | Test |
|---|---|---|
| Adaptive Intelligence | Organism + Stateful Tissue + mutable genome | N01, N03 |
| Memory | `organism_memories` (short, long, episodic) | N02 |
| Evolution | Genome mutation + lineage + recombination | N04 |
| Experimentation | Work item + Work Runtime + active selection | O01, O02 |
| Distributed Computation | `services/work` (Tier 1 → 4) + Qubic OC | N05, N08, Q02 |
| Verification | Replication + challenge + reputation + (eventually) ZK | V01, V02, V03 |
| External Reality | Oracle Machines + Qubic OC processor + lab feedback | Q01, Q03 |

**The final question:**

> Can Aigarth become better at solving useful problems by deciding what to learn, what to compute, what to remember, and what to try next?

**v0.2's answer:** *we do not know. The architecture can support it. The Proof Lab (§18) is the apparatus to find out. The First 10 Engineering Tasks (§33) are the immediate, falsifiable, scoped-to-this-sprint steps toward answering it.*

**If yes, prove it experimentally.** The Ultimate Proof (§22) — "Aigarth Evolution Run #001" — is the experiment.

**If no, discover precisely where the thesis breaks.** The Falsification Audit (§1) lists the candidate failure modes. The Risk Register (v0.1 §24) ranks them. The Kill List (§29) is the team's discipline against overreach.

---

## 33. First Ten Engineering Tasks

Concrete, scoped, verifiable against the current code on 2026-08-11. Each is sized to fit one sprint. All 10 = ~25 SP, which is 2-3 sprints at the recent velocity.

### Task 1 — Schema migration for `organisms` (Phase 26.A) — 1 SP

- **WHY:** Organism is a new first-class primitive. No schema exists today.
- **CURRENT COMPONENTS USED:** `services/ann/drizzle/` (current journal has 6 entries: `0000_modern_gabe_jones` through `0005_gorgeous_lockheed`); the `organisms` table will be migration `0006_*`.
- **FILES/MODULES AFFECTED:**
  - New: `services/ann/drizzle/0006_<name>_organism_init.sql`
  - New: `services/ann/drizzle/meta/0006_snapshot.json`
  - Edit: `services/ann/drizzle/meta/_journal.json` (add entry, idx 6)
  - Edit: `services/ann/src/db/schema.ts` (add the three tables; comment block at top)
  - Edit: `services/ann/src/db/migrate.ts` (no change expected; existing migrator picks up the new file)
- **API CHANGES:** none yet.
- **DATABASE CHANGES:** three new tables, five new indexes (`organisms_creator_idx`, `organisms_parent_idx`, `organisms_root_idx`, `organisms_status_idx`, `organism_memories_organism_kind_idx`, `organism_fitness_history_organism_idx`).
- **UI CHANGES:** none yet.
- **TEST:** 5 vitest cases — insert + soft-delete + lineage query (`SELECT … FROM organisms WHERE root_id = ?`) + uniqueness on slug + foreign key on `parent_id`.
- **SUCCESS CRITERIA:** `pnpm --filter @aigarth/ann test` green; `pnpm --filter @aigarth/ann db:migrate` applies cleanly on a fresh DB; existing ANN routes still pass.

### Task 2 — Organism CRUD routes (Phase 26.A) — 2 SP

- **WHY:** The user needs to create, list, retrieve, and update Organisms.
- **CURRENT COMPONENTS USED:** `services/ann/src/routes/anns.ts` (pattern); `services/ann/src/services/anns.ts` (pattern); `services/ann/src/lib/` (rate limit, idempotency, audit helpers); `packages/sdk/src/resources/anns.ts` (SDK pattern); `packages/sdk/src/types/ann.ts` (type pattern).
- **FILES/MODULES AFFECTED:**
  - New: `services/ann/src/routes/organisms.ts`
  - New: `services/ann/src/services/organisms.ts`
  - Edit: `services/ann/src/index.ts` (register the new routes)
  - New: `packages/sdk/src/resources/organisms.ts`
  - New: `packages/sdk/src/types/organism.ts`
  - Edit: `packages/sdk/src/index.ts` (export the new resource)
- **API CHANGES:** `POST /v1/organisms`, `GET /v1/organisms`, `GET /v1/organisms/:slug`, `PATCH /v1/organisms/:slug`, `POST /v1/organisms/:slug/activate`, `POST /v1/organisms/:slug/pause`.
- **DATABASE CHANGES:** none (uses Task 1 tables).
- **UI CHANGES:** none yet.
- **TEST:** 15 vitest cases — happy paths + ownership + rate limit + audit log + idempotency.
- **SUCCESS CRITERIA:** routes green; `client.organisms.create({ slug, name, kind, genome, environment, objective })` returns a draft; creator can activate it.

### Task 3 — Lineage + fitness history routes (Phase 26.A) — 1.5 SP

- **WHY:** Lineage is the marketplace surface. Fitness history is the Proof Lab surface.
- **CURRENT COMPONENTS USED:** `services/ann/src/routes/anns.ts` (recursive query pattern in `getLineage`); the `ann_versions` table's `isLatest` index is a useful precedent.
- **FILES/MODULES AFFECTED:**
  - Edit: `services/ann/src/routes/organisms.ts` (extend)
  - New: `services/ann/src/services/lineage.ts` (recursive CTE on `parent_id`)
  - New: `services/ann/src/services/fitness.ts` (append-only insert + paginated read)
- **API CHANGES:** `GET /v1/organisms/:slug/lineage` (recursive parent walk, returns tree as JSON), `GET /v1/organisms/:slug/fitness?limit=&offset=` (paginated), `POST /v1/organisms/:slug/fork` (creates a child with `parentId` set, `generation = parent.generation + 1`, `rootId = parent.rootId`).
- **DATABASE CHANGES:** none.
- **UI CHANGES:** none yet.
- **TEST:** 10 vitest cases — deep lineage (5+ generations), cycles impossible by construction (`parent_id` ≠ `id`, `parent_id` ≠ `root_id`), fork idempotency (same source = different children), generation arithmetic.
- **SUCCESS CRITERIA:** lineage tree of a 5-generation organism is returned correctly in < 50ms; fork creates a new organism with the right `parent_id`/`root_id`/`generation`.

### Task 4 — Episodic memory + manual mutation (Phase 26.A → 26.B bridge) — 2 SP

- **WHY:** Memory is what makes the Organism distinct from a record. Manual mutation is the primitive that 26.B's auto-mutation will call.
- **CURRENT COMPONENTS USED:** `services/ann/src/services/anns.ts` (mutation pattern, `ann_versions` is the ANN-side equivalent); `packages/trinary/src/sign.ts` (HMAC-SHA-256 envelope signing) — re-use the signing discipline for memory entries.
- **FILES/MODULES AFFECTED:**
  - Edit: `services/ann/src/routes/organisms.ts` (extend)
  - New: `services/ann/src/services/memory.ts`
  - New: `services/ann/src/services/mutation.ts`
- **API CHANGES:** `GET /v1/organisms/:slug/memory?kind=episodic&since=…`, `POST /v1/organisms/:slug/memory` (writes a signed entry), `POST /v1/organisms/:slug/mutate` (bumps `genome.version` + writes to memory + appends to fitness history if a fitness score is provided).
- **DATABASE CHANGES:** none.
- **UI CHANGES:** none yet.
- **TEST:** 12 vitest cases — memory write/read round-trip + signature verification + mutation bumps version + cross-service audit log entry.
- **SUCCESS CRITERIA:** an Organism can be manually mutated; the mutation is signed; the memory log is auditable; the fitness history is append-only.

### Task 5 — Organism marketplace listing (Phase 26.C) — 2 SP

- **WHY:** The marketplace is the *commercial* surface. Without a listing, an Organism is invisible to other users.
- **CURRENT COMPONENTS USED:** `services/marketplace/src/routes/listings.ts` (ANN listing pattern); `services/marketplace/src/routes/tissueListings.ts` (tissue-specific pattern, per-license pricing); `services/billing/src/services/tissueUsage.ts` (per-use event pattern — the work-item equivalent should mirror this).
- **FILES/MODULES AFFECTED:**
  - New: `services/marketplace/src/routes/organismListings.ts`
  - New: `services/marketplace/src/services/organismListings.ts`
  - Edit: `services/marketplace/src/index.ts`
  - Edit: `services/billing/src/services/tissueUsage.ts` → add `workItemUsage.ts` (per-work-item billing event)
- **API CHANGES:** `POST /v1/marketplace/organism-listings` (wraps an Organism in a listing), `GET /v1/marketplace/organism-listings`, `GET /v1/marketplace/organism-listings/:id` (with lineage preview), `GET /v1/marketplace/organism-listings/:id/analytics` (`total_forks`, `lineage_size`, `fitness_max`).
- **DATABASE CHANGES:** new `organism_listings` table in `services/marketplace/drizzle/` (mirror the tissue listing table, swap the `tissue_slug` FK for `organism_slug`).
- **UI CHANGES:** none yet.
- **TEST:** 10 vitest cases — wrap + list + retrieve + analytics roll-up + per-fork billing.
- **SUCCESS CRITERIA:** an Organism can be listed; a fork is billable; analytics roll up correctly.

### Task 6 — Garden Organism view (Phase 26.D, UI) — 2 SP

- **WHY:** The Garden is the user's home for their intelligences. Without the Organism view, the new primitive is invisible.
- **CURRENT COMPONENTS USED:** `apps/web/app/dashboard/garden/page.tsx` (the creator's home view); `apps/web/components/garden/garden-card.tsx` (the four widget components); `apps/web/app/dashboard/tissues/page.tsx` (the tissue listing pattern, useful as a model for the organism listing).
- **FILES/MODULES AFFECTED:**
  - New: `apps/web/app/dashboard/garden/organism/[slug]/page.tsx`
  - New: `apps/web/components/organism/OrganismHeader.tsx`
  - New: `apps/web/components/organism/FitnessCurve.tsx` (chart from `/v1/organisms/:slug/fitness`)
  - New: `apps/web/components/organism/LineageBreadcrumb.tsx`
  - New: `apps/web/components/organism/ExperienceStream.tsx` (SSE from `/v1/organisms/:slug/experience-stream` — new route, mirrors Phase 19C.5's SSE pattern in `services/training/src/routes/progress.ts`)
  - New: `apps/web/components/organism/LiveNeuralField.tsx` (CSS-only art-directed visualisation with explicit "art-directed" caption)
- **API CHANGES:** new `GET /v1/organisms/:slug/experience-stream` (SSE) in `services/ann/src/routes/organisms.ts`; this is a *new* route that requires a small NATS subscription in `services/ann/src/workers/` (mirror `services/training/src/workers/retrain-cron.ts`).
- **DATABASE CHANGES:** none.
- **UI CHANGES:** the Garden's `GardenCard` should grow an "Organism" zone in Phase 26.D.
- **TEST:** 5 Playwright / Vitest cases — page loads, fitness curve renders, lineage breadcrumb, "art-directed" caption is visible, fork/mutate buttons work for the creator.
- **SUCCESS CRITERIA:** viewing an Organism shows the full picture; forking creates a new lineage child; the "Live Neural Field" is visibly labelled as art-directed.

### Task 7 — Work Runtime skeleton (Phase 27.A) — 2 SP

- **WHY:** `services/work` is the new service that hosts the Work Item, Worker, and Scheduler.
- **CURRENT COMPONENTS USED:** the *exact* shape of `services/tissue` (Fastify + Drizzle + JWT + NATS) — see `services/tissue/package.json` and `services/tissue/src/index.ts`. Mirror the structure to stay consistent.
- **FILES/MODULES AFFECTED:**
  - New: `services/work/` directory tree, mirroring `services/tissue/`
  - New: `services/work/package.json` (name `@aigarth/work`, port 7012)
  - New: `services/work/src/index.ts` and `server.ts`
  - New: `services/work/src/db/schema.ts`, `migrate.ts`, `seed.ts`
  - New: `services/work/drizzle/0000_<name>_work_init.sql` (work_items, workers, work_results, worker_challenges, work_audit)
  - New: `services/work/src/routes/items.ts`, `workers.ts`, `algorithms.ts`
  - New: `services/work/src/services/{items,workers,algorithms}.ts`
  - Edit: `pnpm-workspace.yaml` (add `services/work`)
  - Edit: `apps/dashboard/src/lib/repo.ts` (add `/services` page entry for port 7012 — already pings 18 targets)
  - Edit: `infrastructure/docker-compose.yml` (no infra change; the service connects to existing Postgres + NATS + MinIO + Redis)
- **API CHANGES:** the routes in §31.
- **DATABASE CHANGES:** five new tables.
- **UI CHANGES:** none yet (the `/services` dashboard page will show the new port as green).
- **TEST:** 15 vitest cases — CRUD + pagination + filter + worker heartbeat + algorithm registry.
- **SUCCESS CRITERIA:** a work item can be created; a worker can register; the scheduler (Task 8) can use these.

### Task 8 — Work Runtime scheduler (Phase 27.B) — 2 SP

- **WHY:** A Work Runtime that doesn't assign work is a database.
- **CURRENT COMPONENTS USED:** `services/compute/src/workers/job-monitor.ts` is the closest existing pattern (background poll loop). `services/training/src/workers/job-runner.ts` is a second pattern (per-job lease + heartbeat). Both are useful references; the Work Runtime scheduler is a more general version.
- **FILES/MODULES AFFECTED:**
  - New: `services/work/src/services/scheduler.ts`
  - New: `services/work/src/workers/assignment.ts` (polls every 5s)
- **API CHANGES:** `POST /v1/work/items/:work_id/assign` (manual, for testing) is the only new public route; the rest is internal.
- **DATABASE CHANGES:** none (uses Task 7 tables).
- **UI CHANGES:** none yet.
- **TEST:** 20 vitest cases — capability match + lease expiry + priority preemption + idempotency + per-worker concurrency cap.
- **SUCCESS CRITERIA:** 100 work items get scheduled to 10 workers correctly; leases expire and items re-queue; priority is honoured; a worker that stops heartbeating gets its work items re-queued within 60s.

### Task 9 — Work Runtime verifier + accountant (Phase 27.C) — 2 SP

- **WHY:** Verification is what makes a work item a *useful* work item.
- **CURRENT COMPONENTS USED:** `services/billing/src/services/tissueUsage.ts` is the closest pattern for per-event accounting; `services/ann/src/services/outcomes.ts` (Phase 19D.1) is the closest pattern for per-decision audit + outcome recording.
- **FILES/MODULES AFFECTED:**
  - New: `services/work/src/services/verifier.ts` (replication, challenge, reputation)
  - New: `services/work/src/services/accountant.ts` (per-work-item ledger, billing hook)
  - New: `services/work/src/workers/challenger.ts` (background challenge-task issuer)
- **API CHANGES:** `POST /v1/work/items/:work_id/result` (worker submits), `POST /v1/work/items/:work_id/dispute` (any party disputes).
- **DATABASE CHANGES:** none (uses Task 7 tables).
- **UI CHANGES:** none yet.
- **TEST:** 25 vitest cases — replication agreement / disagreement (1/3, 2/3, 3/3) + challenge pass / fail + reputation decay + dispute resolution + billing event emission.
- **SUCCESS CRITERIA:** a 3-worker replicated work item is verified; a failed replication marks the work item `disputed`; the worker's reputation decays; the billing event reaches `services/billing`.

### Task 10 — First algorithm `awork_1` + TireMind scaffolding (Phase 27.D + TireMind 0.1) — 1.5 SP

- **WHY:** A Work Runtime without an algorithm is a scheduler. `awork_1` is the simplest deterministic numerical benchmark — the proof that the runtime works.
- **CURRENT COMPONENTS USED:** `services/training/src/services/recipes.ts` (the recipe registry pattern); `packages/trinary/src/state.ts` (the canonical example of a deterministic, signed, versioned Aigarth primitive).
- **FILES/MODULES AFFECTED:**
  - New: `packages/awork-1/` (a new package — like `packages/aigarthpool/` — with a single deterministic numerical benchmark; containerised; reproducible)
  - New: `services/work/src/algorithms/awork-1.ts` (algorithm registration; uses `services/work` algorithm registry)
  - New: `docs/proposals/tiremind-001.md` (companion doc, links to this PEP §22 + the Phase 17 eval `docs/use-cases/material-science-eval.md`)
  - Edit: `services/work/src/services/algorithms.ts` (register `awork_1` on startup if not present)
- **API CHANGES:** none (the algorithm is invoked via existing `/v1/work/items`).
- **DATABASE CHANGES:** one new row in `work_algorithms` (or whatever the registry is called) at startup.
- **UI CHANGES:** none yet.
- **TEST:** 10 vitest cases — algorithm registration + deterministic verification (3 workers agree) + container build + container run + reputation update.
- **SUCCESS CRITERIA:** a work item with `algorithm.name = "awork_1"` runs end-to-end on 3 workers, replication agrees, and the result is verified. TireMind is *documented* (companion doc) but not running.

---

## 34. Sign-off

**This v0.2 PEP proposes (vs v0.1):**

- Reorganised v0.1 into the superprompt's 30-section structure.
- Added Proof Lab (§18), Proof Test Suite (§19), Public Proof Lab UX (§23), Capability Card (§24), Data Provenance (§25), Baselines (§20), Ultimate Proof (§22), Worker Model (§12), Active Experiment Selection (§10), Adaptation Equation (§8), Discovery (§9), Generalised Work Unit (§11), Core Object Model (§5), Foundational Optimization (§7).
- Added a Falsification Audit (§1) that explicitly addresses the superprompt's "do not assume the thesis is true" rule.
- Added a Final Thesis (§32) that maps the superprompt's boxed equation to Aigarth primitives and tests.
- Refreshed all 10 First Tasks with file paths verified against the current code on 2026-08-11 (the `_journal.json` has 6 entries; `services/work` does not exist; `services/ann/src/db/schema.ts` ends with `ann_decision_outcomes`; `packages/awork-1/` is proposed).

**Reviewers:** Engineering, Product, Founders
**Next action:** ADR 005 — Organism Primitive (parallel to ADR 003 for Trinary); ADR 006 — Work Runtime; ADR 007 — OC Processor.
**Decision needed:** approve Phase 26 (Organism Primitive, 10 SP) and Phase 27 (Work Runtime, 12 SP) as the next two phases; defer Phases 28-31 pending Phase 27 success.

---

## Appendix A — Verified external references (2026-08-11)

- Neuraxon 2.0 open-sourced: <https://github.com/DavidVivancos/Neuraxon>
- Qubic All-Hands Recap, Aug 6, 2026 (published 2026-08-11, modified 2026-08-12; most recent as of v0.2.1, 2026-08-13) — the recap that confirmed OC + BPP-9000 are live on mainnet: <https://qubic.org/blog-detail/qubic-all-hands-recap-august-6-2026>
- Qubic All-Hands Recap (July 23, 2026): <https://qubic.org/blog-detail/qubic-all-hands-recap-july-23-2026>
- Qubic OC Tech-on-Deck AMA (June 2026): <https://qubic.org/blog-detail/qubic-outsourced-computation-tech-on-deck-ama-june-2026>
- Qubic Three Pillars: <https://qubic.org/blog-detail/qubic-three-pillars-smart-contracts-oracle-machines-outsourced-computation>
- Qubic Oracle Machines production: <https://qubic.org/blog-detail/qubic-all-hands-recap-april-30-2026>
- Qubic OC shipped to mainnet (Epoch 223): <https://qubic.org/blog-detail/qubic-all-hands-recap-july-23-2026>
- BPP-9000 activates at Epoch 224: <https://qubic.org/blog-detail/qubic-all-hands-recap-july-23-2026>
- cuNxon CUDA library (May 2026): <https://qubic.org/blog-detail/qubic-all-hands-recap-may-14-2026>
- Neuraxon 2.0 peer-reviewed at ICMLT Berlin: <https://qubic.org/blog-detail/qubic-all-hands-recap-may-14-2026>
- Neuraxon 2.0 accepted at AGI-26: <https://ourcryptotalk.com/news/qubic-neuraxon-accepted-agi-26-conference>
- Neuraxon 2.0 ARC-AGI-3 = 0.21% (July 22, 2026): <https://qubic.org/blog-detail/qubic-all-hands-recap-july-23-2026>

## Appendix B — Aigarth Cloud internal references (verified 2026-08-11)

- `docs/proposals/aigarth-cloud-evolution-pep.md` — v0.1 long-form, 38 min
- `docs/proposals/aigarth-cloud-evolution-pep-summary.md` — 8-min exec summary
- `docs/proposals/aigarth-cloud-evolution-pep-roadmap-impact.md` — phase mapping
- `docs/ARCHITECTURE.md` — 16-phase service map
- `docs/PRD.md` — product requirements
- `docs/DATA-MODEL.md` — 82+ domain objects
- `docs/ROADMAP.md` — phase-by-phase build plan
- `docs/architecture-decisions/003-trinary-protocol-v1.md` — ADR 003 (Trinary, accepted 2026-08-04)
- `docs/architecture-decisions/004-dataset-licensing.md` — ADR 004 (Datasets)
- `docs/use-cases/material-science-eval.md` — Phase 17 architecture evaluation
- `docs/deliveries/phase-19c-training-delivery.md`, `phase-19b-dataset-delivery.md`, `phase-19c3-real-llm-delivery.md` — Phase 19 sub-phase deliveries
- `apps/dashboard/src/scripts/register-evolution-pep.ts` — registers the v0.1 PEP with the dashboard (to be updated to point at v0.2)
- `services/ann` — port 7006, `drizzle/` has 6 entries (`0000` → `0005`), schema ends with `ann_decision_outcomes`
- `services/tissue` — port 7008, the existing Tissue primitive
- `services/training` — port 7011, training orchestrator, 5 recipes including `trinary_classifier`
- `services/dataset` — port 7009, first-class datasets
- `services/compute` — port 7003, Aigarth Core scheduler (regions, clusters, reservations, jobs)
- `services/aigarthpool` — QPI contract + simulator (Phase 20)
- `packages/trinary` — `@aigarth/trinary` (signed envelope, 5 consensus policies, 100% coverage, 90+ tests)
- `packages/sdk` — `@aigarth/sdk` (typed client; resources: anns, tissues, marketplace, datasets, billing, chat, embeddings, identity, compute, models, qubic, usage, keys)
- `packages/aigarthpool` — `@aigarth/aigarthpool` (simulator + RPC client)
- `apps/web/app/dashboard/garden/` — the Garden (Phase 19A); no organism view yet
- `apps/web/app/(marketing)/use-cases/material-science/` — marketing page
- `apps/web/app/(marketing)/use-cases/video-synthesis/` — marketing page
- `apps/dashboard/src/components/pages/material-science.tsx` — dashboard tracker

## Appendix C — v0.1 → v0.2 delta (audit trail)

| Section | v0.1 (2026-08-10) | v0.2 (2026-08-11) | Reason for change |
|---|---|---|---|
| Structure | 30 sections (Exec Summary → Sign-off) | 34 sections + 4 appendices; matches superprompt's 30-section + Final Thesis | Superprompt asks for 30-section structure + Final Thesis |
| Falsification | Implied throughout §1 | Explicit §1 with claim-by-claim classification | Superprompt §2 demands it |
| Object model | Implicit (in §7.1) | Explicit §5 with 23 primitives classified | Superprompt §5 |
| Foundational Optimization | Absent | §7 with the `arg max` formulation + v0.2 critique | Superprompt §7 |
| Adaptation Equation | Absent | §8 with measurability tests | Superprompt §8 |
| Discovery | Absent | §9 with Aigarth primitive mapping | Superprompt §9 |
| Active Experiment Selection | Absent | §10 with UCB critique | Superprompt §10 |
| Generalised Work Unit | §6.3 (envelope only) | §11 with 3-workload test | Superprompt §11 |
| Worker Model | §9.3 (capabilities) | §12 with full lifecycle | Superprompt §12 |
| Heterogeneous Compute | §10 (general) | §13 with class table + tests | Superprompt §13 |
| Dynamic Compute Allocation | §10 (general) | §14 with `arg max` + v0.2 first impl | Superprompt §14 |
| Verification | §11 (table) | §15 with adversarial cases V01-V03 | Superprompt §15 |
| Qubic | §4 | §16 with CURRENTLY POSSIBLE / REQUIRES RESEARCH classification | Superprompt §16 |
| BPP-9000 | §5 | §17 with the "precedent, not template" framing | Superprompt §17 |
| Proof Lab | Absent | §18 with status semantics + ASCII layout | Superprompt §18 |
| Proof Test Suite | Absent | §19 with 25 tests | Superprompt §19 |
| Baselines | Absent | §20 with baseline matrix | Superprompt §20 |
| Discovery Efficiency | Absent | §21 with three DE variants | Superprompt §21 |
| Ultimate Proof | Implied in §13 | §22 with concrete realisation | Superprompt §22 |
| Public Proof Lab UX | Absent | §23 with three principles | Superprompt §23 |
| Capability Card | Absent | §24 with TireMind-001 mockup | Superprompt §24 |
| Data Provenance | Absent | §25 with `proof_runs.provenance` | Superprompt §25 |
| Security | §17 | §26 with same threats + status column | Superprompt §26 (slight expansion) |
| Economics | §16 | §27 with reward flows + anti-speculation | Superprompt §27 (slight expansion) |
| Phased Implementation | §21 | §28 (preserved, re-stated) | Superprompt §28 |
| Kill List | §25 | §29 (preserved, extended) | Superprompt §29 |
| Required Final Output | Implicit (§28 §29) | §30 + §31 + §32 (Data Model + API + Final Thesis) | Superprompt §30 |
| First 10 Tasks | §29 | §33 with file paths verified against current code | Superprompt §31 (refreshed) |
| Final Thesis | §28 (Thesis) | §32 (Final Thesis) with the boxed equation mapped to primitives | Superprompt "Final Thesis" |
| Total file path verification | v0.1 verified against 2026-08-10 | v0.2 verified against 2026-08-11 | Freshness |

---

**End of PEP v0.2.** Companion v0.1 is preserved at `aigarth-cloud-evolution-pep.md`; the dashboard's `register-evolution-pep.ts` should be updated to register v0.2 (Task #0 of the next sprint).
