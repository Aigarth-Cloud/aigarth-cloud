# `@aigarth/qubic`

Qubic service. Phase 3 of the Aigarth roadmap.

Owns:

- **Wallets** — Qubic address ↔ user mirror of identity's wallet_links, with balance cache
- **Stakes** — stake creation flow (intent → signed → broadcast → confirmed → active → released)
- **Validators** — list of computors, onboarding
- **Treasury** — multi-sig (M-of-N) movement lifecycle
- **Transaction monitor** — NATS consumer + periodic poll for tx confirmations
- **Reward calculation** — per-epoch accrual (worker)

## Endpoints (Sprint 3)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/healthz` | none | Liveness |
| GET | `/readyz` | none | Readiness (DB + Qubic) |
| POST | `/v1/qubic/wallets` | bearer | Link a Qubic address to the user |
| GET | `/v1/qubic/wallets` | bearer | List user's wallets |
| GET | `/v1/qubic/wallets/:id` | bearer | Read one |
| GET | `/v1/qubic/wallets/:id/balance` | bearer | Balance (30s cache) |
| POST | `/v1/qubic/wallets/:id/authorize-staking` | bearer | Give staking consent |
| POST | `/v1/qubic/stakes/intent` | bearer | Build unsigned stake intent |
| POST | `/v1/qubic/stakes/:id/submit` | bearer | Submit signed intent |
| GET | `/v1/qubic/stakes` | bearer | List user's stakes |
| GET | `/v1/qubic/stakes/:id` | bearer | Read one |
| POST | `/v1/qubic/stakes/:id/cancel` | bearer | Cancel before broadcast |
| POST | `/v1/qubic/stakes/:id/release` | bearer | Release after maturity |
| GET | `/v1/qubic/validators` | bearer | List computors |
| POST | `/v1/qubic/validators/:idx/onboard` | bearer | Onboard a validator |
| GET | `/v1/qubic/network/status` | bearer | Current tick + epoch |
| POST | `/v1/qubic/treasury/movements` | bearer | Create a movement |
| GET | `/v1/qubic/treasury/movements` | bearer | List movements |
| POST | `/v1/qubic/treasury/movements/:id/sign` | bearer | Add a signature |
| POST | `/v1/qubic/treasury/movements/:id/execute` | bearer | Mark executed |

## Endpoints (Sprint 4 — pending)

- `POST /v1/qubic/stakes/:id/unstake` — start cool-down
- `GET  /v1/qubic/rewards` — list user's reward accruals
- `POST /v1/qubic/rewards/:id/claim` — claim accrued rewards

## Workers

- `pnpm worker:tx-monitor` — subscribes to NATS `aigarth.qubic.tx` for tx events; polls in-flight transactions
- `pnpm worker:rewards` — per-epoch reward accrual (Sprint 4)

## Local development

```sh
# 1. Bring up Postgres + NATS (already part of `pnpm stack:up`)
pnpm stack:up

# 2. Set up environment
cp .env.example .env
# edit .env to match identity service (DATABASE_URL, JWT_SECRET)

# 3. Apply migrations
pnpm db:generate
pnpm db:migrate

# 4. Start the service
pnpm dev  # port 7002
```

## Qubic client modes

`QUBIC_CLIENT_MODE` controls how the service talks to the Qubic network:

- `stub` (default for local dev) — deterministic in-memory mock. Balances
  derive from the address, broadcasts always succeed, ticks advance on
  each call. No network needed.
- `http` — JSON-over-HTTP to a gateway URL. Speaks to any node that
  returns the expected JSON shape.
- `tcp` — direct TCP to a Qubic node. **Not yet implemented.** See
  `src/client/tcp-client.ts.TODO` for protocol notes.

The interface is the same for all three modes. To plug in a real
client, implement the `QubicClient` interface from `src/client/types.ts`
and register it in `src/client/index.ts`.

## End-to-end test

```sh
# In one terminal
cd services/identity && pnpm dev
# In another
cd services/qubic    && pnpm dev
# In a third
cd services/qubic    && pnpm tsx scripts/e2e.ts
```

## Phase 3 exit criteria (Sprint 3 — met)

Per the sprint plan:
- Qubic service scaffolded ✅
- Wallet read endpoints ✅
- Transaction monitor (NATS consumer pattern) ✅
- Stake creation flow (signed intent → broadcast → confirm) ✅

Sprint 4 (next) covers:
- Stake cool-down + withdrawal
- Reward calculation + claim
- Validator onboarding (foundation laid; need full onboarding flow)
- Treasury wallet (multi-sig) — flow scaffolded
- Integration test: end-to-end stake → allocation

## Known limitations

- **TCP client not implemented.** The HTTP client works against any
  JSON gateway; the TCP client (which is what production needs) is
  documented but not built. See `src/client/tcp-client.ts.TODO`.
- **Session-table check skipped.** The Qubic service verifies JWTs but
  doesn't re-check the session row in identity's `sessions` table.
  Phase 7 (gateway) will do that at the edge.
- **Reward calculation is per-epoch placeholder.** Real reward math
  needs the Qubic network's distribution formula (depends on
  total staked, computor performance, etc.). Schema is in place; logic
  comes in Sprint 4.
- **No live reward amounts.** The reward worker will compute real
  amounts once a real Qubic client is in.
