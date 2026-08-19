---
title: "Your first stake on Aigarth"
date: 2026-08-09
author: Aigarth DevRel
tags: [tutorial, staking, aigarthpool, qubic]
difficulty: beginner
estimatedMinutes: 15
runnable: true
---

# Your first stake on Aigarth

This tutorial walks through the end-to-end flow of staking QUBIC for an
ANN on Aigarth Cloud — connect a wallet, pick an ANN, sign the
intent, broadcast to Qubic, and verify the position is live on the
AigarthPool mirror.

The whole flow takes about 15 minutes, end to end, on testnet.

## Before you start

You'll need:

- A Qubic wallet with at least 1,000 testnet QUBIC. The default
  per-tx cap is 1,000,000 QUBIC (Phase 23 M3) but a 1k stake is
  enough to see the loop work.
- A linked Aigarth account. Sign up at the studio and link a
  Qubic wallet under **Settings → Wallets**.
- The `pnpm dev` stack running locally (or the testnet
  equivalent).

## Step 1 — pick an ANN

Open the studio at `http://localhost:3003/studio/anns` and find an
ANN you want to back. The list is sorted by stake-weighted vote
weight; for this tutorial, any open-source ANN will do.

Click into the ANN detail page. You'll see a **Stake** button in
the top-right. That's the entry point to the AigarthPool flow.

## Step 2 — sign the intent

The Stake button builds a `stakeForAnn` intent. Under the hood,
this is a Qubic transaction with:

- `inputType: 0x0001` (the AigarthPool's `stakeForAnn` procedure
  index)
- `input`: a serialised payload with `(user, annId, amount, lockEpochs)`
- `amount`: the principal in Qu-bit
- `destination`: the AigarthPool contract address

The studio renders this intent, you sign it in your wallet, and
broadcast.

## Step 3 — wait for confirmation

The studio polls the Qubic RPC for the broadcast result. Two ticks
later (about 2 seconds on testnet), the position is live. You'll
see it appear in the **My Stakes** view.

Behind the scenes:

1. The Qubic RPC confirms the transaction.
2. The AigarthPool's on-chain `stakeForAnn` procedure runs.
3. The `aigarthpool-watcher` worker in `services/qubic` mirrors
   the on-chain `PositionOpened` event into the off-chain
   `aigarth_stakes` table.
4. The studio's My Stakes view reads from that mirror.

## Step 4 — verify the position

```bash
curl -s http://localhost:7006/v1/anns/<annId>/stakes/me \
  -H "Authorization: Bearer $JWT" | jq
```

You should see your position with the principal in Qu-bit, the
lock-until epoch, and the current Qearn lock id (the AigarthPool
auto-locks the principal into Qearn for the lock duration).

## Common gotchas

- **Per-tx cap**: Phase 23's M3 limits a single `stakeForAnn` call
  to 1,000,000 QUBIC. Larger stakes are rejected with
  `AMOUNT_EXCEEDS_TX_CAP`.
- **Per-user-per-epoch cap**: 5,000,000 QUBIC. Same error code
  family. Wait for the next epoch to stake more.
- **M4 pause**: if the pool is paused (governance-only
  operation), all mutations reject with `PAUSED`. Read-only
  queries and the event feed are unaffected.

## Next steps

- Read the [AigarthPool contract spec](../aigarthpool/contract.md)
  for the full procedure surface.
- Skim the [audit checklist](../aigarthpool/audit-checklist.md)
  to see the production gate sequence.
- Try the [Your first ANN tutorial](./first-ann.md).
