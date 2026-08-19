# Plan — Wave 3 (2026-08-13)

**Companion to:** `CHECKPOINT-2026-08-12.md` §3b
**Status:** live; Phase A starting immediately
**Author of record:** Mavis (orchestrator)
**Scope (per user pick on 2026-08-13):** Tasks 5-10 + ADR 006 + ADR 007 + the 5 follow-ups from ADR 008. ~13.5 SP. Closes Phase 26 (Organism) AND Phase 27 (Work Runtime).

This is the closeout wave for the v0.2 §33 list. After Wave 3, the
Aigarth Cloud platform has the Organism primitive end-to-end (schema
+ routes + marketplace + Garden UI) AND the Work Runtime end-to-end
(skeleton + scheduler + verifier + accountant + first algorithm).
Phase 28+ (Federation, OC Processor, Multi-workload, Neuraxon)
remain, but the Aigarth thesis has a working substrate.

---

## 1. The dependency DAG

```
                                ┌─────────────────────┐
                                │  Wave 2 ✓           │
                                │  (Tasks 1-4 done)   │
                                └──────────┬──────────┘
                                           │
                ┌──────────────────────────┼──────────────────────────┐
                │                          │                          │
        ┌───────▼────────┐         ┌───────▼────────┐         ┌───────▼────────┐
        │  Phase A       │         │  Phase A       │         │  Phase A       │
        │  ADR 006       │         │  ADR 007       │         │  F1 test       │
        │  (Work Runtime)│         │  (OC Processor)│         │  harness       │
        └───────┬────────┘         └────────────────┘         └───────┬────────┘
                │                                                     │
                │ contract for                                        │ enables
                │ Tasks 7-9                                           │ F2 (5 vitest
                │                                                     │  cases)
                ▼                                                     │
        ┌─────────────────┐                                   ┌───────▼────────┐
        │  Phase B        │                                   │  Phase C       │
        │  Tasks 7-9      │                                   │  F2 (depends   │
        │  Work Runtime   │                                   │  on F1)        │
        │  (skeleton +    │                                   └────────────────┘
        │  scheduler +    │                                            ▲
        │  verifier)      │ ─────────────────┐                         │
        └────────┬────────┘                   │                         │
                 │ enables                     │                         │
                 ▼                             │                         │
        ┌─────────────────┐                   │                         │
        │  Phase C        │                   │                         │
        │  Task 10        │                   │                         │
        │  awork_1 +      │                   │                         │
        │  TireMind doc   │                   │                         │
        └─────────────────┘                   │                         │
                                               │                         │
        ┌─────────────────┐  parallel         │                         │
        │  Phase B        │  with Tasks 7-9    │                         │
        │  Tasks 5-6      │  (depends on       │                         │
        │  marketplace +  │  Tasks 1-4)        │                         │
        │  Garden UI      │  ───────────┐      │                         │
        └─────────────────┘              │      │                         │
                                          │      │                         │
        ┌─────────────────┐              │      │                         │
        │  Phase A       ─┼──────────────┘      │                         │
        │  F3 retrain-   │                     │                         │
        │  cron guardrail│                     │                         │
        └─────────────────┘                     │                         │
                                                 │                         │
        ┌─────────────────┐                     │                         │
        │  Phase A        │                     │                         │
        │  F4 + F5       │                     │                         │
        │  docs + prompt │                     │                         │
        └─────────────────┘                     │                         │
                                                 │                         │
                                                 └───── both finish ─────┘
                                                              │
                                                              ▼
                                                    ┌────────────────┐
                                                    │  Wave 3        │
                                                    │  closeout      │
                                                    │  Phase 26+27   │
                                                    │  done          │
                                                    └────────────────┘
```

---

## 2. Phase A — 5 parallel agents (start now)

Phase A is sized to ~90 minutes wall-clock if all goes well. All 5
agents run in parallel because they have no in-scope dependencies
on each other.

### A.1 — ADR 006 (Work Runtime)

**Agent:** `general` (design stream)
**Output:** `docs/architecture-decisions/006-work-runtime.md`
**Read first:** ADR 005 (template + tone), v0.2 PEP §11-§15, `services/compute/src/services/jobs.ts` (the existing job runner), `services/training/src/workers/job-runner.ts` (the training pattern)
**Contract:** Mirror ADR 005's structure exactly. Decision: "Adopt the Work Runtime as a new service `services/work` (port 7012)." Include the four-tier model (local → federated → OC → multi-workload), the work-item envelope, the worker model, the verification strategy, the scheduler policy, the accounting/billing hook. **Negative consequences** must include: (a) the platform is not the trust root — Qubic is, (b) replication-based verification is not ZK — the platform does not yet have evidence that this is insufficient, (c) the 11th service adds operational surface.

### A.2 — ADR 007 (OC Processor)

**Agent:** `general` (design stream)
**Output:** `docs/architecture-decisions/007-oc-processor.md`
**Read first:** ADR 005/006 (template), v0.2 PEP §16, `services/aigarthpool/contract/` (the existing QPI contract), `services/qubic` (the chain-watching surface)
**Contract:** Mirror ADR 005's structure. Decision: "Aigarth registers as a Qubic OC *processor* in Phase 29. The trust root is the 451/676 computor signature." Include the registration model, the invocation handler, the result attestation, the rate-limit + circuit-breaker requirement, the M3/M4 safety patterns from `services/qubic`. **Negative consequences** must include: (a) Aigarth is exposed to compute-on-demand from any Qubic smart contract — must rate-limit + circuit-break, (b) the `internal_dev_token_change_me` token rotation is mandatory before any non-dev OC processor registration, (c) the OC mock at `https://ocmock.qubic.org/` is the test surface; production is Epoch 223+.

### A.3 — F1 test harness (real-DB integration for `services/ann`)

**Agent:** `coder` (build stream)
**Output:** A new test harness in `services/ann/src/tests/integration/` that runs against a real Postgres. The harness: spins up Postgres (via `docker compose` or assumes `localhost:5432` is up), runs `pnpm db:migrate`, sets up test fixtures, runs the integration tests, tears down. **The 5 schema-level Organism tests from v0.2 §33 Task 1 (insert + soft-delete, lineage recursive CTE, slug uniqueness, parent FK, append-only fitness history) live in this harness.**
**Read first:** `services/ann/drizzle/0006_calm_cerebro.sql` (the migration), `services/ann/drizzle/migrate.ts` (the migrator), `services/ann/src/db/schema.ts` L801+ (the Organism schema), the existing test patterns in `services/ann/src/tests/`
**Constraint:** **DO NOT** add a new Docker dependency to the project's `infrastructure/docker-compose.yml`. The harness should support both "Postgres already running" (dev) and "spin up via testcontainers or pg-mem" (CI). Recommend `pg-mem` for CI (no Docker required) and "real Postgres at `localhost:5432`" for dev.
**Acceptance:** `pnpm --filter @aigarth/ann test:integration` (a new script) runs the 5 schema tests + 5 baseline tests (CRUD operations that already pass at the unit level but are now exercised at the integration level). All 10 new tests pass.

### A.4 — F3 retrain-cron guardrail (services/training)

**Agent:** `coder` (build stream)
**Output:** Edit `services/training/src/workers/retrain-cron.ts` to add a guardrail: when the cron receives an event with `kind === 'organism_fitness'`, it must NOT enqueue a retrain job. Add a test in `services/training/src/tests/retrain_cron_guardrail.test.ts` that exercises the misread path (an `organism_fitness` event triggers the cron → no retrain job is enqueued).
**Read first:** ADR 005 §10 negative consequence 1 (the spec for this fix), `services/training/src/workers/retrain-cron.ts`, the existing `retrain.test.ts`
**Contract:** The fix is a *consumer-side guard*, not a producer-side block. The cron must check the `kind` of the event source and skip any source that maps to the `organisms` tables. Test must be a Vitest test that runs against the in-memory mock pattern (the existing retrain tests are in-memory; F1's real-DB harness is for `services/ann`, not `services/training`).
**Acceptance:** `pnpm --filter @aigarth/training test` shows the new test passing + no regressions in the existing 21 retrain tests.

### A.5 — F4 + F5 (docs + Wave-builder prompt template)

**Agent:** `general` (document stream)
**Output (F4):** Edit `docs/proposals/aigarth-cloud-evolution-pep-v0.2.md` Appendix A to add the Aug 6, 2026 Qubic All-Hands Recap URL as the **most recent** recap (above the July 23, 2026 entry). Keep the v0.1 path unchanged.
**Output (F5):** A new template at `docs/evolution/WAVE-BUILDER-PROMPT-TEMPLATE.md` that codifies the "no scope creep" discipline learned in Wave 1. The template should include: (a) a hard "in-scope file list" with explicit "do NOT touch" entries, (b) a "diff vs. spec" verification step the agent runs before reporting "done", (c) a "if you find something that should be done but isn't in scope" rule that says write a `WAVE-N-FOLLOWUP-<n>.md` note and move on (do NOT implement). Replace the Wave 1 / Wave 2 prompt language with the template where appropriate.
**Read first:** `docs/architecture-decisions/008-governance-migrations-sync.md` §4 (the root-cause read), the Wave 1 build prompt I sent to `bg_87a590c3`, the Wave 2 build prompt I sent to `bg_62b93e62`
**Acceptance:** (F4) v0.2 Appendix A has the new URL in the right position; (F5) the template is general-purpose and can be reused for any future Wave.

---

## 3. Phase B — 2 parallel agents (after Phase A finishes)

Phase B is sized to ~3-4 hours wall-clock.

### B.1 — Tasks 7-9 (Work Runtime) — coder, sequential in one agent

**Output:** A new service `services/work/` (port 7012) with skeleton, scheduler, and verifier/accountant. **No `awork_1` algorithm yet** (that's Task 10 in Phase C).
**Read first:** ADR 006 (the contract, from A.1), `services/tissue` (the closest pattern), `services/compute/src/workers/job-monitor.ts` (the poll-loop pattern), `services/training/src/workers/job-runner.ts` (the lease pattern), `services/billing/src/services/tissueUsage.ts` (the per-event accounting pattern)
**Files (Task 7 — skeleton):** `services/work/package.json` (name `@aigarth/work`, port 7012), `services/work/src/{index,server}.ts`, `services/work/src/db/{schema,migrate,seed}.ts`, `services/work/drizzle/0000_*_work_init.sql` (work_items + workers + work_results + worker_challenges + work_audit), the 5 routes from v0.2 §31, `pnpm-workspace.yaml` entry, `apps/dashboard/src/lib/repo.ts` entry, registration in `infrastructure/docker-compose.yml` (no infra change, just a comment)
**Files (Task 8 — scheduler):** `services/work/src/services/scheduler.ts`, `services/work/src/workers/assignment.ts` (polls every 5s, matches capability + FIFO + priority, 30s lease, per-worker concurrency cap = 2)
**Files (Task 9 — verifier + accountant):** `services/work/src/services/verifier.ts` (replication 3/3 + challenge 1/100 + reputation rolling 30d), `services/work/src/services/accountant.ts` (per-work-item ledger + per-worker ledger + billing hook emitting `WorkUsageEvent`)
**Tests:** ≥20 vitest cases (capability match, lease expiry, priority preemption, replication agreement/disagreement, challenge pass/fail, reputation decay, dispute resolution)
**Acceptance:** `pnpm --filter @aigarth/work typecheck` clean; `pnpm --filter @aigarth/work test` ≥20 cases pass; **the Work Runtime can run end-to-end against an in-memory mock worker (no Docker, no real algorithm container)**.

### B.2 — Tasks 5-6 (Marketplace + Garden UI) — coder, sequential in one agent

**Output:** A new `services/marketplace/src/routes/organismListings.ts` (with `services/organismListings.ts` service) + a new `apps/web/app/dashboard/garden/organism/[slug]/page.tsx` + 5 new components in `apps/web/components/organism/`.
**Read first:** ADR 005, the v0.2 §33 Tasks 5-6 spec, `services/marketplace/src/routes/tissueListings.ts` (the closest listing pattern), `services/billing/src/services/tissueUsage.ts` (the billing-event pattern), `apps/web/app/dashboard/garden/page.tsx` (the existing Garden), `apps/web/app/dashboard/tissues/page.tsx` (the existing tissue detail page)
**Marketplace contract:** per-Organism listing with per-fork fee in QUBIC, per-Organism analytics (`total_forks`, `lineage_size`, `fitness_max`), billing hook to `services/billing` (the existing `tissueUsage` pattern adapted)
**Garden contract:** the v0.2 §24 capability card layout: Organism header (name, kind, generation, fitness, lineage root), tissues grid, fitness curve (chart from `/v1/organisms/:slug/fitness`), experience stream (SSE from `/v1/organisms/:slug/experience-stream` — **a new SSE route in `services/ann` is required**, mirror the Phase 19C.5 SSE pattern in `services/training/src/routes/progress.ts`), lineage breadcrumb, "Live Neural Field" CSS-only visualisation with an **explicit "art-directed" caption**, "Fork" and "Mutate" buttons (creator only)
**Tests:** ≥10 vitest cases for the marketplace listing; 5 Playwright/Vitest cases for the Garden UI (page loads, fitness curve renders, lineage breadcrumb, the "art-directed" caption is visible, fork/mutate buttons work for the creator)
**Acceptance:** marketplace listing works; Garden page renders; SSE stream delivers; the "Live Neural Field" is visibly labelled as art-directed (not internal state).

---

## 4. Phase C — 2 parallel agents (after Phase B finishes)

Phase C is sized to ~1-2 hours.

### C.1 — Task 10 (awork_1 + TireMind scaffolding doc)

**Output:** `packages/awork-1/` (a new package — like `packages/aigarthpool/` — with a deterministic numerical benchmark), `services/work/src/algorithms/awork-1.ts` (algorithm registration), `docs/proposals/tiremind-001.md` (companion doc).
**Read first:** v0.2 §33 Task 10 spec, `packages/aigarthpool/` (the closest package pattern), the TireMind spec from v0.2 §13
**awork_1 contract:** A deterministic numerical benchmark (matrix multiplication with a known answer, or a simple PDE solve). Containerised; reproducible. `services/work` algorithm registry: register `awork_1` as the first algorithm.
**TireMind doc contract:** link to the v0.2 PEP; document the 7 tissues, the fitness function, the data sources, the cost story. **The doc is documentation only; TireMind is NOT running.**
**Acceptance:** a work item with `algorithm.name = "awork_1"` runs end-to-end on 3 workers (mocked), replication agrees, and the result is verified. The TireMind doc is published at the canonical path.

### C.2 — F2 (5 Organism vitest cases — depends on F1)

**Output:** `services/ann/src/tests/integration/organism_schema.test.ts` with the 5 schema-level tests from v0.2 §33 Task 1.
**Read first:** F1's harness (from A.3), the v0.2 §33 Task 1 spec
**Acceptance:** `pnpm --filter @aigarth/ann test:integration` shows the 5 new tests passing.

---

## 5. Wave 3 closeout

After all three phases land and the gate passes, the orchestrator will:

1. Update `docs/evolution/SUMMARY-v0.2.md` to mark all 10 tasks + 2 ADRs as done
2. Update `docs/evolution/CHECKPOINT-2026-08-12.md` §3b to add §3c Wave 3 closeout
3. Update `docs/INDEX.md` to cross-link the new service, packages, and pages
4. Final 213+ tests + 1 new service + 2 ADRs + 1 new package + 1 new UI page

**Phase 26 (Organism) and Phase 27 (Work Runtime) are closed.**

**What remains for Phase 28+:**
- Phase 28 — Federated Work Runtime (sign across deployments)
- Phase 29 — Qubic OC Processor (live against mainnet)
- Phase 30 — Multi-workload Work Runtime
- Phase 31 — Neuraxon Runtime Integration
- ADR 007 follow-on work (the actual OC processor registration, the rate limits, the 451/676 signature verification in `services/ann`)

---

## 6. Coordination protocol

The 3 phases run in sequence (A → B → C). Within each phase, agents
run in parallel. The orchestrator monitors with a cron (15 min) and
gates each stream.

Hard rules for every agent:
- **Strict in-scope.** If you find something that should be done but isn't in your task list, write a `WAVE3-FOLLOWUP-<n>.md` and move on.
- **Cite real files** in any change. No invented paths.
- **Run the test suite** for any service you touch.
- **Report with evidence** — every claim with `Method` + `Evidence` + `Result` block. Final pnpm output is the evidence.

The user (founder) will be pinged at every phase closeout. They can interrupt to scope down or up at any time.

---

**Plan owner:** Mavis (orchestrator)
**Status:** Phase A starting now
**Next checkpoint:** when Phase A finishes (or 90 min from now)
