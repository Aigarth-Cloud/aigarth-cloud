# Phase 23 — Pre-mainnet gates (M3 + M4 + p3) — Delivery

**Phase:** 23
**Status:** done (100%)
**Story points:** 6 / 6 (M3 = 1, M4 = 2, p3 = 3)
**Active build time:** ~2h 30m
**Velocity:** 2.4 SP/h (matches Phase 22; the design was already in audit-checklist.md)

## TL;DR

Closed the pre-mainnet gates from `docs/aigarthpool/audit-checklist.md`
that don't require external coordination. M3 (rate limits) and M4
(circuit breaker) are designed, simulated, and exercised end to end.
p3 (Qearn watcher + stake-attribution audit) is a new services/qubic
worker plus a P3 audit harness (vitest + standalone script). The
on-chain QPI build remains hardware-gated behind the AIO Dev Kit
(Phase 20.6).

## What's shipped

### 23.1 — M3 Rate limits (1 SP)

- `MAX_STAKE_PER_TX = 1,000,000 QUBIC` (1e12 Qu-bit) on `stakeForAnn`.
  Blast-radius limit on a single call.
- `MAX_STAKE_PER_USER_PER_EPOCH = 5,000,000 QUBIC` (5e12 Qu-bit) per
  user per epoch. O(1) per call — reset on epoch boundary via a
  side-channel (`user_staked_this_epoch[user_idx]` +
  `user_last_stake_epoch[user_idx]`).
- New error codes: `AMOUNT_EXCEEDS_TX_CAP`,
  `AMOUNT_EXCEEDS_USER_EPOCH_CAP`.
- Contract side: `services/aigarthpool/contract/AigarthPool.{h,cpp}` —
  constants + checks in `procedure_stakeForAnn`. The contract's
  per-tx check sits alongside the existing `amount == 0` and
  `weeks` checks. The per-user-per-epoch check is a per-user
  reset + sum-against-cap.
- Simulator side: `packages/aigarthpool/src/simulator.ts` —
  `MAX_STAKE_PER_TX` + `MAX_STAKE_PER_USER_PER_EPOCH` constants;
  new fields on `UserState`; the per-user cap resets on epoch
  advance (the simulator's `advanceEpochs` triggers a per-user
  reset for the affected user on the next call).
- 8 new vitest cases. The per-user-per-epoch cases use multiple
  1M QUBIC stakes (5 stakes of 1M = 5M total) because the
  per-tx cap rejects larger single stakes first. A subtle
  test design check that the simulator's pause gate (M4) and
  rate cap (M3) compose correctly: paused pool rejects all
  mutations before the rate cap fires.

### 23.2 — M4 Circuit breaker (2 SP)

- `paused: bool` added to `AigarthPoolState` (C++) and the
  simulator's `AigarthPoolSimulator` (TypeScript).
- `procedure_pause(caller, current_epoch)` and
  `procedure_unpause(caller, current_epoch)` — governance-only,
  reject with `NOT_INITIALIZED` / `NOT_SIGNER` otherwise.
  Idempotent (re-pausing is a no-op but still emits).
- All mutation procedures (`stakeForAnn`, `extendLock`, `unlock`,
  `claimRewards`, `setAnnSplits`) reject with `PAUSED` while the
  flag is set. The pause gate is the FIRST check, so it preempts
  every other validation. Read-only queries and the `subscribe`
  event feed are unaffected — the watcher in `services/qubic`
  keeps mirroring state even while paused, which matches the
  audit-checklist's intent.
- New events: `PoolPaused` / `PoolUnpaused` (with `by: signer`,
  `atEpoch: number`).
- New client methods on `AigarthPoolClient`: `pause(caller)`,
  `unpause(caller)`, `isPaused()`. The QPI stub at
  `client.ts` throws "unreachable" for all three (the real QPI
  client will wire them when the AIO Dev Kit lands).
- `GovernanceState` extended with `paused: boolean` so the
  command centre can read the flag in one round-trip.
- New service route `POST /v1/aigarthpool/governance/pause` with
  a discriminated body (`action: "pause" | "unpause"`, `caller`).
  The AigarthPool client enforces governance-only authorization;
  the route layer additionally requires JWT. Audit log entries
  per call.
- Dashboard `/governance` page (`apps/dashboard/src/components/pages/governance.tsx`):
  - New `PoolPaused` alert banner at the top (only renders when
    `state.paused === true`); explains which procedures are halted
    + the M4 audit-checklist reference.
  - New "Pool status" `StatCard` showing "Active" (emerald) or
    "Paused" (amber) with the right icon (`PlayCircle` /
    `PauseCircle` from lucide).
  - The `pause` endpoint added to the live endpoint-health
    checklist.
  - `paused: boolean` added to the `GovernanceState` type.
  - Mutations still go through the wallet UI (same pattern as
    the submit/approve/execute endpoints — the dashboard is a
    read-only command centre, JWT-gated mutations live in the
    wallet).
- 15 new vitest cases. Includes the pause-during-claim edge
  case (pause after `unlock` is set, but before `claimRewards`
  — the claim is still rejected).
- New service methods in `services/ann/src/services/governance.ts`:
  `pausePool(caller)`, `unpausePool(caller)`, `isPaused()`.

### 23.3 — p3 Qearn watcher + P3 stake-attribution audit (3 SP)

**Qearn watcher (services/qubic side):**
- New worker `services/qubic/src/workers/qearn-watcher.ts`:
  - Polls the Qearn contract address (`QUBIC_QEARN_CONTRACT_ADDRESS`)
    on the loop interval (`QEARN_WATCHER_POLL_INTERVAL_MS`,
    default 15s).
  - Fetches via the existing `QubicClient` interface (works in
    both stub mode and http mode). The stub is the source of
    truth for local dev; the http client is the production
    path.
  - Classifies each new transaction as `lock` (amount > 0) /
    `unlock` (amount = 0) / `other` (catch-all).
  - Persists to a new `qubic_qearn_events` mirror table with
    a unique index on `tx_hash` (idempotent on restart).
  - Publishes a JSON event to NATS subject
    `aigarth.qubic.qearn` (configurable via `NATS_QEARN_SUBJECT`).
  - Logs each event to the local `qubic_audit_logs`.
  - Graceful shutdown on `SIGINT` / `SIGTERM`. NATS failures
    are best-effort (the loop continues without downstream
    fan-out).
  - Disable with `QEARN_WATCHER_ENABLED=false`.
- New schema in `services/qubic/src/db/schema.ts`:
  `qubic_qearn_events` table + `qearn_event_kind` enum
  (`lock` / `unlock` / `yield` / `other`). Yield and other are
  reserved for the real Qubic RPC event log; the stub-mode
  watcher only emits `lock` / `unlock` (the heuristic for those
  is the amount).
- New config keys in `services/qubic/src/config/index.ts`:
  `QUBIC_QEARN_CONTRACT_ADDRESS` (default is the stub
  placeholder `QEARN` + 55 A's; replace with the real address
  when wired to mainnet), `QEARN_WATCHER_ENABLED` (default true),
  `QEARN_WATCHER_POLL_INTERVAL_MS` (default 15_000),
  `NATS_QEARN_SUBJECT` (default `aigarth.qubic.qearn`).
- New package script: `pnpm --filter @aigarth/qubic worker:qearn-watcher`.

**P3 stake-attribution audit (operator + test):**
- Operator-facing script: `apps/dashboard/scripts/p3-stake-audit.ts`.
  Seeds a fresh `AigarthPoolSimulator` with a 3-ANN × 5-user
  fixture (10 positions, 2 matured + unlocked + claimed), then
  picks 10 random (user, ann) positions and compares across the
  three views:
  - **Simulator** (contract view) — `pool.getPosition`
  - **Mirror** (services/qubic projection) — event-driven,
    tracks the FIRST active position per (user, ann)
  - **services/ann** (ann-service view) — `pool.getPosition` via
    the AigarthPool client (services/ann reads directly from
    the same client in simulator mode)
  Prints PASS/FAIL + the first divergence (with all three observed
  values) on failure. Exit code 0 = pass, 1 = fail.
- Durable vitest suite: `packages/aigarthpool/tests/p3-audit.test.ts`
  with 6 cases:
  1. agrees across simulator / mirror / ann for 10 random positions
  2. agrees when sample size exceeds available positions
  3. agrees with a fresh seed (sample selection is deterministic)
  4. detects a divergence when the mirror drops an event
  5. detects a divergence when the simulator's state is tampered
     with
  6. empty mirror (no events seen) flags every active position
     as a divergence
- Both the script and the test use a deterministic seed
  (default `0xC0FFEE`) so the same fixture gives the same
  sample. Real mainnet runs swap the fixture for a query
  against the deployed contract + the off-chain mirrors.

## What the audit checklist now looks like

```
M1  ✅ designed + simulated (Phase 22)
M2  ✅ designed + simulated (Phase 22)
M3  ✅ designed + simulated (Phase 23, this PR)
M4  ✅ designed + simulated (Phase 23, this PR)
M5  ⬜ not started — migration plan, doc-heavy (~1 SP)
M6  ⬜ not started — insurance fund (ops)
G1–G5 ⛔ hardware-gated (AIO Dev Kit)
I1–I4 ⬜ ready to start as soon as G1 is green
E1–E3 ⬜ not started
P1  ⬜ post-mainnet
P2  ⬜ post-mainnet
P3  ✅ designed + tested (Phase 23, this PR)
```

## Test counts

| Package        | Before | After | Delta |
|----------------|--------|-------|-------|
| aigarthpool    | 66/66  | 95/95 | +29   |
| ann            | 150/150| 150/150| 0    |
| identity       | 28/28  | 28/28 | 0     |
| dashboard      | 0      | 0     | 0     |
| **total**      | 244/244| 273/273| +29  |

aigarthpool delta breakdown:
- 8 new M3 cases (`stakeForAnn rate limits (M3)`)
- 15 new M4 cases (`circuit breaker (M4): pause / unpause authorization`
  + `circuit breaker (M4): pause gates mutations but not queries`)
- 6 new p3 cases (`P3 stake-attribution audit (Phase 23.3)`)

## Files changed (this iteration)

**Created:**
- `apps/dashboard/scripts/register-phase-23.ts`
- `apps/dashboard/scripts/closeout-23.ts`
- `apps/dashboard/scripts/p3-stake-audit.ts`
- `services/qubic/src/workers/qearn-watcher.ts`
- `packages/aigarthpool/tests/p3-audit.test.ts`
- `docs/deliveries/phase-23-delivery.md` (this file)

**Modified:**
- `apps/dashboard/src/components/pages/governance.tsx` — `paused`
  field + PoolPaused banner + Pool status StatCard + endpoint
  list
- `services/ann/src/services/governance.ts` — `pausePool` /
  `unpausePool` / `isPaused` service methods
- `services/ann/src/routes/governance.ts` — `/pause` route +
  `paused` field in `/state` response
- `services/qubic/src/db/schema.ts` — `qubic_qearn_events` table
  + `qearn_event_kind` enum
- `services/qubic/src/config/index.ts` — Qearn watcher config
  keys
- `services/qubic/src/workers/qearn-watcher.ts` (new, see above)
- `services/qubic/package.json` — `worker:qearn-watcher` script
- `services/qubic/.env` — Qearn watcher env vars
- `services/aigarthpool/contract/AigarthPool.h` — M3 constants,
  `paused` field, procedure_pause/unpause declarations, `paused`
  in GovernanceState
- `services/aigarthpool/contract/AigarthPool.cpp` — M3 checks in
  `procedure_stakeForAnn`, pause gate in all mutation
  procedures, M4 procedure_pause/unpause implementations
- `packages/aigarthpool/src/types.ts` — M4 `pause`/`unpause`/
  `isPaused` on `AigarthPoolClient`, `paused` on
  `GovernanceState`, `PoolPaused` / `PoolUnpaused` events
- `packages/aigarthpool/src/simulator.ts` — M3 checks in
  `stakeForAnn`, M4 pause gate in all mutation procedures,
  pause/unpause implementations, `paused` in
  `getGovernanceState`, `isPaused()` query
- `packages/aigarthpool/src/client.ts` — M4 stub methods
  (unreachable, mirror the rest)
- `packages/aigarthpool/tests/simulator.test.ts` — 23 new cases
  (8 M3 + 15 M4)
- `docs/aigarthpool/audit-checklist.md` — M3, M4, P3 marked
  designed + tested

## What's still blocking public mainnet (in priority order)

1. **M5 — Migration plan** (~1 SP, doc-heavy). Spec the
   `migrate()` procedure for moving positions from a v1 to a v2
   contract. Documentation-heavy; no new code beyond the
   procedure stub.
2. **M6 — Insurance fund** (ops). 6 months of treasury yield
   reserved in a separate cold-storage wallet. The Qubic
   team will likely want to hold this in a multi-sig
   (governance-overseen) so it's a 2-3 SP coordination task
   more than a code task.
3. **G1–G5 — AIO testnet** (hardware-gated). When the AIO Dev
   Kit is available, run the full gtest harness against the
   local AIO instance. The simulator + contract spec are
   already aligned.
4. **20.6 — Testnet deploy** (~0.5 SP, post-G1). Compile
   against the AIO toolchain, deploy to Qubic public testnet,
   run the e2e loop (training → AigarthPool → Qearn) against
   real testnet.
5. **I1–I4 — Internal audit** (~1 week with a reviewer). C++
   code review, clang-tidy + cppcheck, gcov coverage report,
   doc-vs-impl review.
6. **E1–E3 — External audit** (3-4 weeks). Qubic Foundation or
   an external Qubic-aware audit firm. Two-week engagement +
   re-audit after fixes.
7. **P1, P2** — Post-mainnet operational items (daily review
   + TVL cap for week 1).

Honest limit: the AIO Dev Kit is the long pole. Everything
else can move in parallel or back-to-back. M5 + M6 are
~1-2 weeks of coordination. I1-I4 + E1-E3 are 4-6 weeks
of calendar time. The M3 + M4 + p3 work in this phase
moves the AIO round from "blown" to "designed and tested"
in spirit — when the hardware lands, the AIO gate is the
last thing before the public chain.
