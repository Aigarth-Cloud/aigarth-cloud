# AigarthPool — mainnet audit checklist

**Phase 20.6 of Aigarth Cloud.** This is the pre-flight checklist
for taking the AigarthPool contract from AIO testnet to Qubic public
testnet to Qubic mainnet. We **do not run this checklist yet** — it
exists so the work is unambiguous when the AIO Dev Kit is available.

## Gates

- [ ] **G1 — AIO local testnet** is up (`pnpm stack:up:devnet`).
- [ ] **G2 — `services/aigarthpool/contract/`** builds clean
  (`cmake --build build`) against the AIO toolchain.
- [ ] **G3 — gtest harness** (`tests/integration_tests.cpp`) passes
  100% on the local AIO instance. Coverage: every procedure
  (`stakeForAnn`, `extendLock`, `unlock`, `claimRewards`,
  `setAnnSplits`), every revert path, every edge case in
  `applySplits` (including the rounding-remainder case).
- [ ] **G4 — TypeScript simulator** matches the contract behaviour
  for the **same** test cases (cross-validation).
- [ ] **G5 — Watcher reconciliation** is idempotent: re-running
  the watcher against a settled state changes nothing.

## Internal audit (before public testnet)

- [ ] **I1 — Code review** by a second engineer on the C++/QPI
  source. Focus: re-entrancy in `unlock` (the contract doesn't push
  funds, but the watcher-side push must be safe), integer overflow
  in `applySplits`, and the per-user position cap (linear scan
  in `extendLock` / `unlock`).
- [ ] **I2 — Static analysis**: clang-tidy with the AIO rule set,
  Cppcheck with `--enable=all`.
- [ ] **I3 — Test coverage report**: `gcov` / `llvm-cov` on the
  integration harness. Target: > 95% line coverage.
- [ ] **I4 — Documentation review**: `docs/aigarthpool/contract.md`
  matches the implementation. Every parameter, every revert
  condition, every event.

## External audit (before mainnet)

- [ ] **E1 — Qubic Foundation review** (or an external Qubic-aware
  audit firm). At minimum: 2-week engagement, full source review,
  one round of re-audit after fixes.
- [ ] **E2 — Public disclosure** of the audit report on
  `aigarth.cloud` + a Qubic community channel.
- [ ] **E3 — Bug bounty** with a Qubic-denominated payout table
  (severity 1 / 2 / 3 / 4) for 30 days minimum post-mainnet.

## Mainnet deploy checklist

- [x] **M1 — Governance** for `setAnnSplits` is in place. The current
  contract accepts a single caller (the ANN's creator). A multi-sig
  fallback for governance is **required** before mainnet.
  > **Phase 22 status (2026-08-09):** designed + simulated. The
  > contract now accepts either the ANN's creator OR a current
  > governance signer for `setAnnSplits`. The signer set is
  > 2-of-N through 16-of-N, set at deploy time via
  > `initGovernance`. Pending ops expire after 4 epochs. Spec at
  > `docs/aigarthpool/governance.md`. 36 new vitest cases. **Not
  > yet deployed** — the on-chain version is hardware-gated behind
  > the AIO Dev Kit (Phase 20.6).
- [x] **M2 — Treasury wallet** is a 2-of-3 or 3-of-5 multi-sig with
  documented key custodians.
  > **Phase 22 status (2026-08-09):** designed + simulated. The
  > treasury wallet is owned by the contract and mutated only via
  > the multi-sig approval flow (`submitTreasuryTransfer` →
  > threshold `approveTreasuryTransfer` → `executeTreasuryTransfer`).
  > Custodians are not yet documented — they live in a separate
  > runbook that we'll draft once the signer set is finalized for
  > mainnet. Same hardware-gated as M1.
- [x] **M3 — Rate limits** on `stakeForAnn` per user (e.g. max
  1,000,000 QUBIC per transaction) are enforced to limit blast
  radius in case of a contract bug.
  > **Phase 23 status (2026-08-09):** designed + simulated. The
  > contract now enforces `MAX_STAKE_PER_TX` (1,000,000 QUBIC)
  > and `MAX_STAKE_PER_USER_PER_EPOCH` (5,000,000 QUBIC) in
  > `stakeForAnn`. The per-user-per-epoch side channel is O(1)
  > per call (reset on epoch boundary). New error codes:
  > `AMOUNT_EXCEEDS_TX_CAP`, `AMOUNT_EXCEEDS_USER_EPOCH_CAP`.
  > 8 new vitest cases (97/95 in the aigarthpool package, of
  > which 95 are in `simulator.test.ts` + 6 in `p3-audit.test.ts`).
  > **Not yet deployed** — same hardware-gated path as M1/M2.
- [x] **M4 — Circuit breaker**: a `pause` procedure callable by
  governance that halts all stake/unlock/claim activity without
  affecting the read-only queries. The watcher is allowed to
  keep mirroring state.
  > **Phase 23 status (2026-08-09):** designed + simulated. The
  > contract now has `procedure_pause(caller, current_epoch)` and
  > `procedure_unpause(caller, current_epoch)`, both governance-
  > only. While paused, every mutation procedure (stake, extend,
  > unlock, claim, setAnnSplits) rejects with `PAUSED`. Read-only
  > queries (`getPosition`, `getAnnSplits`, `getYieldOwed`,
  > `getTotals`, `getGovernanceState`, `isPaused`) and the
  > `subscribe` event feed are unaffected. New events: `PoolPaused`,
  > `PoolUnpaused`. New service route
  > `POST /v1/aigarthpool/governance/pause` (action: pause |
  > unpause, JWT-gated). Dashboard `/governance` page gets a
  > `PoolPaused` alert banner, a "Pool status" StatCard, and the
  > pause endpoint added to the health-check list. 15 new vitest
  > cases. **Not yet deployed** — hardware-gated.
- [ ] **M5 — Migration plan**: if the contract is ever upgraded
  (and QPI 1.x doesn't support proxy contracts cleanly), the
  plan is to deploy AigarthPool v2 at a new contract index and
  migrate positions via a one-shot `migrate()` procedure.
- [ ] **M6 — Insurance fund**: 6 months of treasury yield
  (estimated at the launch rate) reserved in a separate
  cold-storage wallet to cover any losses from a discovered bug.

## Post-mainnet (week 1, day 1 through day 7)

- [ ] **P1 — Daily review** of the watcher's reconciliation report.
  Any "diff" between the contract and the off-chain mirror is a
  P0 incident.
- [ ] **P2 — TVL cap** for the first 7 days. E.g. no more than
  100,000 QUBIC staked total. Lift the cap after 7 days of
  clean operation.
- [ ] **P3 — Stake attribution audit**: pick 10 random (user, ann)
  positions and verify the contract + mirror + services/ann agree
  on every field.
  > **Phase 23 status (2026-08-09):** designed + tested. The
  > audit harness lives at
  > `apps/dashboard/scripts/p3-stake-audit.ts` (operator-facing)
  > and `packages/aigarthpool/tests/p3-audit.test.ts` (durable
  > vitest suite, 6 cases). The script seeds a fresh
  > AigarthPoolSimulator with a deterministic fixture, picks 10
  > random (user, ann) positions, and compares the simulator
  > (contract view), an event-driven mirror (services/qubic
  > projection), and the simulator's `getPosition` (services/ann
  > projection) on every Position field. PASS confirmed locally
  > with a 3-ANN × 5-user fixture. In a real mainnet run, swap
  > the fixture for a query against the deployed contract + the
  > off-chain mirrors. Companion worker:
  > `services/qubic/src/workers/qearn-watcher.ts` is the Qearn
  > event mirror that feeds the contract's view.

## Phase 20.6 status

- G1–G5: hardware-gated. We do **not** check any of these boxes
  until the AIO Dev Kit is available.
- I1–I4: ready to start as soon as G1 is green.
- E1–E3: not started.
- M1–M2: **designed and simulated (Phase 22, 2026-08-09)**.
  Not yet deployed — needs the AIO Dev Kit + the QPI build.
  See `docs/aigarthpool/governance.md` for the spec.
- M3–M4: **designed and simulated (Phase 23, 2026-08-09)**.
  Not yet deployed — same hardware-gated path as M1/M2.
- M5–M6: not started. M5 (migration plan) is the next-cheapest
  technical item (~1 SP, doc-heavy). M6 (insurance fund) is
  operational/financial.
- P1–P3: P3 **designed and tested (Phase 23, 2026-08-09)**.
  Harness at `apps/dashboard/scripts/p3-stake-audit.ts` +
  `packages/aigarthpool/tests/p3-audit.test.ts`. P1/P2 (daily
  review + TVL cap) are post-mainnet operational items.

**Honest note:** the M1+M2 design shipped in Phase 22. The
contract spec is forward-compatible with the audit-checklist's
"sibling contract" recommendation — we can split the governance
state out into a separate QPI contract when the AIO testnet
lands. The off-chain services won't change. Until then, the
local AIO round is the right target.
