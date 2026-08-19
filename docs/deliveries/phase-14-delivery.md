# Phase 14 — Governance (off-chain) v1 — Delivery

**Phase:** 14
**Status:** done (100%)
**Story points:** 3 / 3 (v1 scope)
**Active build time:** ~1h 30m (the 13/26 → 26/26 test fix was the main lift)
**Velocity:** 2.0 SP/h

## TL;DR

The off-chain surface for governance. Distinct from Phase 22,
which is the on-chain multi-sig. Together: Phase 14 says what
should happen, Phase 22 enforces that it happens. v1 ships the
proposals service, routes, schema, and 26/26 tests.

## What's shipped

### Schema — `services/ann/src/db/schema.ts`

Three new enums + two new tables:

```ts
export const proposalKind = pgEnum("ann_proposal_kind", [
  "general",          // non-binding policy discussion
  "treasury-spend",   // binding — pushes to AigarthPool.submitTreasuryTransfer
  "ecosystem-grant",  // binding — paid out by the treasury
  "parameter-change", // binding — governance-controlled parameter
]);

export const proposalStatus = pgEnum("ann_proposal_status", [
  "open", "passed", "rejected", "expired", "executed", "cancelled",
]);

export const voteChoice = pgEnum("ann_vote_choice", ["yes", "no", "abstain"]);

export const proposals = pgTable("ann_proposals", { /* ... */ });
export const proposalVotes = pgTable("ann_proposal_votes", { /* ... */ });
```

`proposal_votes` has a unique index on `(proposalId, voterUserId)`
so re-votes upsert via `ON CONFLICT DO UPDATE` (one row per
(proposal, voter)).

### Service — `services/ann/src/services/proposals.ts`

9 exports:

- `createProposal(input)` — validation, stake check via
  `computeVoterStakeQubic`, default quorum = `max(MIN_QUORUM_QUBIC,
  proposerStake / 100n)`, 7-day default window.
- `castVote(input)` — one vote per (proposal, voter); re-vote
  updates the existing row's choice/weight/note. Snapshot stake
  at vote time so a user who later unstakes still has their vote
  counted. Self-vote forbidden (`SELF_VOTE`). No-stake rejection
  (`NO_STAKE`). Closed-proposal rejection (`NOT_OPEN`). Expiry
  rejection (`EXPIRED`).
- `recomputeTally(proposalId)` — groupBy choice, sum weights,
  update the cached yes/no/abstain fields. Idempotent.
- `finalise(proposalId)` — after deadline: simple-majority +
  quorum gate. `expired` when total weight < quorum; `passed`
  when yes > no and quorum met; `rejected` otherwise. Idempotent
  on already-finalised proposals.
- `executeProposal(proposalId)` — for binding kinds, pushes to
  `pool.submitTreasuryTransfer(proposer, destination, 1)`. Marks
  `executed` and bumps the on-chain execution nonce. Idempotent.
- `listProposals(opts)` — public read, paged, optional status
  filter, ordered by `createdAt` desc.
- `getProposal(id)` — public read with a fresh tally attached.
- `computeTallyFromDb(id)` — recompute then read.
- `ProposalError` class + `MIN_PROPOSER_STAKE_QUBIC` (1M QUBIC),
  `MIN_QUORUM_QUBIC` (100k QUBIC), `DEFAULT_VOTING_WINDOW_MS` (7d).

Voting rule (v1): **simple-majority of stake weight, with a
quorum gate**. Abstain counts toward the quorum but not the
majority. Passed = `(yesWeight > noWeight) AND (yesWeight +
noWeight + abstainWeight >= quorum)`.

Quorum default = `max(MIN_QUORUM_QUBIC, 1% of proposer's stake)`.
This prevents the "tiny-proposer tiny-quorum" attack vector
where a user with 1k QUBIC creates a proposal that passes with
just 10 QUBIC of votes.

### Routes — `services/ann/src/routes/proposals.ts`

Six endpoints under `/v1/proposals`:

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/v1/proposals` | public | Paged. Optional `?status=open&limit=50&offset=0`. |
| GET | `/v1/proposals/:id` | public | Includes fresh tally. |
| POST | `/v1/proposals` | JWT | Audit-logged. |
| POST | `/v1/proposals/:id/vote` | JWT | Audit-logged. Re-vote upserts. |
| POST | `/v1/proposals/:id/finalize` | public | Idempotent. Anyone can call after the deadline. Audit-logged. |
| POST | `/v1/proposals/:id/execute` | JWT | Audit-logged. Binding kinds only. |

Error codes mapped to HTTP statuses (404/400). Proposals with
`destinationAddress` / `amountQubic` / `parameterChange` get the
right validation per kind.

### Tests — `services/ann/src/tests/proposals.test.ts`

**26/26 vitest cases pass.** The test count went 13 → 26 during
this closeout (the original 13/26 split was a mock that didn't
filter or sort; the closeout pass built a proper Drizzle SQL
fragment evaluator for the mock and reordered the test
sequences so votes are cast before the deadline is backdated —
which is what the service actually requires).

Coverage:
- `createProposal` (7): basic creation, title validation, body
  length, destination address, non-positive amount, insufficient
  stake, default quorum rule.
- `castVote` (6): cached tally update, re-vote updates weight,
  self-vote forbidden, no-stake rejection, NOT_FOUND, NOT_OPEN.
- `finalise` (5): passed, rejected, expired, TOO_EARLY,
  idempotent.
- `executeProposal` (4): pushes to AigarthPool, NOT_PASSED,
  NON_BINDING, idempotent.
- `list / get` (3): ordering, NOT_FOUND, fresh tally.
- `recomputeTally` (1): idempotent.

### The mock-evaluation refactor (worth flagging)

The original mock for the Drizzle DB was built before the test
set grew to the point where first-row / no-row semantics leaked
between cases. The fix in the closeout pass:

- **Discriminate table kind** by walking the table's own column
  keys (e.g. `weightQubic !== undefined` → votes; otherwise
  proposals). The Drizzle pgTable's internal `_.name` is
  `undefined` in this build, so the prior check was a silent
  no-op.
- **Build a DB-name → TS-name map** at `.from()` time by
  walking the table's column keys (e.g. `created_at` →
  `createdAt`).
- **Evaluate `where()`** by reading the column (chunk[1]) and
  value (chunk[3]) from the SQL fragment, looking them up in
  the column map, and filtering.
- **Evaluate `orderBy()`** by reading the column + the desc /
  asc direction from chunks, mapping the column, and sorting.
- **Make `limit` / `offset` chainable AND thenable** so the
  service can chain `.limit(n).offset(m)` in any order and
  await the result.

The Drizzle `StringChunk` stores its literal SQL as a **string
array** (not a single string), so the desc/asc detection joins
the array before regex-matching. This is a build-specific quirk
of Drizzle 0.42.

For tests that exercise the deadline, the closeout also reorders
the test body: votes are now cast BEFORE the deadline is
backdated. The service correctly rejects votes after the
deadline (`EXPIRED`), so the previous test design was
self-defeating.

## Why Phase 14 + Phase 22 = governance

Phase 22 ships the on-chain multi-sig. Phase 14 ships the
off-chain surface. Together, the flow is:

```
user (with stake)
  → services/ann POST /v1/proposals          (Phase 14)
    → creates ann_proposals row
user (with stake)
  → services/ann POST /v1/proposals/:id/vote (Phase 14)
    → upserts ann_proposal_votes row
    → recomputes tally
  → POST /v1/proposals/:id/finalize         (Phase 14, anyone)
    → simple-majority + quorum
  → POST /v1/proposals/:id/execute          (Phase 14)
    → calls pool.submitTreasuryTransfer (Phase 22)
      → multi-sig signers approve
      → treasury transfer executes on Qubic
```

AIO pending, but the loop is exercisable end-to-end via the
simulator.

## Files

### Created
- `services/ann/src/services/proposals.ts`
- `services/ann/src/routes/proposals.ts`
- `services/ann/src/tests/proposals.test.ts`
- `apps/dashboard/scripts/register-phase-14.ts`
- `apps/dashboard/scripts/closeout-14.ts`
- `docs/deliveries/phase-14-delivery.md` (this file)

### Modified
- `services/ann/src/db/schema.ts` — added 3 enums + 2 tables +
  type exports (Proposal, NewProposal, ProposalVote,
  NewProposalVote, ProposalKind, ProposalStatus, VoteChoice)
- `services/ann/src/server.ts` — imported + registered
  `proposalsRoutes` after `governanceRoutes`

## Test counts at closeout
- **26/26** ann proposals (was 13/26)
- **176/176** ann service total (was 150/150 — +26 new)
- **22/22** monorepo typecheck
