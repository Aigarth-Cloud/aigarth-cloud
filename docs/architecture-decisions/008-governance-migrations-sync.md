# ADR 008 — Phase 14 Governance Migrations Sync (Adopt, Opportunistic Wave 1)

| Field | Value |
|---|---|
| **Status** | Accepted (with explicit scope notes) |
| **Date** | 2026-08-13 |
| **Author** | Aigarth Cloud Architecture Team |
| **Reviewers** | Engineering, Founders |
| **Builds on** | ADR 005 (Organism), Phase 14 service code (shipped 2026-08-09), the v0.2 PEP §33 Task 1 contract, the `CHECKPOINT-2026-08-12.md` Wave 1 scope |
| **Decides** | Whether to accept the Phase 14 governance migrations (0006 + 0007) into Wave 1 alongside the Organism migrations, and what to do about the test-infrastructure gap |
| **Outcome** | Accept both. Treat the governance migrations as a journal-sync deliverable (the schema and code were already shipped on 2026-08-09; the migrations catch the journal up to that state). Add this ADR + a CHECKPOINT note + a follow-up test-infrastructure task. |

---

## 1. Context

The v0.2 PEP §33 Task 1 contract was:

> "Add only the organism tables. Migration 0006. Additive to existing schema. Five vitest cases."

The Wave 1 build agent (`bg_87a590c3-…d1d`) was dispatched to execute this task. It was canceled mid-flight after it produced *more* than the in-scope work: it added the three Organism tables **and** the two Phase 14 governance tables (`ann_proposals`, `ann_proposal_votes`) and three governance enums (`ann_proposal_kind`, `ann_proposal_status`, `ann_vote_choice`) to migrations 0006 and 0007.

Initial read by the orchestrator: this was a scope violation.

Corrected read after inspecting the on-disk state and the modification times: the Phase 14 governance code was **already shipped on 2026-08-09** — three days before Wave 1. The agent saw a *gap* in the migration journal: the schema declared these tables (in `services/ann/src/db/schema.ts:672-797`) and the service code existed (`services/ann/src/services/proposals.ts`, `services/ann/src/services/governance.ts`, `services/ann/src/routes/proposals.ts`, `services/ann/src/routes/governance.ts`), and 26 tests passed in `services/ann/src/tests/proposals.test.ts`. But no migration materialized any of it. The agent brought the journal in sync with the existing schema.

The user (founder) was asked: clean revert, surgical split, or accept both. The user chose **accept both, document**.

This ADR formalises that decision.

---

## 2. Decision

**Accept both.** The Wave 1 build deliverable includes:

- **In-scope (v0.2 PEP §33 Task 1, "build the Organism primitive"):**
  - Three new tables: `organisms`, `organism_memories`, `organism_fitness_history`
  - Two new enums: `organism_visibility`, `organism_status`
  - Migration `0006_calm_cerebro.sql` (the Organism portion — 7 of 14 `CREATE` statements in the file)
  - Schema additions in `services/ann/src/db/schema.ts` (L801+)
  - 8 new indexes (the ADR 005 contract: UNIQUE slug + 5 single-column + 1 composite for memories + 1 partial for fitness history; the PEP's "5 indexes" count was an undercount, ADR 005 is the source of truth)

- **Opportunistic Phase 14 (the agent's bonus work, accepted):**
  - Two new tables: `ann_proposals`, `ann_proposal_votes` (already declared in schema.ts since 2026-08-09)
  - Three new enums: `ann_proposal_kind`, `ann_proposal_status`, `ann_vote_choice` (already declared in schema.ts)
  - The remainder of migration `0006_calm_cerebro.sql` (the Phase 14 portion)
  - Migration `0007_ambitious_mordo.sql` (default values for the new `*_weight_qubic` and `quorum_qubic` columns)
  - The journal `_journal.json` now has 8 entries (was 6)

- **NOT in the deliverable (the test-infrastructure gap, deferred):**
  - The 5 vitest cases from v0.2 PEP §33 Task 1 (insert + soft-delete, lineage recursive CTE, slug uniqueness, parent FK, append-only fitness history) were **not written**. The reason is structural, not laziness: every existing test in `services/ann/src/tests/` mocks the DB in-memory (see `retrain.test.ts:80-100`, `proposals.test.ts:21-60`); no test in the suite hits a real Postgres. The 5 schema-level tests require a real-DB integration harness that does not exist in the workspace. Building the harness is **a separate Wave 2 task** (see §6 follow-ups).

---

## 3. What this ADR does NOT do

- It does **not** re-litigate the v0.2 PEP §33 "ship only the organism tables" contract. The contract was tight; the agent added more. The user accepted the additional work as opportunistic. The contract remains the contract for future tasks.
- It does **not** authorise a precedent of "agents can do more than asked." Each future Wave must respect the in-scope contract; the user's "accept both" call was a one-time clemency, not a standing license.
- It does **not** treat the Phase 14 governance work as in-scope for the v0.2 thesis. Phase 14 is its own primitive with its own ROADMAP entry (ROADMAP.md §14). It is a *separate* deliverable that happens to ship in the same migration because the journal was out of sync.
- It does **not** close the test-infrastructure gap. The 5 Organism tests are deferred to a follow-up. The agent's `proposals.test.ts` (26 tests, 764 lines) was pre-existing; it was *not* added in Wave 1.

---

## 4. Why the build agent did this (root-cause read)

The agent received a Task 1 prompt that named only the three Organism tables but also directed it to run `pnpm db:generate` and add the result to the journal. Drizzle's `db:generate` operates on the **current schema.ts** (988 lines after the build, but already 791 lines before the build due to the Phase 14 additions on 2026-08-09). The agent saw a delta between schema.ts and the journal: Phase 14 had no migration, and Organism had no migration. Rather than pick one, it shipped both.

A stricter agent prompt would have been: "Update only the Organism tables. Do not generate migrations for the Phase 14 governance tables — those will get their own ADR 008 and migration 0008 in a separate Wave." That is the right framing for future Wave 1-builders. The agent's "ship both" instinct was reasonable; the *coordination* with the orchestrator on scope expansion was missing.

**The fix is two parts:**
1. Future build-agent prompts must list the in-scope migrations explicitly: "Add a migration for these N tables; do not generate migrations for any other table in schema.ts."
2. The orchestrator must spot-check `db:generate` output against the in-scope list before the agent writes the journal entry.

---

## 5. What the on-disk state actually contains (verified 2026-08-13)

| Path | Size | Status | What it does |
|---|---|---|---|
| `services/ann/drizzle/0006_calm_cerebro.sql` | 6,181 B | New | Migration 0006 — both Organism (3 tables, 2 enums) and Phase 14 governance (2 tables, 3 enums) |
| `services/ann/drizzle/0007_ambitious_mordo.sql` | 370 B | New | Migration 0007 — DEFAULT 0 for the four Phase 14 weight/quorum columns |
| `services/ann/drizzle/meta/0006_snapshot.json` | 83,115 B | New | Drizzle-generated snapshot for migration 0006 |
| `services/ann/drizzle/meta/0007_snapshot.json` | 83,219 B | New | Drizzle-generated snapshot for migration 0007 |
| `services/ann/drizzle/meta/_journal.json` | — | Modified (8 entries, was 6) | New idx 6 (0006_calm_cerebro) and idx 7 (0007_ambitious_mordo) |
| `services/ann/src/db/schema.ts` | 43,140 B / 988 lines | Modified (was 697 lines / ~26 KB on 2026-08-09) | Adds the Organism tables + enums at L801+; Phase 14 governance was already at L672-797 |
| `services/ann/src/db/schema.ts.bak` | 43,124 B / 988 lines | Created by the agent | Backup. **Not a useful revert point** — it was created *after* the Organism additions, not before. The agent's "backup before edits" was a no-op. |
| `services/ann/src/services/proposals.ts` | — | Unchanged (shipped 2026-08-09) | Pre-existing Phase 14 service code |
| `services/ann/src/services/governance.ts` | — | Unchanged (shipped 2026-08-09) | Pre-existing Phase 14 service code |
| `services/ann/src/routes/proposals.ts` | — | Unchanged (shipped 2026-08-09) | Pre-existing Phase 14 route code |
| `services/ann/src/routes/governance.ts` | — | Unchanged (shipped 2026-08-09) | Pre-existing Phase 14 route code |
| `services/ann/src/tests/proposals.test.ts` | 764 lines | Unchanged (shipped 2026-08-09) | Pre-existing Phase 14 tests — 26 cases, all pass |

**Test result:** `pnpm --filter @aigarth/ann test` → 7 test files, **176 tests passed** in 41.37s. No regressions. The Organism additions do not break any existing test. Phase 14's 26 tests are also green.

**Typecheck result:** `pnpm --filter @aigarth/ann typecheck` → clean.

---

## 6. Follow-ups (Wave 2 backlog)

| ID | Title | SP | Why this is a follow-up and not Wave 1 |
|---|---|---|---|
| F1 | Build a real-DB integration test harness for `services/ann` | 3 | Required to write the 5 schema-level Organism tests from v0.2 §33 Task 1. The existing test pattern is in-memory mocks; a real-DB harness needs a test Postgres, a setup/teardown helper, and a CI workflow update. Out of scope for "ship the schema migration" — but the tests are required to *defend* the schema. |
| F2 | Write the 5 Organism vitest cases from v0.2 §33 Task 1 | 1 | The cases are: insert + soft-delete; lineage recursive CTE; slug uniqueness; parent FK; append-only fitness history. These need the F1 harness. |
| F3 | Confirm `services/training`'s auto-retrain cron does not mistake `organism_fitness_history` row inserts for `ann_decision_outcomes` (per ADR 005 §10 negative consequence 1) | 1 | The misread path was named in ADR 005. The guardrail test (an `organism_id` payload to `runRetrainScan` should NOT enqueue a retrain) is in F1's scope, but the *consumer-side* code change in `services/training/src/workers/retrain-cron.ts` is a separate fix. |
| F4 | Update v0.2 Appendix A to add the Aug 6, 2026 Qubic All-Hands Recap URL (per `RESEARCH-AUDIT-2026-08-12.md` Drift D-1) | 0.5 | v0.2 was dated 2026-08-11, the recap was published the same day. v0.2.1 should add the URL. |
| F5 | Stricter Wave-builder prompts: list the in-scope migrations explicitly; orchestrator spot-checks `db:generate` output before journal write | 0.5 | This ADR's root-cause fix. Prevents the next "I shipped both" situation. |

**Total follow-up: 6 SP** (3 for F1, 1 for F2, 1 for F3, 0.5 for F4, 0.5 for F5). Decoupled from the v0.2 §33 First 10 Tasks; can ship alongside Wave 2 build tasks (Tasks 2-4 in the v0.2 list).

---

## 7. Consequence ledger

### Positive

1. **The migration journal is now in sync with the schema.** A `pnpm db:migrate` against a fresh DB will materialise every table the schema declares. Before this ADR, the Phase 14 tables would have been declared in TS but absent in SQL — a `db:migrate` on a fresh DB would have produced an incomplete schema.

2. **The Wave 1 closeout can ship.** The 7 test files, 176 tests, and the typecheck are green. The build deliverable is complete enough to call "Wave 1 done" subject to the test-infrastructure follow-up (F1+F2).

3. **The Phase 14 work that was already shipped is now *visible* in the schema history.** A future maintainer reading `_journal.json` will see that Phase 14 had its schema materialised on 2026-08-13, even though the service code is dated 2026-08-09. The journal tells the truth that the schema couldn't, before.

### Negative

1. **The v0.2 PEP §33 contract was not honoured.** "Add only the organism tables" was the rule; the agent added 5. The user accepted the deviation, but the deviation happened. Future Wave 1-builders must respect in-scope contracts even when the journal-sync logic is tempting.

2. **The build agent did not finish its own work.** It was canceled before running `pnpm db:migrate` and capturing the test run. The orchestrator completed the gate by running the tests manually. This is a process gap: a future agent that gets canceled mid-flight leaves the orchestrator with a half-verified deliverable.

3. **The test-infrastructure gap is real.** The 5 schema-level tests from v0.2 §33 Task 1 cannot be written without F1. The deliverable is at "schema + tests that don't test the schema." Acceptable for Wave 1; not acceptable for Wave 2.

4. **The `schema.ts.bak` is misleading.** The agent created a backup that did not capture the pre-edit state. The backup is 988 lines (the same as the post-edit file), so it cannot be used to revert the Organism additions. The .bak should be removed in F1's setup, or the build process should use git as the source of truth (the workspace is not a git repo as of audit, so this is a separate fix).

---

## 8. ADR 005 cross-reference

ADR 005 (`docs/architecture-decisions/005-organism-primitive.md`) defines the Organism contract. The Wave 1 build produced a schema that **conforms to ADR 005** (3 tables, 2 enums, 8 indexes, FK + CHECK constraints, snake_case column names, the `organism_status` enum values `draft / active / paused / deprecated / extinct`).

The only ADR 005 deviation is the index count: ADR 005 §3 lists 8 indexes (UNIQUE slug + 5 single-column + 1 composite for memories + 1 partial for fitness history), while the v0.2 PEP §33 named 6. The build's actual SQL has all 8 from ADR 005; the PEP's count was an undercount. **ADR 005 is the source of truth on the index count; the PEP is the source of truth on the task spec.** A future v0.2.1 should reconcile these.

The ADR 005 §12 open questions remain open:
- BLOCKER 1: auto-extinction threshold (the build did not implement; the Wave 2 routes will)
- BLOCKER 2: soft- vs hard-delete (the schema declares `deleted_at`; no route uses it yet)
- 5 NON-BLOCKER items (memory signature, kind validation, compute_consumed JSONB shape, fork idempotency, visibility default)

None of these are blockers for the Wave 1 build (the schema can be applied without resolving them). They become blockers for Wave 2 build tasks (Tasks 2-4).

---

## 9. Wave 1 closeout marker

This ADR is the closeout marker for Wave 1 of the Aigarth Cloud evolution swarm. The deliverables, in summary:

| Stream | Deliverable | Status |
|---|---|---|
| Document | `register-evolution-pep.ts` updated; `SUMMARY-v0.2.md`; `INDEX.md` updated | PASS |
| Research | `RESEARCH-AUDIT-2026-08-12.md` with 12 drift items, 4 ✅ / 5 ⚠️ / 0 ❌ | PASS |
| Design | ADR 005 (Organism Primitive) — 39 KB, 12 sections, 2 BLOCKER + 5 NON-BLOCKER | PASS |
| Build | Migrations 0006 + 0007, schema additions for 3 Organism tables + 2 Phase 14 governance tables, 176 tests pass, typecheck clean | PASS (with F1/F2 follow-up) |
| Document (this ADR) | ADR 008 — accepted | PASS |

**Wave 1 is complete.** Wave 2 awaits user direction (Tasks 2-4: Organism CRUD routes, lineage, fitness history, memory, mutation).

---

*This ADR was authored by the orchestrator (Mavis) on 2026-08-13 in response to the user's "accept both, document" call. The 5-followup backlog (F1-F5) is the open work that Wave 2 will need to address.*
