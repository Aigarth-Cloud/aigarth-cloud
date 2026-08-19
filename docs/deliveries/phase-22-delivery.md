# Phase 22 — Multi-sig treasury (M1+M2)

**Status:** done — 100% — 1/1 task — 6/6 SP

**Active build time:** ~2h 30m (from the moment the user said "proceed" through closeout).

**SP velocity:** ~2.4 SP/h (higher than usual because the design + simulator + service wire-up is largely mechanical; the conceptual work — M1+M2 architecture — was already done in the audit checklist).

**Last updated:** 2026-08-09.

---

## What we shipped

The AigarthPool audit checklist's M1 (governance for `setAnnSplits`) and M2 (multi-sig treasury wallet) gates are now **designed and exercised locally**. The off-chain services + command centre know how to read + drive the multi-sig flow; the on-chain QPI build is hardware-gated behind the AIO Dev Kit (Phase 20.6).

### Architecture decision

The audit checklist recommends a **sibling contract** for the multi-sig. We deferred that to keep the first iteration simple. The on-chain state lives in AigarthPool; the off-chain surface (`AigarthPoolClient`) is forward-compatible with a future split — a `multi-sig-contract` env var would switch the backend without service changes. See `docs/aigarthpool/governance.md` for the full reasoning.

### Governance flow

```
initGovernance(initialSigners, threshold)        ← once at deploy
       │
       ▼
submitTreasuryTransfer(caller, to, nonce)       ← any current signer
       │
       ▼
approveTreasuryTransfer(caller, nonce) × N     ← until threshold met
       │
       ▼
executeTreasuryTransfer(nonce)                   ← anyone, once threshold met
       │
       ▼
treasuryWallet updated
```

Same shape for `submitSignerChange` / `approveSignerChange` / `executeSignerChange`. Pending ops expire after 4 epochs (`PENDING_OP_TTL_EPOCHS`).

### `setAnnSplits` authorization (M1)

The signature on `setAnnSplits` is unchanged. The authorization rules are:

1. **First registration** (ANN not yet active) — caller becomes the implicit creator.
2. **Subsequent update by the creator** — same as before.
3. **Update by a current governance signer** — **new** in Phase 22. The `SplitsChanged` event carries `actor` and `viaGovernance: true` so the audit log makes the path auditable.

### Files shipped

#### C++ / QPI contract (services/aigarthpool/contract/)

- `AigarthPool.h` — added `MAX_SIGNERS = 16`, `PENDING_OP_TTL_EPOCHS = 4`,
  `NO_THRESHOLD_CHANGE = 0`, `PendingTreasuryTransfer`,
  `PendingSignerChange`. Extended `AigarthPoolState` with
  `signers[]`, `signer_count`, `signer_threshold`, `treasury_wallet`,
  `governance_initialized`, and the two pending op structs. Added
  `procedure_initGovernance`, `procedure_submitTreasuryTransfer`,
  `procedure_approveTreasuryTransfer`, `procedure_executeTreasuryTransfer`,
  `procedure_submitSignerChange`, `procedure_approveSignerChange`,
  `procedure_executeSignerChange`, `query_getGovernanceState`,
  `query_getSigners`. Updated `procedure_setAnnSplits` to accept
  the governance-signer fallback.
- `AigarthPool.cpp` — implementations of all 9 new procedures +
  2 queries + 2 helpers (`find_signer_index`, `ids_equal`). The
  signer rotation applies removes first (sorted descending so
  indexes stay stable), then adds, then threshold.

#### TypeScript package (packages/aigarthpool)

- `src/types.ts` — added `GovernanceState`, `PendingTreasuryTransfer`,
  `PendingSignerChange` types. Extended `AigarthPoolEvent` with
  the 7 new event kinds (GovernanceInitialized,
  TreasuryTransferSubmitted/Approved/Executed,
  SignerChangeSubmitted/Approved/Executed). Added
  `actor` + `viaGovernance` to `SplitsChanged`. Extended
  `AigarthPoolClient` interface with the 7 new governance methods
  + `getGovernanceState` query. Exported
  `NO_THRESHOLD_CHANGE` and `PENDING_OP_TTL_EPOCHS` constants.
- `src/simulator.ts` — full mirror of the contract's governance
  surface. Idempotent approvals. Pending op TTL enforcement.
  Signer-set freeze (rejects to-add of an existing signer unless
  it's also in to-remove). One pending op per kind. Threshold
  clamping (if removes leave threshold above the new count, it
  drops to the count). `reset()` clears governance state.
- `src/client.ts` — `AigarthPoolQpiClient` extended with the new
  methods (all throw "unreachable" since the constructor throws).
- `src/index.ts` — exports the new types + constants.
- `tests/simulator.test.ts` — **36 new vitest cases** for the
  governance surface. Coverage:
  - `initGovernance`: rejects when called twice, threshold out of
    range, duplicate signers, empty signer set; sets treasury
    to the first signer; emits `GovernanceInitialized`.
  - `setAnnSplits`: rejects caller who is neither creator nor
    governance signer; accepts a governance signer with
    `viaGovernance: true`.
  - Treasury transfer: non-signer can't submit; rejects second
    pending op; non-signer can't approve; `execute` requires
    threshold; threshold-2 flow executes; approval idempotent;
    expired pending op rejects execute + clears; expired rejects
    approve too; nonce mismatch on approve; event ordering
    (Submitted/Approved×2/Executed).
  - Signer change: non-signer can't submit; rejects remove of
    non-signer; rejects second pending; threshold out of range;
    add-only execute; remove-only execute (threshold clamped);
    add + remove + new threshold execute; execute requires
    threshold; expired pending op; approval idempotent; event
    ordering.
  - `getGovernanceState`: returns initialized=false before init;
    returns the current signer set + threshold + treasury;
    includes pending op details with `pendingOpExpiresAtEpoch`.
  - Not-initialized calls: all four methods (submit/approve
    /execute treasury, submit signer change) reject with
    `NOT_INITIALIZED`.
- Total: **66/66 vitest cases pass** (up from 30).

#### Ann service (services/ann)

- `src/services/governance.ts` — thin service-layer wrapper
  (init / submit / approve / execute for both op kinds +
  `getGovernanceState`).
- `src/routes/governance.ts` — 4 new admin endpoints:
  - `GET  /v1/aigarthpool/governance/state` (public read)
  - `POST /v1/aigarthpool/governance/init`
  - `POST /v1/aigarthpool/governance/treasury-transfer`
  - `POST /v1/aigarthpool/governance/signer-change`
  
  Each POST is JWT-gated. The submit / approve / execute endpoints
  are a single route with a discriminated `action` body so the
  client picks the action in one HTTP call. Audit log entries
  are written for every successful action (`aigarthpool.governance.*`).
  Error codes are mapped to HTTP statuses (404 for NOT_INITIALIZED
  / NO_PENDING, 409 for ALREADY_INITIALIZED / PENDING_EXISTS,
  400 for the rest).
- `src/services/anns.ts` — updated the `setAnnSplits` call to
  pass the implicit creator as the caller.
- `src/server.ts` — registered `governanceRoutes`.

#### Qubic service (services/qubic)

- `src/workers/aigarthpool-watcher.ts` — no code change. The
  watcher already logs every event generically; the new event
  kinds flow through with no modification.

#### Dashboard (apps/dashboard)

- `src/app/api/aigarthpool/governance/state/route.ts` — server-side
  proxy to the ANN service. Public read; the dashboard never
  needs auth for the read path.
- `src/components/pages/governance.tsx` — `/governance` page.
  Shows initialized status, signer set, pending treasury
  transfer (with from/to/approvals), pending signer change
  (with add/remove/threshold), endpoint health, 3-step flow
  diagram. Polls every 10s.
- `src/app/governance/page.tsx` — page route.
- `src/components/tracker-nav.tsx` — added "Governance" nav item.

#### Docs

- `docs/aigarthpool/governance.md` — design spec.
- `docs/aigarthpool/audit-checklist.md` — M1 and M2 marked as
  designed. M3–M6 still not started.
- `docs/deliveries/phase-22-delivery.md` — this file.
- `ROADMAP.md` — status + Phase 22 entry.

#### Tracker

- New phase `phase-22` (1 task, 6 SP, status done, progress 100).
- Task `p22-multisig-treasury` (p0, 6 SP, status done).
- `apps/dashboard/scripts/closeout-22.ts` — idempotent closeout.

---

## Test counts

- **packages/aigarthpool**: 66/66 (was 30; +36 for governance)
- **services/ann**: 150/150 (unchanged — service tests use the
  simulator, not the new governance routes; the existing
  `setAnnSplits` calls in `anns.ts` were updated to pass the
  caller argument)
- **services/identity**: 28/28 (Phase 21 carryover, unchanged)
- **Monorepo typecheck**: 23/23 packages clean

---

## Honest limitations

- **QPI build is stubbed.** `AigarthPoolQpiClient` still throws
  "not yet wired" — the AIO Dev Kit is required to actually
  deploy the contract. The design and the simulator are
  exercised locally; the on-chain version waits on hardware.
- **No sibling contract.** The audit checklist recommends it;
  we deferred to keep the first iteration simple. The off-chain
  surface is forward-compatible with a future split (a
  `multi-sig-contract` env var would switch the backend).
- **No pause / circuit breaker.** M4. Belongs in a separate
  phase.
- **No rate limits.** M3. Cheap to add; out of scope for this
  phase.
- **No migration / insurance fund.** M5 / M6. Operational, not
  technical.
- **`execute*` is permissionless.** Anyone can call it once
  threshold is met. The audit checklist is silent on this; we
  made it open because the watcher pattern argues for
  permissionless execution (no single point of failure). Easy
  to restrict later.
- **The first `setAnnSplits` is the registration.** The caller
  becomes the implicit creator. This matches the contract spec
  but is slightly different from the simulator's old behavior
  (which required `caller === creatorWallet` even for the first
  call). Tests that pre-staged an ANN had to be updated to
  await the async `setAnnSplits` in `beforeEach`.

---

## Comparison to prior phases

| Phase | SP | Active time | Velocity | Notes |
|---|---|---|---|---|
| 19A Garden UX | 3.5 | ~3h | 1.17 | 4 tasks, garden UX |
| 19B Dataset | 9.5 | ~6h | 1.58 | 6 tasks, dataset service |
| 19C Training | 11 | ~7h | 1.57 | 6 tasks, training orchestrator |
| 19D sub-phases | ~6 | ~5h | 1.20 | 4 tasks (outcomes, retrain, A/B, actual-vs-predicted) |
| 20 (AigarthPool) | 5.5/6 | ~5h | 1.10 | 5/6 tasks, contract + simulator + services |
| 21 (Snap) | 2 | ~1h 50m | 1.10 | 1 task, end-to-end snap + command centre |
| **22 (Multi-sig)** | **6** | **~2h 30m** | **2.40** | **1 task, governance sub-state + service wire-up + command centre** |

Phase 22's velocity is the highest single-phase on record. The
mechanical parts (the simulator mirror, the service wrapper, the
command centre card) are all small; the conceptual work
(architecture, M1+M2 spec) was already done in the audit
checklist before this phase started.

---

## Next

- **M3 — Rate limits** on `stakeForAnn` per user (max 1,000,000
  QUBIC per transaction). Cheap, ~1 SP. Belongs in a small
  follow-up.
- **M4 — Circuit breaker** (`pause` procedure callable by
  governance). ~2 SP. A separate phase.
- **Sibling contract** — when the AIO testnet lands, evaluate
  splitting the governance sub-state into its own QPI contract.
  Off-chain services stay the same.
- **Custodian runbook** for the mainnet signer set (which keys
  are held by whom, recovery procedure, etc.). Operational, not
  technical.
