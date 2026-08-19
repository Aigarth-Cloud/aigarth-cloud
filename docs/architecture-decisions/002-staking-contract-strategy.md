# ADR 002 — Staking Contract Strategy (Use Qearn As-Is, Do Not Clone)

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-01 |
| **Author** | Principal Architect, Qubic Intelligence Protocol / Aigarth Cloud |
| **Reviewers** | Engineering, Founders, (Legal — TBD) |
| **Builds on** | [ADR 001 — Intelligence Economy Layer](./001-intelligence-economy-layer.md) |
| **Decides** | Whether Aigarth Cloud should deploy its own QPI staking contract, extend the existing Qearn contract, or reuse Qearn as-is |
| **Outcome** | Reject a custom clone of Qearn. Use Qearn as-is. Layer an off-chain bridge in `services/economy` to turn observed Qearn locks into Aigarth compute credits. Re-evaluate only if Aigarth compute becomes a first-class on-chain primitive other Qubic apps want to call. |

---

## 1. Context

ADR 001 scoped the **off-chain** economy layer (`services/economy`) and deferred any on-chain settlement contract behind three explicit triggers. This ADR answers the follow-on question the off-chain layer raises: **for the "user locks QUBIC → gets compute access" flow, where does the lock actually live?**

Three candidates were considered:

1. **Use Qearn as-is.** Aigarth's `services/economy` observes Qearn locks (off-chain) and grants compute credits based on them.
2. **Extend Qearn.** Propose a small new procedure on the existing Qearn contract (e.g. `lockForCompute(staker, amount, weeks, computeBeneficiary)`) so the lock + grant is atomic.
3. **Clone Qearn.** Build `aigarth-staking.qpi` — a new QPI contract that re-implements Qearn's lock/unlock/penalty/yield from scratch.

## 2. Decision

**Adopt option 1: use Qearn as-is. Reject option 3 (clone) outright. Defer option 2 (extend) until the off-chain bridge has proven insufficient.**

The implementation plan is `services/economy` + a small Qearn watcher (fork of the existing `tx-monitor` worker). No new Qubic smart contract.

## 3. Why clone is wrong (the part to remember)

Cloning Qearn is the wrong answer for five specific reasons:

1. **Re-implementing audited, in-production code.** Qearn's penalty math, epoch reward distribution, and principal-non-touch invariant are live on Qubic mainnet and described in official docs. Any clone has to re-derive the math from the docs and re-audit. Every Qearn update becomes a port.

2. **It splits TVL.** Per docs, Qearn is *"the primary smart contract-based staking system of Qubic."* A clone competes with the recognized primary; users split between the two; neither contract gets the network effect. The clone ends up with less liquidity, less community trust, and worse UX.

3. **Aigarth-specific logic is application logic, not contract logic.** Compute credit = `f(locked_amount, lock_duration, current_capacity, user_tier)`. The first two come from Qearn; the last two are Aigarth-internal (compute availability, customer tier, capacity reservations). Encoding that in QPI buys nothing — Aigarth still needs an off-chain service to read the lock state and decide what credit to grant.

4. **The contract can't enforce what we actually want.** Aigarth's "must have X locked to get Y compute" rule is enforceable off-chain: the gateway / `services/compute` checks the user's Qearn position (via the watcher) before admitting a job. On-chain enforcement is unnecessary.

5. **Deploy lead time is 1–3 months per contract** (PR → GQMPROP → 451/676 quorum → 7-day node upgrade). A clone ships two sprints later than the off-chain bridge, and ships worse.

## 4. The right data flow

```
User (via apps/web)         Aigarth services                 Qubic mainnet
─────────────────────       ──────────────────               ─────────────

1. "Stake 1M QUBIC for 52w"  ─────►
                              services/economy validates
                              (auth, wallet link, balance)

2. User signs the intent     ─────►
                              services/qubic broadcasts
                              to Qearn contract address
                              (real addr from registry:
                              static.qubic.org/v1/general/
                              data/smart_contracts.json)

                            ─────────────────────────────►   Qearn contract
                                                              `lock` procedure
                                                              ◄─── tx_hash + tick

3. tx-monitor worker (fork)  ◄───
   watches Qearn events,
   writes aigarth_economy_locks
   (staker, amount, weeks,
    qearn_lock_id, tick, status)

4. Compute grant: every      ─────►
   epoch, services/economy    services/compute refreshes
   reads active locks and     the user's allocation
   grants credit = 
   amount × weeks × tier

5. User unlocks (early or    ─────►
   full term) via the same    services/economy notices unlock,
   intent path                recomputes credit tier,
                              burns the unbonded portion
```

The Aigarth-specific code is:

- A new `aigarth_economy_locks` table (staker, amount, weeks, qearn_lock_id, started_at, ended_at, status)
- A small Qearn watcher (fork of `services/qubic/src/workers/tx-monitor.ts`) that detects Qearn lock/unlock events
- The compute-grant logic in `services/economy/splits.ts` (already scoped in ADR 001)

No new Qubic contract. The whole thing ships in 1–2 sprints.

## 5. When to revisit (option 2 — extend, not clone)

A custom Aigarth contract becomes worth proposing **only** if one of the following becomes true:

- Aigarth compute becomes a first-class on-chain primitive that other Qubic dApps want to call. E.g. another app wants to say "this user has 1000 Aigarth-compute-credits; let them use my service." On-chain credit balances become necessary.
- Aigarth needs atomic "lock + grant" for legal/regulatory reasons (e.g. a regulated jurisdiction requires the credit to be enforced at the protocol layer, not by an application).
- Qearn's contract changes in a way that breaks Aigarth's integration (e.g. the lock procedure index moves, the penalty table changes) — and the Aigarth team can't get the change in a reasonable time.

In any of these cases, the right move is to **propose a small extension to Qearn**, not to clone it. Possible extensions:

- A `lockForCompute(staker, amount, weeks, computeBeneficiary)` procedure on the Qearn contract.
- An event emission that Aigarth's watcher can subscribe to.
- A read-only `getLockedForBeneficiary(address)` function.

These are 1-3 month GQMPROP cycles — not a 6-month clone project. Even in the worst case, the work is a small PR, not a parallel contract.

## 6. What this decision explicitly does NOT do

- It does not require any change to the existing `services/qubic` schema or routes.
- It does not block the existing Qearn stub in `services/qubic/src/client/stub.ts` (which is what the demo runs against today).
- It does not change the user-facing UX. Users still see a "Stake QUBIC" button; the button just sends a tx to the Qearn contract address instead of a custom contract.
- It does not require legal review of securities exposure (using Qearn as-is is the same as any other QUBIC holder using Qearn).
- It does not prevent Aigarth from offering a non-staking path to compute (e.g. paid compute credits, fiat subscriptions via Stripe).

## 7. Implementation — what ships next

| Item | SP | Notes |
|---|---|---|
| `aigarth_economy_locks` table | 1 | Small Drizzle migration in `services/economy`. |
| Qearn watcher (fork of `tx-monitor`) | 3 | Polls tx history; matches `receiver === qearn_address` + lock procedure. Writes to `aigarth_economy_locks`. |
| Compute-grant logic in `services/economy/splits.ts` | 2 | Reads active locks, calls `services/compute` to refresh allocation. |
| Per-epoch cron in `services/economy` | 2 | Re-grants based on updated lock state. |
| E2E test (lock → wait → grant) | 1 | Stub-backed; verifies the bridge. |
| **Total** | **~9 SP** | **One sprint.** |

Plus the previously-scoped `services/economy` work from ADR 001 (~6–8 SP for splits/payouts/bundles/contributors). Combined: ~15–17 SP for a complete off-chain economy, in roughly 2 sprints.

## 8. References

- [ADR 001 — Intelligence Economy Layer](./001-intelligence-economy-layer.md) — scoped `services/economy` and deferred on-chain contracts behind three triggers.
- `services/qubic/src/client/stub.ts` — Qearn-aware stub (Qearn contract address, week-bucket penalty, lock position tracking).
- `services/qubic/src/db/seed.ts` — Qearn contract as a non-active `validators` row.
- `services/qubic/src/workers/tx-monitor.ts` — the worker that the Qearn watcher forks from.
- Qubic docs: `docs.qubic.org/learn/tokenomics/`, `docs.qubic.org/developers/smart-contract-architecture/`.
- Qubic blog: "Qearn dApp: Expanding Staking & Transparency", "Introducing QEarn: Locking Coins for Yield".
- Qubic contract registry: `https://static.qubic.org/v1/general/data/smart_contracts.json`.
- Qubic contract source: `https://github.com/qubic/core/tree/main/src/contracts`.

## 9. Changelog

- **2026-08-01** — Initial decision (Accepted). Use Qearn as-is. Reject clone. Defer extension.
