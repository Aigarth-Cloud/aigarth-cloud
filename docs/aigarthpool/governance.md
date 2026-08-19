# AigarthPool — governance sub-state

**Phase 22 of Aigarth Cloud.** This doc is the design spec for the
multi-sig governance sub-state that lives inside the AigarthPool
contract. It addresses **M1** (governance for `setAnnSplits`) and
**M2** (multi-sig treasury wallet) from
`docs/aigarthpool/audit-checklist.md`.

## Why this is in the same contract (for now)

The audit checklist recommends a sibling contract for the multi-sig.
We considered it and decided to embed the governance sub-state in
AigarthPool for the first iteration. The reasons:

- The on-chain operations are tightly coupled to the same QPI
  runtime (treasury receives yield, signer set is a sibling of
  splits, etc.). Cross-contract calls in QPI 1.x add latency and
  failure modes.
- The data model is small (`signers[]`, `threshold`,
  `pending_treasury_transfer`, `pending_signer_change`). Putting
  it in a sibling contract would mean another deploy, another
  state root, and another watcher path.
- The off-chain surface (services/ann, services/qubic, command
  centre) doesn't care which contract hosts the state. If we
  later split it out, no service changes.

When the AIO testnet lands, we'll evaluate the split. The
forward-compatible move is to introduce a thin interface in
`AigarthPoolClient` and a `multi-sig-contract` env var that
switches the backend. Not done yet.

## State

```c
struct AigarthPoolState {
  // ... existing users / splits / yield_owed / totals ...

  // Phase 22
  std::array<id, MAX_SIGNERS> signers;       // 32-byte Qubic identity each
  uint64 signer_count;                        // 1..MAX_SIGNERS (16)
  uint64 signer_threshold;                    // 1..signer_count
  id     treasury_wallet;                     // receives the treasury_bps share
  bool   governance_initialized;              // false until initGovernance is called

  PendingTreasuryTransfer pending_treasury_transfer;
  PendingSignerChange    pending_signer_change;
};
```

`MAX_SIGNERS = 16`. We picked 16 because the realistic multi-sig
range is 2-of-3 through 5-of-7, with headroom for emergency
signers and historical entries. Larger sets would just dilute
the value of the multi-sig.

`PENDING_OP_TTL_EPOCHS = 4`. A pending op that hasn't reached
threshold within 4 epochs is rejected by `execute*`. This is
enough time for signers to review without leaving the change
hanging forever.

## Procedures

### `initGovernance(initial_signers, signer_count, threshold)`

One-time, deploy-time call. Sets the signer set and threshold. The
treasury wallet defaults to `signers[0]`. Rejects:
- governance already initialized
- `signer_count` out of `[1, MAX_SIGNERS]`
- `threshold` out of `[1, signer_count]`

### `setAnnSplits(caller, ann_id, creator_bps, user_bps, treasury_bps, creator_wallet)`

Phase 22 update: caller is now authorized if EITHER:
- (a) the very first `setAnnSplits` for this ANN (registration),
  which implicitly grants creator status to the caller, OR
- (b) the ANN's existing creator, OR
- (c) a current governance signer (multi-sig fallback).

The emitted event carries `viaGovernance: true` for case (c) so
the audit log makes the path distinguishable.

### Treasury transfer flow

1. `submitTreasuryTransfer(caller, to, nonce)` — any current
   signer. One pending op at a time.
2. `approveTreasuryTransfer(caller, nonce)` — record approval.
   Idempotent.
3. `executeTreasuryTransfer(nonce)` — anyone can call once
   threshold is met. Updates `treasury_wallet`, clears the
   pending op. Rejects if expired or below threshold.

### Signer change flow

1. `submitSignerChange(caller, to_add, to_remove, new_threshold, nonce)`
   — submit add/remove sets and optional new threshold.
2. `approveSignerChange(caller, nonce)` — record approval.
3. `executeSignerChange(nonce)` — apply removes first, then adds,
   then threshold update.

`new_threshold = NO_THRESHOLD_CHANGE (0)` leaves the threshold
alone. The submit validation ensures the resulting signer set is
non-empty and the threshold (if changing) is in
`[1, resulting_count]`.

## Queries

- `getGovernanceState()` — `initialized`, `signers`,
  `threshold`, `treasury_wallet`, `has_pending_treasury_transfer`,
  `has_pending_signer_change`, `pending_treasury_transfer.approval_count`,
  `pending_signer_change.approval_count`. Public read.
- `getSigners()` — full signer list.

## Events

The simulator + watcher emit 7 new event kinds:

- `GovernanceInitialized` — `signers`, `threshold`, `treasury_wallet`
- `TreasuryTransferSubmitted` — `to`, `nonce`, `submittedBy`
- `TreasuryTransferApproved` — `nonce`, `approvedBy`,
  `approvalCount`, `threshold`
- `TreasuryTransferExecuted` — `from`, `to`, `nonce`
- `SignerChangeSubmitted` — `added`, `removed`, `newThreshold`,
  `nonce`, `submittedBy`
- `SignerChangeApproved` — `nonce`, `approvedBy`,
  `approvalCount`, `threshold`
- `SignerChangeExecuted` — `added`, `removed`, `newThreshold`,
  `nonce`, `newSignerCount`, `newThresholdValue`

`SplitsChanged` also got a new field: `actor` (who called it) +
`viaGovernance: boolean`. This is the audit trail for M1.

## Off-chain surface

- `GET /v1/aigarthpool/governance/state` — public read; the
  command centre polls this. JWT NOT required for read.
- `POST /v1/aigarthpool/governance/init` — JWT required.
- `POST /v1/aigarthpool/governance/treasury-transfer` — JWT
  required. Body is a discriminated union on `action`:
  `submit | approve | execute`.
- `POST /v1/aigarthpool/governance/signer-change` — JWT required.
  Same shape.

The watcher in `services/qubic/src/workers/aigarthpool-watcher.ts`
already logs every event generically; the new event kinds flow
through with no code change.

## Tests

- 36 new vitest cases in `packages/aigarthpool/tests/simulator.test.ts`
  covering the full governance flow (init / submit / approve /
  execute for both op kinds, threshold-met / threshold-not-met,
  expired, duplicate signer, removing non-signer, signer set
  freeze, nonce mismatch, idempotent approve).
- 30 prior cases still pass (no regressions).

## What's not done (and why)

- **No sibling contract yet.** The audit checklist recommends it;
  we deferred to keep the first iteration simple. See "Why this
  is in the same contract (for now)" above.
- **No pause / circuit breaker.** That's M4 in the audit
  checklist. It belongs in a separate phase.
- **No migration / insurance fund / rate limits.** M3, M5, M6.
  All post-M1+M2.
- **No on-chain deploy.** QPI build is hardware-gated (AIO Dev
  Kit). The design and simulator ship; the contract is exercised
  locally only.

## Open questions

- **Should `execute*` be permissionless or require a signer?**
  Current design: anyone can execute once threshold is met. The
  audit checklist is silent on this; the watcher pattern argues
  for permissionless (no single point of failure). We can
  restrict to signers if Qubic's transaction costs make spam a
  concern.
- **Should we use a separate "admin signer set" vs the main
  signer set?** The audit checklist suggests the treasury
  signers and the governance-of-governance signers could be
  different. The current design uses one set. If we ever need
  separation, it's a clear extension: add a second
  `admin_signers[]` and route `setAnnSplits` through it.
