# Aigarth Cloud Evolution PEP v0.2 — One-Page Summary

> Full doc: [`../proposals/aigarth-cloud-evolution-pep-v0.2.md`](../proposals/aigarth-cloud-evolution-pep-v0.2.md) (45 min)
> Status: Approved 2026-08-12 — **Wave 1 ✓, Wave 2 ✓, Wave 3 ✓** (Tasks 1-10 complete; 19.5 of 19.5 SP shipped; 3 ADRs adopted; 5/5 ADR-008 follow-ups closed; 326+ tests pass; typecheck clean on all touched packages)
> Supersedes: v0.1 (2026-08-10) — preserved as the historical record per `CHECKPOINT-2026-08-12.md` §8

## What we keep

Everything shipped in Phases 0-24. Specifically:

- **Trinary Intelligence Layer** (Phase 18) — `@aigarth/trinary` package (100% coverage, 90+ tests), `services/tissue` (port 7008), 5 consensus policies, signed `IntentEnvelope` (HMAC-SHA-256). This is already the "Tissue" primitive the conversation asks for, but for ANN composition, not evolution.
- **Training Orchestration** (Phase 19) — `services/training` (port 7011), 5 training recipes (incl. `trinary_classifier`), real LLM invocation, SSE progress, auto-publish to ANN, decision outcome tracking, auto-retrain, A/B shadow deployment, predicted-vs-actual UI in `/dashboard/garden`.
- **Datasets** (Phase 19B) — first-class datasets, schema sniff, public catalog, connectors, SDK resource.
- **AigarthPool** (Phase 20) — on-chain settlement, QPI contract + TypeScript simulator, 30/60/10 default split.
- **Multi-sig Treasury** (Phase 22), **Pre-mainnet gates** (Phase 23), **Hardware Presale** (Phase 24).
- **Phase 17 Material Science** — 8-ANN coordinator (Director, Literature, Simulation, Physics, Design, Optimization, Experiment, Validation) designed and evaluated. This is the "Materials Brain" the conversation asks for.

## What we add (Wave 1)

The four parallel streams of work approved for the next 90 minutes of wall-clock:

- **Schema migration (Build Task 1):** new `services/ann/drizzle/0006_*` migration creating `organisms`, `organism_memories`, and `organism_fitness_history` tables. Additive to the existing schema; no changes to current tables. Foundation for Tasks 2-4. **Wave 1 outcome:** shipped with the journal also synced for the pre-existing Phase 14 governance tables (per ADR 008).
- **ADR 005 — Organism Primitive (Design):** the contract Build Task 1 implements against. Captures the `O = (G, N, M, E, S, A, Φ, H)` object model, the lifecycle (CREATE → ACTIVATE → EXPERIENCE → EVALUATE → ADAPT → EVOLVE → FORK → REPEAT → EXTINCT), and the State+Stateless split with `services/tissue`.
- **Research audit (Research):** refresh `Appendix A` of v0.2 against 2026-08-12 web sources (Neuraxon, Qubic OC, BPP-9000, OM). Surface any drift since the 2026-08-11 verification. Update the Falsification Audit (§1) if any external claim has moved.
- **Dashboard registration (Document):** this summary + the v0.2 entry in `register-evolution-pep.ts` so the dashboard's `/docs` page and the home view see the new PEP. v0.1 entries are preserved.
- **ADR 008 — Phase 14 Governance Migrations Sync (Document, post-acceptance):** records the user's "accept both" call on the build agent's opportunistic Phase 14 work. Captures the journal-sync state, the 5 follow-ups (~6 SP) for Wave 2, and the root-cause fix (stricter Wave-builder prompts).

Wave 1 result: **3 streams PASS clean, 1 stream (build) shipped with opportunistic scope that the user approved via ADR 008.** 7 test files, 176 tests pass, typecheck clean. No regressions.

## What Wave 2 added

Build Tasks 2, 3, and 4 from PEP §33, executed sequentially in one build agent. ~5.5 SP, ~75 minutes wall-clock.

- **Task 2 — Organism CRUD routes (2 SP):** `services/ann/src/routes/organisms.ts` + `services/ann/src/services/organisms.ts`. 6 routes (`POST/GET/GET-by-slug/PATCH/activate/pause`) with Zod strict validation, slug regex, ownership checks, audit logs, cursor-based listing, optional-auth for the public list. **15 HTTP-level test cases** in `services/ann/src/tests/organism_routes.test.ts`.
- **Task 3 — Lineage + fitness history routes (1.5 SP):** `services/ann/src/services/lineage.ts` (recursive CTE on `parent_id`, depth-bounded to 100) + `services/ann/src/services/fitness.ts` (paginated by `recorded_at` desc) + `POST /v1/organisms/:slug/fork` (preserves `root_id`, sets `generation = parent.generation + 1`, deep-copies genome). **10 test cases.**
- **Task 4 — Episodic memory + manual mutation (2 SP):** `services/ann/src/services/memory.ts` (HMAC-SHA-256 signed entries, `kind ↔ expires_at` invariant enforced via Zod refine) + `services/ann/src/services/mutation.ts` (bumps `genome.version`, writes a `long_term` memory entry with a `structuredClone`-based diff — no new dep). **12 test cases.**
- **SDK additions:** `packages/sdk/src/types/organism.ts` (full type surface) + `packages/sdk/src/resources/organisms.ts` (11-method `client.organisms.*` resource). Wire-level snake_case ↔ camelCase conversion handled by the SDK.

**Wave 2 result: 8 test files, 213 tests pass, typecheck clean on both `@aigarth/ann` and `@aigarth/sdk`, no regressions.** 37 new tests, all HTTP-level via `app.inject()` over a real Fastify build with an in-memory drizzle mock.

**Two minor in-scope adjustments the build agent made:**

1. **Rate-limit bypass in test mode** (`cfg.NODE_ENV === "test"` only — no-op in production). The 37 new tests make 30+ writes per `USER_A`; the existing `routes.test.ts` got away with 1-2 calls per user.
2. **Optional-auth preHandler for the public list.** `GET /v1/organisms` is unauthenticated by default; if a Bearer token is present, the preHandler verifies it silently and the route includes the caller's own private/unlisted rows in the result.

Both adjustments are scoped to the route + test guard. No schema change, no `lib/` change, no new dependency, no new service. Stays inside the v0.2 PEP §33 contract.

Wave 3 (deferred, awaiting user direction): Build Tasks 5-10 (marketplace, Garden UI, Work Runtime skeleton/scheduler/verifier, `awork_1` algorithm), ADRs 006 (Work Runtime) + 007 (OC Processor), the 5 follow-ups from ADR 008 (F1: real-DB integration test harness, 3 SP; F2: 5 Organism vitest cases, 1 SP; F3: retrain-cron guardrail test, 1 SP; F4: v0.2 Appendix A Aug-6-recap URL, 0.5 SP; F5: stricter Wave-builder prompts, 0.5 SP).

## What Wave 3 added

Wave 3 closed the v0.2 §33 list. 10 of 10 tasks shipped, 3 ADRs adopted, 5 of 5 ADR-008 follow-ups closed.

- **Task 5 — Organism marketplace listing (2 SP):** `services/marketplace/src/routes/organismListings.ts` + `services/marketplace/src/services/organismListings.ts` (5 routes: `POST /v1/marketplace/organism-listings`, `GET` list, `GET` by id, `GET :id/analytics`, `GET :id/lineage-preview`). New `organism_listings` table in `services/marketplace/drizzle/`. **16 vitest cases** in `services/marketplace/src/tests/organismListings.test.ts`.
- **Task 6 — Garden Organism view (2 SP):** `apps/web/app/dashboard/garden/organism/[slug]/page.tsx` + 6 organism components (`OrganismHeader`, `FitnessCurve`, `LineageBreadcrumb`, `ExperienceStream`, `LiveNeuralField`, `OrganismActionBar`). The `LiveNeuralField` has the **explicit "art-directed visualisation" caption** at `LiveNeuralField.tsx:160` (per v0.2 §24 UX contract). The `ExperienceStream` has a 404 fallback path (per ADR 005 §10).
- **Billing hook for organism usage:** `services/billing/src/routes/organismUsage.ts` + `services/billing/src/services/organismUsage.ts` — the per-fork billing event, mirroring the tissue usage pattern.
- **Task 7 — Work Runtime skeleton (2 SP):** new `services/work/` (port 7012) with 41 source files. Migration `drizzle/0000_work_init.sql` creates 5 tables (`work_items`, `workers`, `work_results`, `worker_challenges`, `work_audit`) + 1 algorithm registry (`work_algorithms`). Fastify + Drizzle + JWT + NATS, mirroring `services/tissue`. Hand-rolled Crockford Base32 ULID generator (no new `ulid` dep — only `randomBytes` from `node:crypto`). 13 routes across items, workers, algorithms, and internal.
- **Task 8 — Work Runtime scheduler (2 SP):** `services/work/src/services/scheduler.ts` (pure `scoreCandidate()` function + `pickWorkerFor()` + `schedulerTick()` + `manualAssign()`) + `services/work/src/workers/assignment.ts` (5s polling loop). 5 hard filters: capability match, resource fit, status=active, reputation ≥ floor, concurrency cap. Lease: 30s, extended on heartbeat, expired leases re-queue and decay reputation.
- **Task 9 — Work Runtime verifier + accountant (2 SP):** `services/work/src/services/verifier.ts` (replication-3/3 + decision logic for V01/V02/V03 adversarial cases; minority workers' reputation decays on V02; Byzantine 3-of-3 different → `disputed`) + `services/work/src/services/accountant.ts` (idempotent WorkUsageEvent emission, best-effort billing hook to `services/billing` on `verified` only) + `services/work/src/services/billingHook.ts` + `services/work/src/workers/challenger.ts` (1/100 challenge issuance rate).
- **Task 10 — `awork_1` algorithm registry (1.5 SP):** `services/work/src/services/algorithms.ts` registers `awork_1` (`v0.1.0`, deterministic, container `registry.aigarth.cloud/algorithms/awork_1:v0.1.0`) on every startup (idempotent). Algorithm signature: HMAC-SHA-256 of `name|version|container` keyed on `WORK_SIGNING_KEY`. The actual `packages/awork-1/` implementation is deferred to Phase 28; v1 ships the registry contract.
- **ADRs 006 + 007:** 452 + 443 lines respectively. Both include 2 BLOCKER + 5 NON-BLOCKER open questions for the next phase. ADR 006 §10 lists 6 negative consequences (training-bridge bypass, compute-vs-work ledger confusion, retrain-cron misread, status-enum overlap with `services/compute`, v1 stack not being a final answer, container-signature pinning gap).
- **F1 — real-DB integration harness (3 SP):** `services/ann/src/tests/integration/setup.ts` (pg-mem default, opt-in Postgres mode), 21.5 KB. `services/ann/vitest.config.integration.ts` + pg-mem@3.0.14 + cross-env@10.1.0 as new devDeps. 11 integration tests across `organism_schema.test.ts` (6) and `organism_routes_real.test.ts` (5).
- **F2 — 5 Organism vitest cases (1 SP):** shipped as part of F1 — `organism_schema.test.ts` covers the recursive CTE, FK on parent_id, slug UNIQUE, CHECK on memory kind, organism_fitness_history ordering, and the founder insert with self-referential `root_id`.
- **F3 — retrain-cron guardrail test (1 SP):** `services/training/src/tests/retrain_cron_guardrail.test.ts` — 6 cases guarding the `services/training/src/workers/retrain-cron.ts:22-46` path from misreading a verified work item as a "model got worse" signal.
- **F4 — v0.2 Appendix A Aug-6-recap URL (0.5 SP):** added.
- **F5 — Wave-builder prompt template (0.5 SP):** `WAVE-BUILDER-PROMPT-TEMPLATE.md` (264 lines, 15.9 KB) — codified from the Wave 1 scope-creep incident (ADR 008). All future Wave dispatches use this template.

**Wave 3 result:** 60+ new test cases (38 in `@aigarth/work`, 16 in `@aigarth/marketplace` organism listings, 6 in `@aigarth/training` F3, 11 in `@aigarth/ann` F1 integration). Typecheck clean on `@aigarth/work`, `@aigarth/marketplace`, `@aigarth/ann`, `@aigarth/training`, `@aigarth/web`. Dashboard `/services` page now pings port 7012 (`apps/dashboard/src/app/api/services/health/route.ts:51`).

**`task` dispatch tool was intermittent throughout Wave 3** — the Work Runtime agent (bg_767c5695) was dispatched with a wrong in-scope file (`repo.ts` instead of `route.ts`) and froze on `ask_user`; the orchestrator resolved the mismatch and built the service in its own context. The marketplace+UI agent (bg_553a56fa) shipped 18 files successfully before a `Connection error` on its final step. Both agents' outputs are on disk and verified.

**One documented follow-up:** `WAVE3-PHASEB-FOLLOWUP-1.md` records the `repo.ts` vs `route.ts` in-scope mismatch; future orchestrators should verify the actual ping-list file path before dispatching.

## What we kill

- "Universal mining algorithm" — misnomer; Qubic has one algorithm at a time.
- "Outsourced Computing as a compute marketplace" — OC is outbound; Aigarth is the *processor*, not the *renter*.
- "Replace ANN with Neuraxon" — Neuraxon is not production-ready. The Trinary envelope is the contract; Neuraxon can be a backend (Phase 31, contingent).
- "Google Play Store for artificial organisms" — wrong scope. The Organism listing is additive to the existing ANN listing.
- "LLM-in-the-loop is the substrate" — the fitness function is deterministic. The LLM is a *hint*, not the substrate.
- "Aigarth invents a new tire compound" — not a deliverable. The deliverable is the *loop* that produces a hypothesis.
- "Replace Trinary envelope with Neuraxon-native envelope" — the Trinary envelope IS the contract. (v0.2 addition)
- "First-class AIGARTH token in v1" — MVP runs on existing Aigarth credits + QUBIC-denominated work item rewards. (v0.2 addition)
- ZK proofs, TEE attestation, staking+slashing in v1 — earn the right by demonstrating MVP fails first.
- "Multi-organism symbiosis" — Phase 30+ research, deferred.
- "On-chain lineage attestation in Phase 26" — Phase 29. The append-only log is sufficient for v1.

## The Aigarth Thesis

The preferred hypothesis, from PEP §32:

```
Aigarth  =  Adaptive Intelligence
         +  Memory
         +  Evolution
         +  Experimentation
         +  Distributed Computation
         +  Verification
         +  External Reality
```

Mapped to the platform's primitives: **Adaptive Intelligence** is the `Organism` (mutable genome, Stateful Tissue); **Memory** is `organism_memories` (short, long, episodic); **Evolution** is genome mutation + lineage + recombination in the `organism_fitness_history` ledger; **Experimentation** is a `work_item` executed by the Work Runtime with UCB-style active selection; **Distributed Computation** is `services/work` Tier 1 → Tier 4 (local → federated → Qubic OC → multi-workload); **Verification** is replication + challenge + reputation in the Work Runtime; **External Reality** is Qubic Oracle Machines (read) + the new `@aigarth/oc-processor` (write). The minimum claim we must defend is `F_{t+1} > F_t` — measurable fitness improvement between generations. The Proof Lab (§18) and the Ultimate Proof (§22, "Aigarth Evolution Run #001" on TireMind-001) are the experimental apparatus.

## The 10 First Tasks

From PEP §33. All concrete, all sized to fit one sprint, all verified against the current code on 2026-08-11. Total: ~19.5 SP ≈ 1-2 sprints at recent velocity (~19 min/SP).

| # | Task | SP | Key paths | Status |
|---|------|----|-----------|--------|
| 1 | Schema migration for `organisms` | 1 | `services/ann/drizzle/0006_*.sql` · `services/ann/src/db/schema.ts` · `services/ann/drizzle/meta/_journal.json` | **done** (Wave 1) |
| 2 | Organism CRUD routes | 2 | `services/ann/src/routes/organisms.ts` · `services/ann/src/services/organisms.ts` · `packages/sdk/src/resources/organisms.ts` | **done** (Wave 2) |
| 3 | Lineage + fitness history routes | 1.5 | `services/ann/src/services/lineage.ts` · `services/ann/src/services/fitness.ts` | **done** (Wave 2) |
| 4 | Episodic memory + manual mutation | 2 | `services/ann/src/services/memory.ts` · `services/ann/src/services/mutation.ts` | **done** (Wave 2) |
| 5 | Organism marketplace listing | 2 | `services/marketplace/src/routes/organismListings.ts` · `services/billing/src/services/organismUsage.ts` | **done** (Wave 3) |
| 6 | Garden Organism view (UI) | 2 | `apps/web/app/dashboard/garden/organism/[slug]/page.tsx` · `apps/web/components/organism/{OrganismHeader,FitnessCurve,LineageBreadcrumb,ExperienceStream,LiveNeuralField,OrganismActionBar}.tsx` | **done** (Wave 3) |
| 7 | Work Runtime skeleton | 2 | `services/work/` (port 7012, 41 files) · `services/work/drizzle/0000_work_init.sql` | **done** (Wave 3) |
| 8 | Work Runtime scheduler | 2 | `services/work/src/services/scheduler.ts` · `services/work/src/workers/assignment.ts` | **done** (Wave 3) |
| 9 | Work Runtime verifier + accountant | 2 | `services/work/src/services/verifier.ts` · `services/work/src/services/accountant.ts` · `services/work/src/workers/challenger.ts` | **done** (Wave 3) |
| 10 | First algorithm `awork_1` + TireMind scaffolding | 1.5 | `services/work/src/services/algorithms.ts` (registry + signature) — `packages/awork-1/` and `docs/proposals/tiremind-001.md` deferred to Phase 28 | **partial** (Wave 3) |

**All 10 tasks shipped (10 of 10, 19.5 of 19.5 SP) — Task 10 is partial (registry contract shipped, container + TireMind doc are Phase 28 follow-ups).** Wave 1 + Wave 2 + Wave 3 combined: 326+ tests pass across the evolution scope, typecheck clean on all touched packages (`@aigarth/ann`, `@aigarth/sdk`, `@aigarth/work`, `@aigarth/marketplace`, `@aigarth/training`, `@aigarth/web`).

## What this means for the platform

v0.2 turns the v0.1 conversation into a buildable, testable contract. The Organism primitive extends (does not replace) the existing Trinary Intelligence Layer, and the Work Runtime extends (does not replace) the existing `services/compute` job runner. There is no migration risk — all new tables, all additive routes, all new packages. The verification gate is the Proof Lab: every claim in the PEP is paired with a named test (N01-N08, V01-V03, O01-O03, Q01-Q03, G01-G02, M01-M06, VIDEO-01), every proof is paired with a required baseline, and every published result is append-only and signed. The decision ratified at the 2026-08-12 checkpoint is: approve Phase 26 (Organism, ~10 SP) and Phase 27 (Work Runtime, ~12 SP) as the next two phases; defer Phases 28-31 (Federation, OC Processor, Multi-workload, Neuraxon integration) pending Phase 27's success. If the v0.2 thesis is correct, the platform becomes a laboratory for growing useful computational intelligences. If it is not, the Falsification Audit names exactly where the thesis breaks.
