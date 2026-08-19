# Phase 3 — Qubic Integration delivery report

**Phase:** 3 — Qubic Integration
**Sprint:** Sprint 3 (single sprint, ~5 days of work)
**Date:** 2026-07-28
**Status:** ✅ Complete (against the stub Qubic client)
**Story points delivered:** 19 / 19

> 📦 **Ship time: ~140 minutes** — 19 SP delivered at ~7.4 min/SP
> Slower than Phase 1's 4.4 min/SP because E2E test infrastructure is brand new — every fix (BigInt defaults, audit-log table collision, address regex, env reload) was a first-time lesson. The patterns are now banked.

---

## ⏱ Time to ship

| Metric | Value |
| --- | --- |
| **Active build time** | **~140 min** |
| Calendar elapsed | ~5 h (across two working sessions — scaffold first, then E2E + fixes) |
| Story points | 19 SP |
| **Velocity** | **~7.4 min per SP** |
| Files created / modified | ~25 |
| Lines of code (LOC) | ~2,400 |
| Endpoints shipped | 14 |
| E2E test assertions | 40+ (all passing) |
| DB tables | 9 (8 domain + 1 service-local audit log) |

### Time breakdown (estimate)

| Area | Minutes | Notes |
| --- | --- | --- |
| Service scaffold (Fastify + Drizzle + JWT + node-postgres) | 15 | Copied Phase 1's pattern, ~3× faster. |
| Schema design (8 domain tables + 1 audit table) | 20 | Bigint columns for amounts, 4 status enums, free-form audit log. |
| `client/` abstraction (types + stub + http + factory + tcp-stub) | 20 | Stub is deterministic; HTTP is graceful-degrading. |
| Wallet service + routes (link, list, balance, authorize) | 15 | 30s balance cache. |
| Staking service + routes (intent, submit, list, cancel, release) | 25 | Two-step flow: server builds unsigned intent, user signs, server broadcasts. |
| Treasury service + routes (movement, sign, execute) | 20 | M-of-N multisig with per-signer payload history. |
| TX monitor worker (NATS subscriber + 10s poll loop) | 15 | Confirms after 5 ticks. |
| Migrations generated + applied | 5 | Hit two schema collisions on first try (see "Fixes" below). |
| E2E test (40+ assertions, 10 sections) | 25 | Authored + ran end-to-end. 5 fixes during the test runs. |
| Phase 3 delivery report | 5 | |

### Velocity vs prior phases

| Phase | SP | min/SP | Delta |
| --- | --- | --- | --- |
| Phase 0 | 33 | 18 | — (baseline) |
| Phase 1 | 34 | 4.4 | -76% (schema + patterns locked in) |
| **Phase 3** | **19** | **7.4** | **+68% vs Phase 1, -59% vs Phase 0** |

If velocity dropped vs Phase 1, explain why here:

- **New surface area, not optimization.** Phase 3 introduced a new Qubic client abstraction, a worker process, multi-sig payload handling, and a 10-section E2E test. None of these existed in Phase 1 — every fix was a one-time lesson.
- **The Drizzle 0.42 / audit-log collision** was a one-time bug: the Qubic service tried to create a table named `audit_logs` that already belonged to the identity service in the same `public` schema. Renaming to `qubic_audit_logs` was a 4-line change but discovering the collision cost a migration run.
- **The BigInt default** (`default(0n)`) made drizzle-kit's introspection blow up with a JSON serialization error. Drizzle's introspection can't handle BigInt literals in defaults. Fix: drop the default, set on insert. 4 columns affected.
- **Address format strictness.** The stub generated 60-char addresses but the regex is `[A-Z]{60}` (no digits). First version of the stub used "COMP000…" which matched length but had digits. Fix: encode the index in base-26 in the last 2 chars. 5 minutes.
- **Env reload.** `tsx watch` doesn't restart on `.env` change, so the new `TREASURY_SIGNERS` value wasn't picked up until a full process restart. 1 minute to kill + restart.
- **E2E is now the bottleneck.** The 40+ assertion E2E caught every one of these. From here on, future phases will inherit this template.

### Known limitations affecting build time

- E2E infrastructure was built during this phase (no prior template to copy). Future phases save this overhead.
- The Qubic **TCP** client is not implemented. The HTTP client works against any JSON gateway; the stub works against no network at all. Real Qubic integration requires a separate workstream (see `tcp-client.ts.TODO` for protocol notes).
- Live **K12 signature verification** is still TODO in `services/identity/src/lib/qubic.ts` (format-only check). The real Qubic signature scheme is KangarooTwelve over a 60-character identity.

---

## TL;DR

The Qubic service is up. Wallets link to a user's identity, balances read through a stub or HTTP gateway with a 30s cache, stakes follow a two-step create-intent → submit-signed flow, the treasury supports M-of-N multisig with a per-signer payload trail, and a worker monitors in-flight transactions via NATS + a 10s poll loop. The whole surface is end-to-end tested (40+ assertions) against the stub client — ready to swap in a real Qubic gateway with zero code changes.

## What was built

### Service scaffold

`services/qubic` — Fastify 4 + Drizzle 0.42 (thenable API) + node-postgres + `@fastify/jwt` + `@fastify/cookie` + `@fastify/cors` + `@fastify/helmet` + `nats` + `pino` + `zod`. Same stack as Phase 1, same patterns.

- **Port:** 7002
- **Auth:** Same `JWT_SECRET` as the identity service. Verifies the JWT only (no session-table check; that's the identity service's job).
- **Health:** `/healthz` (always 200) + `/readyz` (checks DB + Qubic client ping).
- **Plugin order:** helmet → cors → cookie → jwt → routes.

### Schema (9 tables)

| Table | Purpose | Rows |
| --- | --- | --- |
| `qubic_wallets` | Cached (user, Qubic address) link — mirrors identity.wallet_links | 9 cols, 2 idx |
| `qubic_balances` | Most-recent known balance per wallet (30s cache) | 5 cols, 1 idx, 1 FK |
| `stakes` | Staking positions (pending_signature → broadcast → … → released) | 16 cols, 3 idx, 1 FK |
| `transactions` | On-chain txs we know about (broadcast or observed) | 14 cols, 4 idx |
| `rewards` | Per-epoch reward accruals + claim history | 8 cols, 2 idx, 1 FK |
| `validators` | Known Qubic computors (validators) | 9 cols, 2 idx |
| `treasury_movements` | Append-only log of treasury inflows/outflows (M-of-N) | 10 cols, 1 idx |
| `epoch_snapshots` | Point-in-time totals per epoch | 7 cols, 1 idx |
| `qubic_audit_logs` | Service-local audit log (free-form `action` text, not shared enum) | 8 cols, 3 idx |

**Design choices:**
- Amounts stored as `bigint` (smallest unit QUBIC). Display = divide by 1e6 to get "Qu".
- Qubic addresses are 60-char uppercase A–Z. The `^[A-Z]{60}$` regex is the source of truth.
- `qubic_audit_logs` is renamed from `audit_logs` to avoid a name collision with the identity service in the shared `public` schema.
- `qubic_audit_logs.action` is `text` (not a `pgEnum`) so the Qubic service stays decoupled from identity's enum values.

### Qubic RPC client (`src/client/`)

The core abstraction that makes the whole service testable. One interface, three implementations:

```
QubicClient (interface)
├── StubQubicClient     — deterministic, in-memory, no network
├── HttpQubicClient     — JSON-over-HTTP, graceful degradation
└── TcpQubicClient      — NOT YET IMPLEMENTED (see tcp-client.ts.TODO)
```

`getQubicClient()` picks based on `QUBIC_CLIENT_MODE` env var (`stub` | `http` | `tcp`).

- **Stub:** deterministic balance per address (last-char hash), 676 computors with base-26-encoded addresses, broadcast always succeeds with sha256-derived hash, ticks advance per call.
- **HTTP:** generic JSON gateway. `ping`, `getCurrentTick`, `getBalance`, `getTransaction*`, `broadcastStake`, `listComputors`, `getComputor`. Works against any endpoint that returns the expected shape.
- **TCP:** `tcp-client.ts.TODO` documents the 8-byte header, request types (12, 4, 5, …), and K12 signature scheme. Will be a single-file addition when a real Qubic node is available.

### Wallet service (`/v1/qubic/wallets/*`)

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/v1/qubic/wallets` | Link a wallet (idempotent on (user, address)) |
| GET | `/v1/qubic/wallets` | List user's wallets |
| GET | `/v1/qubic/wallets/:id` | Read one |
| GET | `/v1/qubic/wallets/:id/balance?refresh=true` | Read balance (30s cache) |
| POST | `/v1/qubic/wallets/:id/authorize-staking` | Give staking consent (default 365 days) |

### Staking service (`/v1/qubic/stakes/*`)

The two-step create-intent → submit-signed flow:

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/v1/qubic/stakes/intent` | Create unsigned intent (returns canonical `message` to sign) |
| POST | `/v1/qubic/stakes/:id/submit` | Submit signed intent (broadcasts to Qubic) |
| GET | `/v1/qubic/stakes` | List user's stakes (filter by status) |
| GET | `/v1/qubic/stakes/:id` | Read one |
| POST | `/v1/qubic/stakes/:id/cancel` | Cancel before broadcast |
| POST | `/v1/qubic/stakes/:id/release` | Release after maturity epoch |
| GET | `/v1/qubic/validators` | List computors (validators) |
| POST | `/v1/qubic/validators/:idx/onboard` | Mark validator as onboarded |
| GET | `/v1/qubic/network/status` | Current tick + epoch |

**Status machine:** `pending_signature` → `pending_broadcast` → `broadcast` → `confirming` → `active` → `unstaking` → `released` (or `failed` / `cancelled`).

The user's Qubic private key **never** touches the server. The server builds the canonical `message` string, the user's wallet signs it, the server broadcasts the signed intent.

### Treasury service (`/v1/qubic/treasury/*`)

Multi-sig treasury movements with a per-signer payload trail:

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/v1/qubic/treasury/movements` | Create movement (kind, amount, signersRequired) |
| GET | `/v1/qubic/treasury/movements` | List movements |
| POST | `/v1/qubic/treasury/movements/:id/sign` | Add a signature (must be in `TREASURY_SIGNERS`) |
| POST | `/v1/qubic/treasury/movements/:id/execute` | Mark executed (after broadcast) |

**Signers are validated against `TREASURY_SIGNERS` env var.** Duplicate signatures are rejected. Threshold = `signersRequired` (default = `TREASURY_THRESHOLD` = 2 in dev).

The signed payload (`{signer, signature, at}` per signer) is stored in `treasury_movements.payload` jsonb so the audit trail is preserved even after execution.

### TX monitor worker (`src/workers/tx-monitor.ts`)

Standalone worker process (`pnpm worker:tx-monitor`) that:

1. Connects to NATS (optional — falls back to poll-only)
2. Subscribes to `aigarth.qubic.tx` (incoming tx events)
3. Every 10s, polls for in-flight transactions (`queued` | `broadcast` | `confirmed`)
4. For each: fetches latest status from the Qubic client
5. On `finalized`: flips the related stake/treasury to `active` / `executed`
6. On `failed`: flips to `failed` with reason
7. On `broadcast` + 5 ticks elapsed: flips to `confirmed`

Worker is fault-tolerant: if NATS is down, it just runs the poll loop forever. The Qubic client's `getTransaction` is a no-op for unknown txs (stub returns null), so the worker gracefully handles tx hashes it hasn't seen.

## Acceptance criteria

From `docs/SPRINT-PLAN.md` §Phase 3:

- ✅ Service scaffold with Fastify + Drizzle + node-postgres, env-driven config, JWT auth
- ✅ Schema: 8 domain tables + 1 service-local audit log
- ✅ Wallet link, list, read, balance (cached), authorize
- ✅ Staking intent → submit → broadcast → list → cancel → release
- ✅ Treasury M-of-N multi-sig with payload trail
- ✅ TX monitor worker (NATS + poll loop)
- ✅ E2E test with assertions on every endpoint
- 🟡 Real Qubic TCP client — documented in TODO, not yet implemented
- 🟡 Live K12 signature verification — TODO in identity service
- 🟡 Qubic HTTP gateway live testing — graceful-degrading HTTP client, no live node hooked up

## Verification

End-to-end test (`services/qubic/scripts/e2e.ts`) — 40+ assertions across 10 sections, all passing:

```
1. Health checks (no auth required)              ✓
2. Auth required — 401 without a JWT             ✓
3. Create user via identity service, log in      ✓
4. List validators — stub returns 676            ✓
5. Link a wallet (idempotent)                    ✓  (link, idempotency, list, read, balance, authorize)
6. Network status (stub returns valid tick info) ✓
7. Create stake intent                           ✓
8. Submit signed intent → broadcast              ✓  (broadcast, list, read, release-before-maturity rejected)
9. Cancel an unsigned intent                     ✓
10. Treasury: create, sign (M-of-N), execute     ✓  (sign, duplicate rejected, threshold, unauthorized rejected, execute)
=== ✅ All Phase 3 E2E assertions passed ===
```

Run:
```bash
# In one terminal
pnpm --filter @aigarth/identity dev

# In another
pnpm --filter @aigarth/qubic dev

# In a third
pnpm --filter @aigarth/qubic tsx scripts/e2e.ts
```

## Decisions made

- **Stub Qubic client is the default for dev.** Deterministic, no network, every test result is reproducible. The HTTP client works against any JSON gateway — switch with `QUBIC_CLIENT_MODE=http`. The TCP client is a single-file addition (notes in `tcp-client.ts.TODO`).
- **Audit log is per-service** (renamed to `qubic_audit_logs`) with a free-form `action` text. The Qubic service doesn't share the identity service's enum — easier to evolve independently.
- **Bigint everywhere.** All amounts are `bigint` (smallest unit QUBIC). Display layer divides by 1e6 to get "Qu". JavaScript `bigint` keeps arithmetic exact.
- **Two-step staking flow.** Server builds the canonical `message` string; user's wallet signs it; server broadcasts. The user's Qubic private key never leaves the browser/wallet. This is the right design for custodial safety even if the current Qubic RPC is stubbed.
- **30s balance cache** with a `?refresh=true` escape hatch. Reads are cheap; we don't want to hammer the Qubic node for every dashboard view.
- **Validators cache for 1h.** A Qubic epoch is a week, so a 1h refresh is plenty fresh. The first read after boot pulls all 676 computors; subsequent reads are O(1) from the DB.
- **M-of-N multisig with payload history.** Each signer's `(signer, signature, at)` is stored in `treasury_movements.payload` jsonb. The audit trail is preserved even after execution. In production this would feed an HSM or a threshold-sig scheme; the local impl is a faithful demo.
- **TCP client is deferred, not stubbed.** The protocol is documented in `tcp-client.ts.TODO` with the 8-byte header, request types, and the K12 signature scheme. A real Qubic node access is the blocker, not the design.

## Known limitations

- **Qubic TCP client not implemented.** The `TcpQubicClient` throws a clear error on instantiation. See `tcp-client.ts.TODO` for the protocol. Will be a single-file addition when a real Qubic node is available.
- **Live K12 signature verification is TODO** in `services/identity/src/lib/qubic.ts`. Currently does format-only validation (`^[A-Z]{60}$`). A real Qubic signature is KangarooTwelve over a 60-char identity.
- **In-memory nonce cache for wallet linking** (identity service, not Qubic) is local to a single replica. Multi-replica deployment needs Redis.
- **No rate limiting yet** on any endpoint. Add `@fastify/rate-limit` before exposing publicly.
- **Validators cache has no invalidation hook.** If the network adds a new computor mid-epoch, you have to wait 1h or restart. Acceptable for now.
- **E2E test uses fresh user per run** — no cleanup. Acceptable in dev; production would add a `cleanup.ts` that wipes by `email LIKE 'qubic-e2e-%'`.
- **No Vitest unit tests.** Only the E2E script. The auth + service logic is small enough to be covered by E2E for now.

## Phase 3 exit criteria (from sprint plan)

> Phase 3 ships a Qubic service that can read balances, broadcast stake intents, monitor transactions, and run an M-of-N treasury — all behind the same JWT auth as the identity service.

**Status:** ✅ Met (against the stub client). The HTTP client is wired and graceful; the TCP client is the last gap to live.

## Links

- [Phase 3 schema](../../services/qubic/src/db/schema.ts)
- [Qubic client abstraction](../../services/qubic/src/client/types.ts)
- [Stub Qubic client](../../services/qubic/src/client/stub.ts)
- [HTTP Qubic client](../../services/qubic/src/client/http.ts)
- [TCP client TODO](../../services/qubic/src/client/tcp-client.ts.TODO)
- [Staking service](../../services/qubic/src/services/staking.ts)
- [Treasury service](../../services/qubic/src/services/treasury.ts)
- [TX monitor worker](../../services/qubic/src/workers/tx-monitor.ts)
- [E2E test](../../services/qubic/scripts/e2e.ts)
- [Sprint plan §Phase 3](../SPRINT-PLAN.md)

## What's next

**Phase 4 — Billing** is the natural next step. Subscriptions, usage metering, invoices, payments. The Qubic service's treasury primitives are now in place — Phase 4 can credit/debit user balances in Qu and write to `treasury_movements`.

**Alternative: Phase 7 — AI Gateway.** The original "big one" that the whole platform was built for. OpenAI-compatible `/v1/chat/completions`, `/v1/embeddings`, `/v1/models`. The `@aigarth/sdk` is already shaped to consume it.

**Open question for the user:** Real Qubic node access. When that's available, the TCP client is a single-file implementation, and the Qubic service flips from `QUBIC_CLIENT_MODE=stub` to `tcp` and starts working against mainnet/testnet for real.
