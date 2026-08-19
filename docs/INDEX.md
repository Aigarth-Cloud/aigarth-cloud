# Documentation Index

**Last updated:** 2026-08-12

All foundational documents for Aigarth Cloud. Read in this order if you're new.

## Read first (product + business)

1. **[`PRD.md`](./PRD.md)** — Product Requirements Document. The vision, the users, the surfaces, the metrics.
2. **[`BRD.md`](./BRD.md)** — Business Requirements Document. The revenue model, the milestones, the unit economics.

## Read second (engineering + design)

3. **[`ARCHITECTURE.md`](./ARCHITECTURE.md)** — System architecture. Service map, data flow, deployment topology.
4. **[`TECH-STACK.md`](./TECH-STACK.md)** — Concrete tech decisions and the why behind each.
5. **[`DATA-MODEL.md`](./DATA-MODEL.md)** — The 82+ domain objects and their owning services.
6. **[`API-SPEC.md`](./API-SPEC.md)** — Endpoint contracts, error format, auth, rate limits.
7. **[`architecture-decisions/003-trinary-protocol-v1.md`](./architecture-decisions/003-trinary-protocol-v1.md)** — The trinary decision language that every ANN, tissue, and orchestrator on the platform speaks (Phase 18A).
8. **[`guides/trinary-intelligence.md`](./guides/trinary-intelligence.md)** — Working user guide: build a tissue, call it, license it, monetize it. (Phase 18F)

## Read third (operational)

8. **[`SECURITY.md`](./SECURITY.md)** — Security and compliance posture.
9. **[`SPRINT-PLAN.md`](./SPRINT-PLAN.md)** — Sprint-by-sprint build plan.
10. **[`RISK-REGISTER.md`](./RISK-REGISTER.md)** — Top 20 risks with mitigations.
11. **[`TEAM-AND-ROLES.md`](./TEAM-AND-ROLES.md)** — Who does what. AI agent teams.
12. **[`GOVERNANCE.md`](./GOVERNANCE.md)** — How decisions get made.

## Read fourth (for contributors)

13. **[`CONTRIBUTING.md`](./CONTRIBUTING.md)** — How to contribute, for humans and AI agents.
14. **[`DEVELOPER-GUIDE.md`](./DEVELOPER-GUIDE.md)** — Local dev setup, commands, troubleshooting.

## Read fifth (writing + brand)

15. **[`BRAND-VOICE.md`](./BRAND-VOICE.md)** — Voice principles, vocabulary rules, microcopy standards.
16. **[`GLOSSARY.md`](./GLOSSARY.md)** — Domain terms.

## Source documents (the originals)

- **[`../ENDGAME-PROTO-PROPOSAL.md`](../ENDGAME-PROTO-PROPOSAL.md)** — The Qubic Incubation Program submission
- **[`../../../ROADMAP.md`](../../../ROADMAP.md)** — Engineering build roadmap (16 phases)

## Evolution proposals

- **[`proposals/aigarth-cloud-evolution-pep-v0.2.md`](./proposals/aigarth-cloud-evolution-pep-v0.2.md)** — **v0.2 (live, 2026-08-11).** The approved 30-section superprompt-aligned PEP. Supersedes v0.1. Adds the Falsification Audit, Proof Lab, Proof Test Suite (N/V/O/Q/G/M/VIDEO series), 10 First Tasks verified against the current code on 2026-08-11, and a Final Thesis that maps the boxed equation to Aigarth primitives. (45 min)
- **[`evolution/SUMMARY-v0.2.md`](./evolution/SUMMARY-v0.2.md)** — One-page TL;DR of v0.2 for the dashboard home view. Wave 1 deliverable. (3 min)
- **[`evolution/CHECKPOINT-2026-08-12.md`](./evolution/CHECKPOINT-2026-08-12.md)** — The frozen state of the project at v0.2 approval. Read this before doing any work on the evolution.
- **[`evolution/PLAN-2026-08-12.md`](./evolution/PLAN-2026-08-12.md)** — Companion plan to the checkpoint.
- **[`proposals/aigarth-cloud-evolution-pep.md`](./proposals/aigarth-cloud-evolution-pep.md)** — **v0.1 (historical, 2026-08-10).** The original 27-section PEP. Preserved as the historical record per `evolution/CHECKPOINT-2026-08-12.md` §8. v0.2 supersedes it; do not edit v0.1.
- **[`proposals/aigarth-cloud-evolution-pep-summary.md`](./proposals/aigarth-cloud-evolution-pep-summary.md)** — v0.1 8-min executive summary. Companion to v0.1.
- **[`proposals/aigarth-cloud-evolution-pep-roadmap-impact.md`](./proposals/aigarth-cloud-evolution-pep-roadmap-impact.md)** — v0.1 roadmap-impact companion note. (5 min)

## ADRs (architecture decisions)

- **[`architecture-decisions/001-intelligence-economy-layer.md`](./architecture-decisions/001-intelligence-economy-layer.md)**
- **[`architecture-decisions/002-staking-contract-strategy.md`](./architecture-decisions/002-staking-contract-strategy.md)**
- **[`architecture-decisions/003-trinary-protocol-v1.md`](./architecture-decisions/003-trinary-protocol-v1.md)** — Trinary decision language (Phase 18A).
- **[`architecture-decisions/004-dataset-licensing.md`](./architecture-decisions/004-dataset-licensing.md)** — Dataset ownership + licensing model.
- **[`architecture-decisions/005-organism-primitive.md`](./architecture-decisions/005-organism-primitive.md)** — Wave 1 design: the Organism primitive contract (3 tables, 2 enums, 8 indexes, lifecycle + lineage + memory + fitness + 12 routes).
- **[`architecture-decisions/006-work-runtime.md`](./architecture-decisions/006-work-runtime.md)** — Wave 3 design: the Work Runtime contract (5 tables + 1 registry, 13 routes, 4-tier compute model, replication+challenge+reputation verification, accountant bridge to billing). 2 BLOCKER + 5 NON-BLOCKER open questions for Phase 28+.
- **[`architecture-decisions/007-oc-processor.md`](./architecture-decisions/007-oc-processor.md)** — Wave 3 design: the `@aigarth/oc-processor` package contract (QPI listening side, 451/676 computor signature verification, write side of "External Reality"). 2 BLOCKER + 5 NON-BLOCKER open questions for Phase 29.
- **[`architecture-decisions/008-governance-migrations-sync.md`](./architecture-decisions/008-governance-migrations-sync.md)** — Wave 1 closeout: the user's "accept both" call on the build agent's opportunistic Phase 14 governance migrations. Records the journal-sync state, the 5 follow-ups (F1-F5, all closed in Wave 3), and the root-cause fix (WAVE-BUILDER-PROMPT-TEMPLATE.md).
- **[`evolution/WAVE-BUILDER-PROMPT-TEMPLATE.md`](./evolution/WAVE-BUILDER-PROMPT-TEMPLATE.md)** — Wave 3 (F5): the discipline template for any future orchestrator dispatching a build sub-agent. Codified from the Wave 1 scope-creep incident.
- **[`evolution/WAVE3-PHASEB-FOLLOWUP-1.md`](./evolution/WAVE3-PHASEB-FOLLOWUP-1.md)** — Wave 3 Phase B: the `repo.ts` vs `route.ts` in-scope file mismatch that froze the Work Runtime agent on `ask_user`. Resolved by the orchestrator editing the actual ping-list file.

## Organism primitive (Phase 26, ✓ Wave 3)

All Phase 26 tasks (Tasks 1-6) are shipped. Garden UI, marketplace listing, and the integration test harness (F1) are in.

- **Schema:** [`services/ann/drizzle/0006_calm_cerebro.sql`](../../services/ann/drizzle/0006_calm_cerebro.sql) (organism tables) + [`services/ann/drizzle/0007_ambitious_mordo.sql`](../../services/ann/drizzle/0007_ambitious_mordo.sql) (Phase 14 governance defaults) + [`services/ann/src/db/schema.ts` L801+](../../services/ann/src/db/schema.ts) (TypeScript).
- **CRUD routes (Task 2 ✓):** [`services/ann/src/routes/organisms.ts`](../../services/ann/src/routes/organisms.ts) + [`services/ann/src/services/organisms.ts`](../../services/ann/src/services/organisms.ts).
- **Lineage + fitness routes (Task 3 ✓):** [`services/ann/src/services/lineage.ts`](../../services/ann/src/services/lineage.ts) + [`services/ann/src/services/fitness.ts`](../../services/ann/src/services/fitness.ts).
- **Memory + mutation routes (Task 4 ✓):** [`services/ann/src/services/memory.ts`](../../services/ann/src/services/memory.ts) + [`services/ann/src/services/mutation.ts`](../../services/ann/src/services/mutation.ts).
- **Marketplace listing (Task 5 ✓):** [`services/marketplace/src/routes/organismListings.ts`](../../services/marketplace/src/routes/organismListings.ts) + [`services/marketplace/src/services/organismListings.ts`](../../services/marketplace/src/services/organismListings.ts) (5 routes) + [`services/marketplace/src/db/schema.ts`](../../services/marketplace/src/db/schema.ts) (organism_listings table). 16 vitest cases.
- **Garden UI (Task 6 ✓):** [`apps/web/app/dashboard/garden/organism/[slug]/page.tsx`](../../apps/web/app/dashboard/garden/organism/[slug]/page.tsx) + 6 organism components in [`apps/web/components/organism/`](../../apps/web/components/organism/). The `LiveNeuralField` has the explicit "art-directed visualisation" caption (per v0.2 §24 UX contract); the `ExperienceStream` has a 404 fallback (per ADR 005 §10).
- **Billing hook:** [`services/billing/src/routes/organismUsage.ts`](../../services/billing/src/routes/organismUsage.ts) + [`services/billing/src/services/organismUsage.ts`](../../services/billing/src/services/organismUsage.ts) — per-fork billing event.
- **Integration test harness (F1 ✓):** [`services/ann/src/tests/integration/setup.ts`](../../services/ann/src/tests/integration/setup.ts) — pg-mem default, opt-in Postgres mode. 11 integration tests across `organism_schema.test.ts` (6) and `organism_routes_real.test.ts` (5).
- **Tests:** [`services/ann/src/tests/organism_routes.test.ts`](../../services/ann/src/tests/organism_routes.test.ts) — 37 HTTP-level cases via `app.inject()`.
- **SDK:** [`packages/sdk/src/types/organism.ts`](../../packages/sdk/src/types/organism.ts) + [`packages/sdk/src/resources/organisms.ts`](../../packages/sdk/src/resources/organisms.ts) — 11 methods on `client.organisms.*`.

## Work Runtime (Phase 27, ✓ Wave 3)

All Phase 27 tasks (Tasks 7-9) shipped. Task 10 (awork_1 registry) is partial — the algorithm contract is in; the container + TireMind doc are Phase 28 follow-ups.

- **Schema:** [`services/work/drizzle/0000_work_init.sql`](../../services/work/drizzle/0000_work_init.sql) — 5 tables (`work_items`, `workers`, `work_results`, `worker_challenges`, `work_audit`) + 1 algorithm registry (`work_algorithms`). TypeScript: [`services/work/src/db/schema.ts`](../../services/work/src/db/schema.ts).
- **Service:** [`services/work/src/server.ts`](../../services/work/src/server.ts) — Fastify on port 7012. Mirrors `services/tissue` shape.
- **Routes (13):** 4 items + 6 workers + 2 algorithms + 1 internal. See [`services/work/src/routes/`](../../services/work/src/routes/).
- **Services (6):** [`items.ts`](../../services/work/src/services/items.ts), [`workers.ts`](../../services/work/src/services/workers.ts), [`algorithms.ts`](../../services/work/src/services/algorithms.ts), [`scheduler.ts`](../../services/work/src/services/scheduler.ts), [`verifier.ts`](../../services/work/src/services/verifier.ts), [`accountant.ts`](../../services/work/src/services/accountant.ts) + [`billingHook.ts`](../../services/work/src/services/billingHook.ts).
- **Background workers:** [`assignment.ts`](../../services/work/src/workers/assignment.ts) (5s polling) + [`challenger.ts`](../../services/work/src/workers/challenger.ts) (1/100 challenge issuance rate).
- **Tests:** [`services/work/src/tests/`](../../services/work/src/tests/) — 38 vitest cases (Zod envelope, scheduler scoring, verifier V01-V03, accountant cost formula, ULID generator).
- **Dashboard registration:** port 7012 is now in the `/services` ping list at [`apps/dashboard/src/app/api/services/health/route.ts:51`](../../apps/dashboard/src/app/api/services/health/route.ts).

## Launches

- **[`launches/phase-27-lucidmindlabs-deploy.md`](./launches/phase-27-lucidmindlabs-deploy.md)** — Phase 27: Aigarth Cloud deploy runbook for the Hostinger KVM2 VPS at aigarth-cloud.lucidmindlabs.com. Pre-flight, provisioning, source + build, PM2, Caddy, smoke tests, rollback, completion report template. Estimated 90-120 min wall clock.
- **[`deliveries/phase-27-lucidmindlabs-deploy.md`](./deliveries/phase-27-lucidmindlabs-deploy.md)** — Phase 27 deploy completion report (placeholder; the deploy agent overwrites after the deploy runs).
- **[`launches/phase-18-trinary-launch.md`](./launches/phase-18-trinary-launch.md)** — Phase 18: Trinary Intelligence Layer launch summary (dev + staging live).

## Video walkthroughs

- **[`video/trinary-intelligence-walkthrough.md`](./video/trinary-intelligence-walkthrough.md)** — Companion doc for the Phase 18 video tutorial. Architecture, narrated walkthrough, source.

## Companion tools

- **[`../dashboard/`](../../dashboard/)** — Project tracker (Next.js + SQLite). Source of truth for "what's outstanding"
- **[`../assets/`](../../assets/)** — Design assets, brand files, screenshots
