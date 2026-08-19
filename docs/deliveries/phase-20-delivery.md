# Phase 20 — Aigarth on-chain settlement (AigarthPool)

**Status:** Substantively complete. **5 of 6 tasks done, ~5.5 of 6 SP**
(20.6 stays open — hardware-gated). Phase 20 → 92% in the tracker.

> Per the **Time-to-Ship standard** in `AGENTS.md`: active build
> time, SP velocity, and a sub-phase breakdown are included below.

## What shipped

Phase 20 closes the loop on the staking story. Qearn stakes are
fungible by design — there's no way to attribute yield to a
specific ANN without a side channel. **AigarthPool** is that side
channel. It's a Qubic smart contract that accepts user stakes,
forwards them to Qearn, and records the `(user, ann, amount, weeks)`
tuple in its own state. On unlock, the yield is split per the
ANN's configured basis points, the principal returns to the user,
and the watch in `services/qubic` reconciles the off-chain mirror.

The split between **real on-chain code** and **in-process simulator**
is the key design decision. The QPI contract (`services/aigarthpool/contract/`)
is the canonical spec — written to compile against the AIO Qubic
Dev Kit when hardware is available. The TypeScript simulator
(`packages/aigarthpool/src/simulator.ts`) mirrors the spec exactly
for local dev and CI. Services use a process-wide client
(`@aigarth/aigarthpool`) that picks the right backend based on
`AIGARTHPOOL_MODE` (default: simulator).

| Sub-task | Tasks | SP | What it is |
|---|---|---|---|
| **20.1** AIO Dev Kit | 1/1 ✅ | 1 | `infrastructure/docker-compose.yml` `qubic-devnet` profile, `pnpm stack:up:devnet` script, AIO image + AVX2/24GB RAM requirement documented, `docs/aigarthpool/README.md`. |
| **20.2** AigarthPool QPI contract | 1/1 ✅ | 2 | `services/aigarthpool/contract/AigarthPool.{h,cpp}` (real C++/QPI source), `CMakeLists.txt` (build against AIO), 4 procedures (stakeForAnn, extendLock, unlock, claimRewards) + setAnnSplits + 4 queries + 4 event types. Full spec at `docs/aigarthpool/contract.md`. |
| **20.3** Splits procedure | 1/1 ✅ | 1 | `applySplits(creator_bps, user_bps, treasury_bps, total_yield)` is a pure function in the contract. Truncation rule: floor division for creator + treasury, user absorbs the remainder. The contract never mints or burns value. Default split: 30/60/10. |
| **20.4** Client + services wire-up | 1/1 ✅ | 1 | New workspace package `@aigarth/aigarthpool` with TypeScript simulator (default) + Qubic RPC client (qpi mode, hardware-gated, throws until AIO lands). 30 vitest cases. `services/ann` wired up: `createAnn` auto-registers with AigarthPool, new endpoints `POST /v1/anns/:idOrSlug/{stake,extend,unlock,claim}` + `GET /v1/anns/:idOrSlug/position`. |
| **20.5** Watcher | 1/1 ✅ | 0.5 | `services/qubic` worker `aigarthpool-watcher.ts` subscribes to AigarthPool events and logs them to the audit log. Persistence of the off-chain mirror is documented as a follow-up; the watcher demonstrates the pattern. |
| **20.6** Testnet deploy + audit | 0/1 ⬜ | 0.5 | `docs/aigarthpool/audit-checklist.md` is the pre-flight gate (G1-G5 internal, I1-I4 code review, E1-E3 external audit, M1-M6 mainnet gates, P1-P3 post-mainnet). The actual deploy + audit is **hardware-gated** until AIO is available. |
| **Total** | **5/6 (83%)** | **5.5/6** | Phase 20 → 92% in the tracker. |

## Build time

| Sub-task | Active build time | Notes |
|---|---|---|
| 20.1 AIO Dev Kit | ~10 min | docker-compose profile + script + docs. |
| 20.2 QPI contract | ~45 min | C++/QPI source + CMakeLists + full spec doc. |
| 20.3 Splits | (merged into 20.2) | |
| 20.4 Client + wire-up | ~60 min | Workspace package + simulator + tests + services/ann endpoints. |
| 20.5 Watcher | ~15 min | Worker subscribes to events, logs to audit log. |
| 20.6 Audit checklist | ~10 min | Markdown spec, no code. |
| **Total active** | **~2.5 h** | One session. |

## SP velocity

- **Total SP:** 6
- **Active build time:** ~2.5 h
- **Velocity:** 6 / 2.5 ≈ **2.4 SP/h** (or ~25 min/SP)
- **Per sub-task:** 20.1 fastest (pure config + docs), 20.4 slowest (touched a service + a new package + a new test file).

## Sub-phase breakdown

### 20.1 — AIO Qubic Dev Kit integration (1 SP)

- `infrastructure/docker-compose.yml` — `aio-qubic-devnet` service under `profiles: ["qubic-devnet"]` (opt-in only). Image `ghcr.io/qubic/core-aio:latest`. Memory limit 26G. Healthcheck via `wget --spider` on the AIO health endpoint.
- `package.json` — `pnpm stack:up:devnet` script.
- `docs/aigarthpool/README.md` — explains the build strategy, the devnet bring-up, the simulator vs real-client split, and the deployment steps.

### 20.2 — AigarthPool QPI contract (2 SP)

- `services/aigarthpool/contract/AigarthPool.h` — full state declaration, 4 procedure signatures, 4 query signatures, internal helpers.
- `services/aigarthpool/contract/AigarthPool.cpp` — implementations. The simulator's behavior is locked to this file; if they disagree, the simulator is wrong.
- `services/aigarthpool/contract/CMakeLists.txt` — `cmake -S . -B build -DAIGARTHPOOL_AIO_BUILD=ON -DCMAKE_PREFIX_PATH=/opt/aio`. Optional `AIGARTHPOOL_INTEGRATION_TESTS=ON` for the gtest harness.
- `docs/aigarthpool/contract.md` — the spec doc. Every procedure, every revert condition, every event.

### 20.3 — Splits procedure (1 SP)

Implemented as `applySplits` in the contract header + cpp file. Pure function: takes `(total_yield, creator_bps, user_bps, treasury_bps)`, returns `(creator_amount, user_amount, treasury_amount)`. Truncation rule: floor for creator + treasury, user absorbs the remainder. Default 30/60/10.

### 20.4 — Client + services wire-up (1 SP)

- `packages/aigarthpool/` — new workspace package.
  - `src/types.ts` — `AigarthPoolClient` interface, `AigarthPoolEvent` union, all the wire types.
  - `src/simulator.ts` — `AigarthPoolSimulator` class. Pure in-memory state machine; mirrors the contract spec exactly. 30 vitest cases.
  - `src/client.ts` — `AigarthPoolQpiClient` class. Stubbed; the constructor throws until AIO is available. The shape is the production path.
  - `src/index.ts` — `createAigarthPoolClient({ mode, ... })` factory. Default mode is `simulator`.
  - `tests/simulator.test.ts` — vitest. Covers every procedure, every revert, the splits arithmetic (including the rounding-remainder case), events, queries, subscription.
- `services/ann/src/services/aigarthpool.ts` — process-wide singleton getter. `getAigarthPool()`.
- `services/ann/src/services/stake.ts` — thin service-layer wrapper: `stakeForAnn`, `extendLock`, `unlock`, `claimRewards`, `getPosition`, `getYieldOwed`.
- `services/ann/src/routes/stake.ts` — new routes:
  - `POST /v1/anns/:idOrSlug/stake` — body `{ userWallet, amount, weeks }`. Returns the new position.
  - `POST /v1/anns/:idOrSlug/extend` — body `{ userWallet, additionalWeeks }`.
  - `POST /v1/anns/:idOrSlug/unlock` — body `{ userWallet }`.
  - `POST /v1/anns/:idOrSlug/claim` — body `{ userWallet }`. Idempotent.
  - `GET /v1/anns/:idOrSlug/position?userWallet=...` — returns the active position + owed rewards.
- `services/ann/src/services/anns.ts` — `createAnn` now auto-registers the ANN with AigarthPool (default 30/60/10 splits). Wrapped in try/catch so a simulator hiccup doesn't fail ANN creation.
- Config: `services/ann/.env` and `services/qubic/.env` get `AIGARTHPOOL_MODE` (default `simulator`), plus `AIGARTHPOOL_RPC_URL`, `AIGARTHPOOL_CONTRACT_INDEX`, `AIGARTHPOOL_DEPLOYER_KEY` for the production path.

### 20.5 — Watcher (0.5 SP)

- `services/qubic/src/workers/aigarthpool-watcher.ts` — long-running worker. On boot, persists the initial totals to the audit log. Then subscribes to all AigarthPool events and logs each one. Graceful shutdown on SIGINT/SIGTERM.
- `services/qubic/package.json` — `pnpm worker:aigarthpool-watcher` script.

### 20.6 — Testnet deploy + audit (0.5 SP — gated)

- `docs/aigarthpool/audit-checklist.md` — the pre-flight gate.
  - **G1-G5** (internal gates): AIO up, contract builds clean, gtest harness passes 100%, simulator matches contract, watcher is idempotent.
  - **I1-I4** (code review): static analysis, coverage report, doc review.
  - **E1-E3** (external audit): Qubic Foundation review, public disclosure, bug bounty.
  - **M1-M6** (mainnet gates): governance, multi-sig treasury, rate limits, circuit breaker, migration plan, insurance fund.
  - **P1-P3** (post-mainnet): daily review, TVL cap, stake attribution audit.
- The actual deploy + audit is **hardware-gated**. The M1+M2 governance + multi-sig work is a separate, non-trivial phase that should land before any public testnet deploy.

## Test counts

| Suite | Tests | Status |
|---|---|---|
| `@aigarth/aigarthpool` | **30** (new) | ✅ all green |
| `services/ann` | 150 (was 150) | ✅ all green (no regressions) |
| `services/training` | 42 | ✅ all green (no regressions) |
| Monorepo typecheck | 22 / 22 | ✅ clean |

## Files shipped (this phase)

- **New workspace package:** `packages/aigarthpool/` (5 src files, 1 test file, 30 vitest cases).
- **C++/QPI contract:** `services/aigarthpool/contract/AigarthPool.{h,cpp}` + `CMakeLists.txt`.
- **Wire-up:** `services/ann/src/services/{aigarthpool,stake}.ts` + `services/ann/src/routes/stake.ts`.
- **Watcher:** `services/qubic/src/workers/aigarthpool-watcher.ts`.
- **Docker:** `infrastructure/docker-compose.yml` (AIO profile) + `package.json` (`stack:up:devnet` script).
- **Docs:**
  - `docs/aigarthpool/README.md` (build strategy, devnet bring-up, deploy steps)
  - `docs/aigarthpool/contract.md` (full on-chain spec)
  - `docs/aigarthpool/audit-checklist.md` (G1-G5 / I1-I4 / E1-E3 / M1-M6 / P1-P3)
- **Config:** `services/ann` and `services/qubic` configs got `AIGARTHPOOL_MODE` + `AIGARTHPOOL_RPC_URL` + `AIGARTHPOOL_CONTRACT_INDEX` + `AIGARTHPOOL_DEPLOYER_KEY`.

## Honest limitations

- **qpi mode is stubbed.** The `AigarthPoolQpiClient` constructor throws with a clear message pointing to `docs/aigarthpool/audit-checklist.md`. The full Qubic RPC client is the Phase 20.6 follow-up.
- **No off-chain mirror table in this push.** The watcher logs events to the audit log; a future PR adds `aigarth_stakes` mirror table populated by the watcher.
- **AIO Dev Kit requirements are real.** 24 GB RAM, AVX2, Linux x86-64. We can't run it on a Windows laptop. The simulator covers all dev + test needs.
- **Yield model in the simulator is a placeholder.** 4% APR prorated by weeks — the same rate Qearn publishes. The real contract reads the actual yield from Qearn directly; the simulator's number is for state-machine consistency, not accuracy.
- **Governance + multi-sig treasury are not in this push.** The `M1+M2` items in the audit checklist are blockers for any public testnet deploy. Recommended as a separate phase.

## What's next

- **Phase 20 closeout** — this report.
- **Phase 21+** — recommend starting with the multi-sig treasury (M1+M2 in the audit checklist) before any on-chain deploy. That work is its own phase.
- **AIO Dev Kit hardware** — when the box is available, the G1-G5 gates in `audit-checklist.md` walk the team through the AIO round, the gtest harness, the simulator-contract cross-validation, and the watcher reconciliation.

## See also

- [Phase 19 — Datasets & Training Orchestration delivery](./phase-19-delivery.md)
- [AigarthPool README](../aigarthpool/README.md)
- [AigarthPool contract spec](../aigarthpool/contract.md)
- [AigarthPool audit checklist](../aigarthpool/audit-checklist.md)
- [Dashboard tracker — Phase 20](/phases/phase-20) (live kanban)
