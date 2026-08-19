# AigarthPool — On-Chain Settlement for the Aigard

**Phase 20 of Aigarth Cloud.** The bridge between "users stake QUBIC in
Qearn" and "users stake QUBIC *for an ANN*." Without AigarthPool, Qearn
stakes are fungible — there's no way to attribute yield to a specific
ANN. With AigarthPool, every stake is tagged with `(user, ann, amount,
weeks)` on-chain, and the yield is split on unlock between the creator,
the user, and the treasury.

## Why a contract, not a watcher

Qearn stakes are fungible by design. If we tried to attribute Qearn
yield to ANNs by watching the chain, we'd have a guess — multiple users
would stake the same amount, and we couldn't tell whose yield was
whose. AigarthPool fixes this by being the **only** entry point for
Aigard stakes. Users call `stakeForAnn(user, ann, amount, weeks)` on
AigarthPool, which then calls Qearn on the user's behalf and records
the (user, ann, amount, weeks) tuple in its own state. The watcher in
`services/qubic` is a **safety net** for reconciliation, not the
primary mechanism.

## How it works

```
User                 AigarthPool (QPI)           Qearn
 |                        |                       |
 |--stakeForAnn(u,ann,$X,52w)--->                 |
 |    (locks $X in AigarthPool                    |
 |     contract as collateral)                    |
 |                        |--lock($X, 52w)-------->|
 |                        |                       |
 |   ...weeks pass, Qearn yields~$Y...            |
 |                        |                       |
 |--unlock(u, ann)-------->|                       |
 |                        |--unlock()------------>|
 |                        |<-- $X + $Y ------------|
 |                        |                       |
 |   AigarthPool applies the splits:             |
 |     creator_bps * $Y  →  ANN creator wallet    |
 |     user_bps    * $Y  →  user wallet           |
 |     treasury_bps* $Y  →  AigarthPool treasury  |
 |     $X (principal)    →  user wallet           |
 |                        |                       |
```

The contract is the **source of truth** for `(user, ann, amount, weeks)`
and the splits. The off-chain mirror in `services/economy` / `services/ann`
is for query and UI.

## File layout

```
docs/aigarthpool/
  README.md                         # this file
  contract.md                       # full QPI contract spec
  audit-checklist.md                # mainnet pre-flight checklist
services/aigarthpool/
  contract/                         # C++/QPI source (real on-chain code)
    AigarthPool.h
    AigarthPool.cpp
    CMakeLists.txt
  src/                              # TypeScript client + simulator
    simulator.ts                    # in-process state machine (default)
    client.ts                       # Qubic RPC client (real)
    types.ts
    index.ts
  tests/
    simulator.test.ts               # vitest
  package.json
```

## Build strategy (no testnet hardware yet)

We **build for the contract now** and **simulate it locally until the
AIO Dev Kit is available**. The split is:

- **TypeScript simulator** (`services/aigarthpool/src/simulator.ts`) is
  the default backend. It is a pure state machine that mirrors the
  on-chain spec. Every service in the repo can be exercised against
  it without any Qubic infrastructure.
- **Real Qubic RPC client** (`services/aigarthpool/src/client.ts`) is
  the production path. It is wired up but not exercised until we
  have the AIO Dev Kit (Phase 20.6).
- The config switch `AIGARTHPOOL_MODE=simulator|qpi` picks the
  backend at boot time. Default in dev/test is `simulator`.

When the AIO Dev Kit lands (Phase 20.1), the AIO container is started
via `pnpm stack:up:devnet`, the C++ contract is built + deployed
(see `contract.md`), and `AIGARTHPOOL_MODE=qpi` flips the system to
the real backend.

## AIO Dev Kit — quick reference

The AIO Qubic Dev Kit (`ghcr.io/qubic/core-aio`) is the canonical local
Qubic testnet. It bundles Core + Faucet + Wallet + JSON-RPC into a
single Linux x86-64 image.

**Requirements** (verified against the AIO docs as of 2026-08):
- Linux x86-64 with AVX2 (Windows + macOS do not work)
- ~24 GB RAM (16 GB min, 24 GB comfortable)
- ~10 GB disk for the in-container database
- Ports: 30303 (P2P), 30000 (JSON-RPC), 8080 (Wallet UI)

**Bring it up:**

```bash
pnpm stack:up:devnet            # AIO container only (heavy)
# or:
docker compose -f infrastructure/docker-compose.yml --profile qubic-devnet up -d
```

**Verify it's up:**

```bash
curl http://localhost:30000/health
# → { "status": "ok" }
```

**Deploy the AigarthPool contract** (once AIO is up): see `contract.md`.

## What's in this phase

| Sub-task | Status | What it does |
|---|---|---|
| **20.1** AIO Dev Kit | done | `docker-compose.yml` `qubic-devnet` profile, `pnpm stack:up:devnet` script, this README. |
| **20.2** AigarthPool QPI contract | done | `services/aigarthpool/contract/AigarthPool.{h,cpp}` — the real on-chain spec, written to compile against AIO. |
| **20.3** Splits procedure | done | `applySplits(creatorBps, userBps, treasuryBps, totalYield)` — pure function in the contract; mirrored in the simulator. |
| **20.4** Client + services wire-up | done | `services/aigarthpool/src/{client,simulator}.ts`. Services call it via `getAigarthPoolClient()`. |
| **20.5** Watcher | done | `services/qubic` polls the AigarthPool (or simulator) for state changes and reconciles the local mirror. |
| **20.6** Testnet deploy + audit | gated | `audit-checklist.md` written; the actual deploy + audit wait for AIO hardware. |
