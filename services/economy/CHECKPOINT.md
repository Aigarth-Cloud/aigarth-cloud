# Services/economy — Checkpoint 1

**Date:** 2026-08-01
**Owner:** Principal Architect + AI agents
**Phase:** Phase 18 (Off-Chain Economy) — in progress, ~60% complete

This is a logical checkpoint, not a git commit (this workspace is not a git repository). It captures the state of the `services/economy` build at the moment we paused, so a future agent or human can pick up cleanly.

## What shipped in this push (✅)

### Package skeleton
- `package.json` — `@aigarth/economy`, port 7010, scripts for `dev`, `build`, `db:migrate`, `worker:qearn-watcher`, `smoke`
- `tsconfig.json` — extends `@aigarth/config/tsconfig/node.json`
- `drizzle.config.ts`
- `.env.example` — full env template (incl. `QUBIC_QEARN_CONTRACT_ADDRESS`, `QEARN_*_PROCEDURE_INDEX`, watcher config, economy defaults)
- `.gitignore`
- Workspace registration: automatic via `pnpm-workspace.yaml` glob (`services/*`)

### Config + DB
- `src/config/index.ts` — Zod-validated env, same pattern as `services/qubic`/`services/billing`
- `src/db/index.ts` — Drizzle + `node-postgres` pool
- `src/db/migrate.ts` — migration runner
- `src/db/schema.ts` — 6 tables (see below)

### Schema (the off-chain mirror per ADR 001 §4.1 + ADR 002 §7)
- `economy_contributor_shares` — multi-creator revenue share (bps) per ANN
- `economy_payout_runs` — one row per scheduled payout for an ANN over a period
- `economy_payout_recipients` — per-recipient rows; tracks the actual Qubic tx
- `economy_bundle_listings` — N-ANN bundles (the "intelligence index" use case)
- `economy_aigarth_locks` — off-chain mirror of observed Qearn locks (writer: Qearn watcher; reader: compute grant)
- `economy_audit_logs` — service-local audit log

### Lib
- `src/lib/ids.ts` — `uid()`
- `src/lib/audit.ts` — `logActivity(action, message?, opts)`
- `src/lib/settlement.ts` — thin wrapper around `services/qubic` for QUBIC settlement; `settleViaQubicService(url, req)` returns `SettlementResult`; throws `SettlementError` on non-2xx

### Services
- `src/services/splits.ts` — **pure revenue-split math**:
  - `applySplit({ totalRevenueQubic, contributors, platformFeeBps })` — exact-integer split, validates bps sum ≤ 10_000, returns `SplitResult` with per-recipient payouts
  - `computeGrantUnits(amountQubic, weeks)` — Qearn lock → compute-credit units (1 unit per 1M QUBIC per week, by default)
  - `toRecipientShare(dbRow)` — adapter
  - `MAX_CONTRIBUTORS_PER_ANN = 64`
- `src/services/contributors.ts` — `listShares`, `getShare`, `upsertShare`, `replaceShares` (transactional, validates bps sum === 10_000)
- `src/services/locks.ts` — `listLocksForUser`, `listActiveLocks`, `getLock`, `getLockByQearnId`, `recordLock` (idempotent on `qearnLockId`, computes initial grant), `markUnlocking`, `markEnded` (revokes grant), `totalActiveGrantForUser`
- `src/services/bundles.ts` — full CRUD on bundles
- `src/services/payouts.ts` — `assemblePayout` (idempotent on ann+period) and `settleRun` (loops recipients, calls `settleViaQubicService`, updates statuses to `settled` or `partial`)

## What's left to do (❌)

1. **`src/services/splits.smoke.ts`** — pure-math smoke test (no DB). Run via `pnpm --filter @aigarth/economy smoke`.
2. **`src/routes/`** — 5 route files (health, contributors, locks, bundles, payouts). Each mirrors the pattern in `services/qubic/src/routes/wallets.ts` (Fastify + Zod + JWT auth via `app.authenticate`).
3. **`src/server.ts`** — Fastify bootstrap (helmet, cors, cookie, jwt, `app.authenticate`, route registration).
4. **`src/index.ts`** — `start()` wrapper + signal handling.
5. **`src/workers/qearn-watcher.ts`** — the bridge worker:
   - Polls `services/qubic` for tx history filtered to `toAddress === QUBIC_QEARN_CONTRACT_ADDRESS`
   - Parses the `inputType` to distinguish `lock` vs `unlock` procedures
   - Calls `recordLock()` / `markUnlocking()` / `markEnded()` accordingly
   - Loop interval: `QEARN_WATCHER_POLL_INTERVAL_MS` (default 15s)
6. **Drizzle migration SQL** — run `pnpm db:generate` once Postgres is up to produce the `0000_*.sql` migration file. Schema is in `src/db/schema.ts` and ready.
7. **Typecheck** — `pnpm typecheck` (run once routes/server/worker are in).
8. **Web `/dashboard/portfolio` enrichment** — wire to the new SDK methods; right now the page is all mock data.
9. **Phase 18 in the tracker** — register in `apps/dashboard` with the work broken into tasks; add ADR 001 + ADR 002 + this checkpoint doc.
10. **`@aigarth/sdk`** — add an `Economy` resource exposing the new endpoints. Will be needed for the web app wiring (#8) and is generally good hygiene.

## Notes for the next agent

- **DB integration tests** are not in this push. Once Postgres is up, the right next step is to run the migration (`pnpm --filter @aigarth/economy db:migrate`) and add a `pnpm --filter @aigarth/economy e2e` script that exercises `assemblePayout` + `settleRun` end-to-end against the stub.
- **`settleRun` currently leaves `wallet_address` blank** when assembling. The recipient's wallet comes from a join with `services/identity`, which is not yet wired. Real broadcast will work once that join lands. Until then, `settleRun` is a no-op (all recipients stay `pending`).
- **The Qearn watcher's `inputType` mapping** is parameterized via `QEARN_LOCK_PROCEDURE_INDEX` and `QEARN_UNLOCK_PROCEDURE_INDEX` env vars. Defaults are 1 and 2, matching the standard Qearn procedure indices. Verify against `https://static.qubic.org/v1/general/data/smart_contracts.json` before going to mainnet.
- **`computeGrantUnits`** is intentionally simple (linear in amount × weeks). The real scaling story (per-tier multipliers, per-ANN multipliers, capacity caps) is a separate problem and lives outside this checkpoint.
- **Bundle listings store a `listingId` foreign-key-in-spirit to `services/marketplace`.** The marketplace record itself is created in `services/marketplace`; this row holds only the bundle-specific metadata. Inserting a bundle requires the marketplace listing to exist first.
- **Schema migrations are not yet generated.** Until `pnpm db:generate` runs against a real Postgres, the migration folder is empty. That's fine for a checkpoint — the source of truth is `src/db/schema.ts`.

## Estimated remaining effort

| Item | SP |
|---|---|
| Splits smoke test | 1 |
| Routes (5 files) | 3 |
| Server + index | 1 |
| Qearn watcher | 3 |
| Drizzle migration generation | 0.5 (just runs `db:generate`) |
| Typecheck pass | 0.5 |
| SDK economy resource | 2 |
| Web portfolio enrichment | 3 |
| Phase 18 in tracker | 1 |
| **Total remaining** | **~15 SP** |

That's about 1.5–2 sprints of focused work. The Qearn watcher is the most novel piece (the rest is straightforward Fastify CRUD).
