# Phase N — [Name] delivery report

**Phase:** N — [Name]
**Sprint(s):** Sprint [A] (+ Sprint [B] if applicable)
**Date:** YYYY-MM-DD
**Status:** [✅ Complete | 🟡 In progress | ⛔ Blocked | 🟥 At risk]
**Story points delivered:** [N] / [N total]

> 📦 **Ship time: [~N minutes]** — [N] SP delivered at [~N min/SP]
> [One-line context: e.g. "4× faster than Phase 0 — patterns compounding" or "First-time service, sets the baseline"]

---

## ⏱ Time to ship

| Metric | Value |
| --- | --- |
| **Active build time** | **[N] min** |
| Calendar elapsed | [N h] ([N] working sessions) |
| Story points | [N SP] |
| **Velocity** | **[N] min per SP** |
| Files created / modified | [N] |
| Lines of code (LOC) | [N] |
| Endpoints shipped | [N] (or features / schemas / etc. — adjust per phase) |
| E2E test assertions | [N] (if applicable) |

### Time breakdown (estimate)

| Area | Minutes | Notes |
| --- | --- | --- |
| [area 1] | [N] | [one-line note] |
| [area 2] | [N] | |
| [area 3] | [N] | |
| ... | ... | ... |

### Velocity vs prior phases

| Phase | SP | min/SP | Delta |
| --- | --- | --- | --- |
| Phase [N-2] | [N] | [N] | — |
| Phase [N-1] | [N] | [N] | [+/-N%] |
| **This phase** | [N] | [N] | [+/-N%] |

If velocity changed a lot, explain why here (e.g. "first-time Drizzle setup", "leveraged Phase 1 schema", "parallel agent pairs finally online").

### Known limitations affecting build time

- [list anything that inflated time: missing tooling, context switches, refactor debt, etc.]

### How this was measured

- Active build time = time the agent was actively working between the
  user signal to begin the phase and the report being written.
- Excludes idle time, waits on background tasks, user-prompt gaps.
- Velocity (min/SP) is the cross-phase comparator.

---

## TL;DR

[2-3 sentences. What shipped, what it looks like, what to know.]

## What was built

[Longer section. Tables, lists, links to artifacts. Mirror the structure
of the existing reports — see `phase-0-delivery.md` and `phase-1-delivery.md`
for the layout.]

## Acceptance criteria

[Mapped from the sprint plan's exit criteria. Each one: ✅ met, 🟡 partial, ⛔ blocked.]

## Verification

[End-to-end test command + summary output. Screenshots/links where relevant.]

## Decisions made

[Bullet list of non-obvious choices and the reasoning.]

## Known limitations

[Honest list of what's stubbed, deferred, or not yet built.]

## Phase N exit criteria (from sprint plan)

> [Verbatim quote from `docs/SPRINT-PLAN.md`]

**Status:** [✅ Met / 🟡 Partial — [what's left] / ⛔ Blocked on [reason]]

## Links

- [Links to relevant code, schemas, tests, decisions]

## What's next

[Pointer to the next phase + any open questions for the user.]
