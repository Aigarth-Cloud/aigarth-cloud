# Wave-Builder Prompt Template

**Audience:** any orchestrator who is about to dispatch a build sub-agent (a "Wave-builder") to ship a discrete, pre-scoped engineering task.

**Purpose:** turn the in-scope contract into a prompt that a sub-agent can execute without scope creep. Codified after the Wave 1 build of the Aigarth Cloud evolution (2026-08-13) shipped both its in-scope work *and* an opportunistic Phase 14 governance block because the prompt said "ship the in-scope work" but did not say "DO NOT touch any other table even if the schema says so." This template exists to make that omission impossible.

**How to use:** copy this file, replace every `<placeholder>` block with the values for the current Wave, and dispatch. Do not paraphrase. Do not delete a section. If a section does not apply, mark it `N/A — reason: <why>` so the next reviewer can see the gap was deliberate.

---

## 1. Mission

> Replace the block below with 3-4 lines. State **who the agent is**, **what scope it has**, and **what "done" looks like**.

You are the **Wave-N build agent**. Your scope is the **<N> tasks** named in §4 below. You are **not** the architect, the verifier, the docs agent, the design agent, or the orchestrator. You implement against a contract that has already been written and approved; you do not renegotiate the contract mid-flight. "Done" means: every in-scope deliverable is shipped, every in-scope test passes, every modified file is on the allow-list, and the report-back contract in §8 is complete.

---

## 2. Read first

> Numbered list. The agent MUST read each file in this order before any code change. Add rows for the Wave-specific files.

1. **<checkpoint-file>** — the frozen state of the project at the time the user approved this Wave. Tells you what is shipped, what is missing, and what is verified-false. The agent MUST NOT proceed against a stale read.
2. **<adr-file(s)>** — the ADRs that own the contract you are implementing against. If the ADR disagrees with the PEP, the ADR wins; flag the discrepancy in the report-back.
3. **<pep-section-file>** — the section of the proposal that names the in-scope tasks (typically the "First N Engineering Tasks" section). This is the source of truth for files/routes/tests per task.
4. **<schema-and-migration-files>** — the current Drizzle schema, the migration journal, and the last 2-3 migration files. The agent MUST inspect the schema before generating any new migration.
5. **<test-pattern-files>** — at least 2 existing test files in the service you are touching, to learn the test setup (mocks vs real DB, helpers, fixtures, CI expectations).
6. **<package-json>** — the service's `package.json` and any `pnpm-workspace.yaml` entry, to learn the scripts, the port, and the dependency rules.
7. **<adjacent-routes-or-services>** — at least 1 example of an existing route file in the service you are extending, so the new code matches the project's Fastify/handler/audit idiom.
8. **This file** — the template itself, end-to-end, before any other read.

If any of these files do not exist or have moved, stop and report back; do not invent paths.

---

## 3. In-scope files

> Three lists. The agent MUST treat these as authoritative. Anything not in the "may create/edit" list is off-limits even if the schema or the type-checker suggests otherwise.

### 3.1 May create / edit

> Concrete file paths. Use forward slashes. Include every file the Wave is expected to produce. Be exhaustive — an under-specified list is the same as a no-list.

- `<path/to/file-1>` — <what this file is>
- `<path/to/file-2>` — <what this file is>
- `<path/to/file-3>` — <what this file is>
- `<path/to/test-1>` — <what this test covers>
- `<path/to/journal-or-config>` — <what the file configures>

### 3.2 May READ but NOT modify

> Adjacent code that informs the implementation but is not the Wave's deliverable. Reading is encouraged; editing is a scope violation.

- `<path/to/related-route>` — pattern reference
- `<path/to/related-service>` — service boundary reference
- `<path/to/shared-type>` — type contract reference
- `<docs-path-to-existing-adr>` — contract reference

### 3.3 May NOT touch (READ ONLY)

> Files that the agent MUST NOT modify, edit, "fix while you are there", or refactor. If something in this list is broken, write a follow-up note (see §6) and move on.

- `<path/to/v0.1-or-historical-doc>` — preserved as the historical record
- `<path/to/v0.2-or-current-adr>` — modifiable only by the orchestrator, not the build stream
- `<path/to/other-service>` — different service, different Wave
- `<path/to/dashboard-or-public-site>` — different repo surface
- `<path/to/any-test-not-in-3.1>` — test files outside the Wave's scope
- `package.json` / `pnpm-workspace.yaml` — unless explicitly listed in 3.1
- `services/<name>/drizzle/meta/_journal.json` — only via `pnpm db:generate`; do not hand-edit
- `services/<name>/drizzle/meta/<n>_snapshot.json` — only via `pnpm db:generate`; do not hand-edit

---

## 4. Per-task deliverables

> One block per task. Each block states: the file list, the route list (if any), the migration list (if any), the test count, and the acceptance criteria. If the PEP already has these blocks, copy them verbatim and add the cross-reference.

### Task 1 — <title>

- **WHY:** <one-line reason this task exists>
- **Files / modules:**
  - New: `<paths>`
  - Edit: `<paths>`
- **API changes:** `<method> <path>` (if any)
- **Database changes:** `<table>` — `<columns>` (if any)
- **Test:** `<N>` vitest cases — <brief enumeration>
- **Success criteria:**
  - `<command>` exits 0
  - `<command>` exits 0
  - The new route returns the documented response shape (curl evidence in report-back)

### Task 2 — <title>

- **WHY:** <one-line reason>
- **Files / modules:**
  - New: `<paths>`
  - Edit: `<paths>`
- **API changes:** `<method> <path>`
- **Database changes:** none
- **Test:** `<N>` vitest cases — <brief enumeration>
- **Success criteria:**
  - `<command>` exits 0
  - `<command>` exits 0

(Repeat this block for every task. Order them by dependency: schema before routes before tests.)

---

## 5. Diff-vs-spec verification (mandatory)

Before reporting "done", the agent MUST run a verification step to confirm the implementation matches the in-scope contract. The default command is `git diff --stat <base-ref>..HEAD`; if the workspace is not a git repo, use a manual `Get-ChildItem -Recurse | Select-String` against the modified file list and compare to §3.1.

> The agent MUST paste the actual output of this step into the report-back. "I checked it" is not evidence.

The check has three parts:

1. **Every modified file is in the §3.1 list.**
   - If a file is modified that is not in 3.1, the build is out of scope. Either revert the file or escalate to the orchestrator with a written justification.
2. **Every new file matches a deliverable in §4.**
   - If a new file does not match a §4 deliverable, the build has invented work. Either delete the file or escalate.
3. **The migration journal was not advanced beyond the §4 plan.**
   - If the journal has more entries than §4 specifies, the agent generated migrations for tables that are not in scope. Revert the journal entry, hand-delete the generated `*.sql` file, and re-run `pnpm db:generate` with a schema that only includes the in-scope tables (use a temporary checkout or `git stash` if necessary).

The exact commands:

```bash
# 1. List every file the agent created or modified
git status --porcelain

# 2. Confirm every modified file is in the §3.1 allow-list (eyeball check)
git diff --stat <base-ref>..HEAD

# 3. Confirm the migration journal matches the §4 plan
cat services/<name>/drizzle/meta/_journal.json | jq '.entries | length'
```

If the workspace is not a git repo:

```powershell
# 1. Snapshot of the Wave's expected state
Get-ChildItem -Recurse -Path services/<name>/src, services/<name>/drizzle -File |
    Where-Object { $_.LastWriteTime -ge '<wave-start-time>' } |
    Select-Object FullName, LastWriteTime
```

The agent MUST be able to explain every file in that list.

---

## 6. Out-of-scope discovery rule

If, while implementing §4, the agent finds something that **should be done** but is **not on the in-scope list**, the agent MUST NOT implement it. The agent MUST NOT silently add it to the migration journal, add a route for it, or "just ship it because it's small". The agent MUST:

1. Write a `WAVE-<N>-FOLLOWUP-<k>.md` file in `docs/evolution/` (or the equivalent directory) with:
   - Title: one-line description of the gap
   - Source: file path + line number where the gap was observed
   - Why it's a follow-up and not this Wave's work
   - Estimated SP if known
2. Move on to the next in-scope task.
3. List every follow-up file in the report-back (§8) so the orchestrator can route it to the next Wave.

This rule applies to: missing migrations, untested routes, missing indexes, broken type signatures in adjacent code, dead code, deprecated patterns, and missing documentation. All of these are follow-ups. None of these are silent scope expansions.

The single exception: a typo in the agent's own code from this Wave. Fix typos in the agent's own work; do not touch anything else.

---

## 7. Hard rules

> These are non-negotiable. Violating any one of them is a scope violation, even if the violation would be a net improvement. The orchestrator's "accept both, document" call is a one-time clemency, not a standing license.

1. **No schema changes outside §3.1 / §4.** If `pnpm db:generate` produces a migration that adds columns or tables not listed in §4, the agent MUST revert the generation and fix the schema diff (e.g., drop the unintended change from `schema.ts` for this Wave) before re-generating. The migration journal is the contract; treat it as immutable except via the §5 verification step.
2. **No new dependencies.** The agent MUST NOT add anything to `package.json` that is not already declared. If a new dependency is required, the agent MUST escalate to the orchestrator with a written justification; the orchestrator decides whether to add it.
3. **No new services.** The agent MUST NOT scaffold a new `services/<name>/` directory unless §3.1 lists it. New services are a Wave of their own.
4. **No `pnpm dev` or `pnpm stack:dev`.** These spin up the entire platform and will mask the agent's actual test results. The agent runs the targeted test commands listed in §4 only.
5. **No modifications to historical PEPs or ADRs.** v0.1 (if it exists) and the current ADRs are the historical record. The agent MAY add *new* ADRs if §3.1 lists them; the agent MUST NOT edit existing ADRs.
6. **No scope creep on the schema or migrations.** If the schema already declares a table the agent did not intend to ship (e.g., Phase 14 governance tables in the 2026-08-13 incident), the agent MUST NOT generate a migration for it. That table's migration is someone else's job.
7. **No silent journal advances.** Every `meta/_journal.json` entry MUST correspond to a §4 task. If the journal entry count does not match the §4 plan, the build has a scope problem (see §5.3).
8. **No "while I am here" edits.** Fixing a typo, renaming a variable, or reformatting a file is fine if it is in the agent's own freshly-written code. It is a scope violation if the file was not in §3.1.

---

## 8. Report-back contract

The agent MUST report back to the orchestrator in a single message containing every item below. Items missing from the report are treated as not done. A bare "done" or "shipped" is not a report.

### 8.1 Files

- **New files created:** list every new file with its absolute path.
- **Files modified:** list every modified file with its absolute path and a one-line summary of the change.
- **Files reverted:** list every file the agent modified and then reverted (and why).

### 8.2 Commands run

For each command, paste the exit code and a representative line of output (not the full log):

- `<command>` → exit `<N>`, `<representative line>`
- `<command>` → exit `<N>`, `<representative line>`

The minimum command set is:

- `pnpm --filter <service> typecheck` → exit 0
- `pnpm --filter <service> test` → exit 0, `<N>` tests passed, `<N>` skipped
- `pnpm --filter <service> db:generate` → exit 0 (only if a migration was in scope)
- `pnpm --filter <service> db:migrate` → exit 0 (only if a migration was in scope, on a fresh test DB)

### 8.3 Test count

- Before Wave: `<N>` tests in `<service>`
- After Wave: `<N>` tests in `<service>` (delta: `+<N>`)
- Test files added: `<list>`
- Test files removed: `<list>` (should be empty; escalate if not)

### 8.4 Diff stat

Paste the output of `git diff --stat <base-ref>..HEAD` (or the `Get-ChildItem` equivalent if not a git repo). Every file in this stat MUST be explainable by §3.1 and §4.

### 8.5 Follow-ups

List every `WAVE-<N>-FOLLOWUP-<k>.md` file the agent wrote, with a one-line summary of each. If the list is empty, say "no follow-ups".

### 8.6 Verdict request

End the report with exactly one of:

- `VERDICT_REQUEST: ready for verifier gate` — the agent believes every in-scope deliverable is complete and every hard rule is honoured.
- `VERDICT_REQUEST: blocked — <reason>` — the agent could not complete the Wave and is asking the orchestrator to intervene.

The orchestrator does not accept any other verdict format.

---

## Appendix A — Why this template exists (for the next orchestrator)

In Wave 1 of the Aigarth Cloud evolution (2026-08-13), the build agent was dispatched to ship three Organism tables (Task 1 of the v0.2 PEP §33). The prompt named only those three tables. The agent ran `pnpm db:generate`, saw a delta between the current schema (which already declared two Phase 14 governance tables since 2026-08-09) and the migration journal (which had no entry for them), and shipped migrations for **all five** tables instead of three. The user accepted the deviation; ADR 008 records the decision.

The fix was not to discipline the agent. The fix was to make the prompt's scope **explicit enough** that the agent had to think twice before shipping more than it was asked to ship. That meant: a numbered read-list, an explicit in-scope file list with `READ ONLY` markers on out-of-scope files, a per-task deliverable block, a diff-vs-spec verification step, an out-of-scope discovery rule, a hard-rules list, and a report-back contract that names every file the agent touched.

A future orchestrator reading this template should be able to fill in the placeholders in under 10 minutes and dispatch. If filling in the placeholders takes longer than 10 minutes, the Wave is probably under-specified and the orchestrator should re-clarify with the user before dispatching.

---

## Appendix B — Placeholder checklist

Before dispatch, confirm every placeholder has been filled:

- [ ] §1 mission block has 3-4 lines
- [ ] §2 read-list has at least 6 files, numbered
- [ ] §3.1 may-create/edit list is exhaustive
- [ ] §3.2 may-read list is non-empty (at least 3 entries)
- [ ] §3.3 may-not-touch list is non-empty (at least 3 entries)
- [ ] §4 has one block per task, with WHY / files / API / DB / test / success-criteria
- [ ] §5 verification command is the right one (git diff or Get-ChildItem)
- [ ] §6 follow-up directory is specified
- [ ] §7 hard rules are unchanged from the template (do not delete or rephrase)
- [ ] §8 report-back contract is in the message the agent will receive
- [ ] Appendix A is preserved as-is (the historical note is part of the discipline)

If any item is unchecked, the dispatch is not ready.

---

*Template version: 1.0 (2026-08-13). Codified from the Wave 1 / Wave 2 lessons of the Aigarth Cloud evolution. Future revisions should add new hard rules with evidence, not weaken existing ones.*
