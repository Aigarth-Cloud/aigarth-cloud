# AigarthPool — QPI contract spec

**Phase 20.2 / 20.3 of Aigarth Cloud.** Full on-chain spec for the
AigarthPool smart contract. The TypeScript simulator
(`services/aigarthpool/src/simulator.ts`) mirrors this spec; the
C++/QPI source (`services/aigarthpool/contract/`) implements it.

## Glossary

| Term | Definition |
|---|---|
| **User** | A 32-byte Qubic identity (the staker's wallet key). |
| **ANN id** | A 64-bit unsigned integer that maps 1:1 to a row in `services/ann.anns` (UUID v4 in the off-chain DB; truncated to u64 in the contract — collision risk is negligible for the foreseeable ANN count). |
| **Epoch** | One Qubic week. The Qearn lock cliff is in epochs. |
| **QUBIC** | The native token. All `amount` fields are in Qu-bit (the smallest unit, 1 QUBIC = 1,000,000 Qu-bit). |
| **Splits** | Basis-points configuration per ANN that determines how yield is divided between the creator, the user, and the treasury. |

## On-chain state

```
struct AigarthPoolState {
  // users[user_id] → vector<Position> (capped at 64)
  Position users[1_000_000][64];
  uint64   user_position_count[1_000_000];

  // splits[ann_id] → AnnSplits
  AnnSplits splits[65_536];

  // yield_owed[user_id][ann_id] → YieldOwed
  YieldOwed yield_owed[1_000_000][65_536];

  // aggregate stats (for query / dashboard)
  uint64 total_staked;
  uint64 total_positions;
  uint64 total_yield_paid;
  uint64 total_yield_to_creator;
  uint64 total_yield_to_treasury;
}
```

The contract is a **single-instance singleton**. There is one
AigarthPool per Qubic network, shared across all ANNs.

## Public procedures

### `stakeForAnn(amount, ann_id, weeks)` — user-initiated

1. Validate: `amount > 0`, `1 ≤ weeks ≤ 52`, `ann_id < MAX_ANNS`,
   `splits[ann_id].active`, `user_position_count[user] < 64`.
2. Call `Qearn.lock(amount, weeks)` and capture the `qearn_lock_id`.
3. Append a new `Position{ann_id, amount, lock_until_epoch, qearn_lock_id, active: true}` to `users[user]`.
4. Increment `user_position_count[user]`, `total_staked`, `total_positions`.

**Reverts** on Qearn failure (no state change).

### `extendLock(ann_id, additional_weeks)` — user-initiated

1. Find the active `Position` for `(user, ann_id)`. Revert if none.
2. Validate: `additional_weeks > 0`, `current_remaining + additional_weeks ≤ 52`.
3. Call `Qearn.extend(qearn_lock_id, additional_weeks)`.
4. Update `lock_until_epoch` in place.

### `unlock(ann_id)` — user-initiated

1. Find + mark the active `Position` for `(user, ann_id)` as `active = false`.
2. **Cliff check**: if `lock_until_epoch > current_epoch`, re-mark `active = true` and revert.
3. Call `Qearn.unlock(qearn_lock_id)` → returns `(principal, yield)`.
4. Apply splits to `yield` using `splits[ann_id]`. Truncation is absorbed by the user.
5. Set `yield_owed[user][ann_id] = { principal, user_yield, ann_id, claimed: false }`.
6. Update aggregate stats: `total_yield_paid`, `total_yield_to_creator`, `total_yield_to_treasury`, `total_staked -= principal`, `total_positions -= 1`.

**Note**: `unlock()` does NOT transfer funds out. The user calls
`claimRewards` separately to receive the principal + user share of
yield. The creator + treasury shares are pushed by the watcher
(`services/qubic`) once the on-chain `PositionClosed` event is
observed. This split — contract = state, watcher = delivery — keeps
the contract deterministic and avoids re-entrancy concerns.

### `claimRewards(ann_id)` — user-initiated

1. Read `yield_owed[user][ann_id]`. Revert if `claimed` or empty.
2. Transfer `principal + yield` to the user.
3. Set `claimed = true`.

**Idempotent** — second call is a no-op (early return).

### `setAnnSplits(ann_id, creator_bps, user_bps, treasury_bps, creator_wallet)` — caller = ANN creator

1. Validate: `creator_bps + user_bps + treasury_bps == 10_000`, each bps ∈ [0, 10_000].
2. Verify `caller` is the ANN's registered creator. (Off-chain identity
   join — the contract carries the wallet identity, services/ann
   carries the human identity mapping. The watcher reconciles.)
3. Update `splits[ann_id]`.

## Splits

`applySplits(total_yield, creator_bps, user_bps, treasury_bps)` is a
pure function:

```
creator_amount  = (total_yield * creator_bps)  / 10_000
treasury_amount = (total_yield * treasury_bps) / 10_000
user_amount     = total_yield - creator_amount - treasury_amount
```

The user absorbs the rounding remainder. The contract never mints or
burns value through truncation. The default split for a new ANN is
**30% creator / 60% user / 10% treasury**, set by
`setAnnSplits` at ANN registration time. ANNs can change splits at
any time; existing locked positions use the splits that were in
effect at unlock time.

## Yield model

The on-chain yield comes from Qearn. The contract treats it as an
opaque `(principal, yield)` pair returned by `Qearn.unlock()`. For
the simulator (`services/aigarthpool/src/simulator.ts`), we use a
deterministic placeholder: **4% APR, prorated by weeks** — i.e.

```
yield = amount * 400 * weeks / (10_000 * 52)
```

This matches Qearn's published rate as of 2026-08. When the simulator
is replaced by the real contract, the yield model follows Qearn
exactly. The simulator is a stand-in for the **state machine**, not
the yield model — so the off-chain code never assumes a specific
yield shape.

## Events

The contract emits three event types (consumed by the watcher in
`services/qubic`):

| Event | Payload | When |
|---|---|---|
| `PositionOpened` | `{ user, ann_id, amount, lock_until_epoch, qearn_lock_id }` | `stakeForAnn` success |
| `PositionClosed` | `{ user, ann_id, principal, yield, creator_amount, user_amount, treasury_amount }` | `unlock` success |
| `RewardsClaimed` | `{ user, ann_id, principal_paid, yield_paid }` | `claimRewards` success |
| `SplitsChanged` | `{ ann_id, creator_bps, user_bps, treasury_bps, creator_wallet }` | `setAnnSplits` success |

The watcher subscribes to all four and reconciles the off-chain
mirror. The mirror is **derived state** — the contract is the
source of truth.

## Rejected operations

The contract **never** accepts:
- A `stakeForAnn` with no matching registered ANN.
- A `stakeForAnn` with `amount == 0` or `weeks` out of [1, 52].
- A `stakeForAnn` for a user already at the per-user cap (64).
- An `unlock` before the cliff.
- A `setAnnSplits` whose bps do not sum to 10,000.

All of these revert with a clear error. The simulator mirrors
exactly — when the simulator and contract disagree, the simulator
is wrong.

## Deployment

1. Spin up AIO: `pnpm stack:up:devnet` (or `docker compose -f
   infrastructure/docker-compose.yml --profile qubic-devnet up -d`).
2. Wait for `curl http://localhost:30000/health` to return ok.
3. Fund the deployer via the AIO Faucet.
4. Build the contract: see `CMakeLists.txt` — `cmake -S
   services/aigarthpool/contract -B build -DAIGARTHPOOL_AIO_BUILD=ON
   -DCMAKE_PREFIX_PATH=/opt/aio && cmake --build build -j`.
5. Deploy: `aio-deploy build/AigarthPool.qpi --rpc
   http://localhost:30000 --key $DEPLOYER_KEY`.
6. Capture the deployed `contract_index` — set
   `AIGARTHPOOL_CONTRACT_INDEX=<index>` in every service's `.env`.
7. Set `AIGARTHPOOL_MODE=qpi` and restart the services.

See `audit-checklist.md` for the mainnet pre-flight checklist.
