# Phase 21 — MetaMask Qubic snap support

**Status:** done — 100% — 1/1 task — 2/2 SP

**Active build time:** ~1h 50m (from the moment we said "ship option B" through closeout).

**SP velocity:** ~1.1 SP/h.

**Last updated:** 2026-08-09.

---

## What we shipped

The official Qubic MetaMask snap (`npm:@qubic-lib/qubic-mm-snap`) is "designed for
developers and integrators, with end-user functionality coming soon." In particular
it does NOT expose a `signMessage` RPC: only `signTransaction`. So a vanilla
"Connect with MetaMask" sign-in can't sign an arbitrary auth nonce today.

Phase 21 ships **Option B**: wrap the auth message in a Qubic self-transfer and
let the snap sign that. The server unwraps the transaction, verifies the embedded
challenge matches the one it issued, and treats the SchnorrQ signature as a valid
proof of wallet ownership.

We also reserve **Option A** for the day the upstream snap adds a `signMessage`
RPC: the call site is one-line, the server's `kind: "message"` path already
accepts a 64-byte SchnorrQ over the canonical message, and the discriminated
`WalletFinishSchema` is stable.

### Flow

```
client (apps/web)
  1. detectQubicSnap()               → { hasMetaMask, hasQubicSnap }
  2. signChallengeAsTransaction()    → base64 self-transfer (sender==receiver,
                                       amount=0, tick=now, inputType=0x4147,
                                       input=canonical message)
  3. wallet_invokeSnap signTransaction → { signedTx } (base64, header+input+sig)
  4. POST /api/auth/wallet/finish    { kind: "transaction", signedTx, address, nonce }

server (services/identity)
  1. parseQubicTransaction(raw bytes) → { sourcePub, destPub, amount, tick,
                                          inputType, inputSize, input, signature,
                                          unsigned }
  2. addressMatchesPublicKey(sourcePub, address)  → K12 checksum match
  3. inputType === AIGARTH_AUTH_INPUT_TYPE (0x4147)
  4. input bytes === expectedMessage                (replay defense)
  5. K12(unsigned) + SchnorrQ_Verify(sourcePub, digest, signature)
  6. find-or-create user (kind: "transaction" in audit log) + issue JWT
```

### Defenses

- **Reserved `inputType = 0x4147` ("AG")** — server rejects any other value, so the
  snap can't be tricked into signing an unrelated Qubic transfer the user is being
  phished into.
- **Address ↔ public key binding** — the server re-derives the address from the
  tx's source pubkey and checks the K12 checksum (defends against address
  spoofing).
- **Embedded challenge** — the `input` bytes must equal the server-issued nonce
  message byte-for-byte (defends against replay with a different challenge).
- **Self-transfer only** — the wire tx is always a self-transfer (sender ==
  receiver, amount = 0). The snap can never be used to move real QUBIC through
  the auth flow.

---

## Files shipped

### Server (services/identity)

- `src/lib/qubic.ts` — added `AIGARTH_AUTH_INPUT_TYPE = 0x4147`,
  `parseQubicTransaction`, `verifyQubicTransactionSignature`, `ParsedQubicTransaction`,
  `QubicTxVerifyResult`. Kept the legacy 64-byte SchnorrQ path for the vault /
  window.qubic / dev stub.
- `src/services/walletAuth.ts` — discriminated `WalletFinishSchema` on `kind`
  (z.discriminatedUnion "message" | "transaction"); `walletAuthFinish` picks the
  right verifier per kind; `walletAuthStats()` extended with `by_kind` (30-day
  message/transaction/unknown counts), `recent_audit` (last 10 wallet-auth events
  with kind/label/IP hash), `snap_active_30d` flag. **Bug fix:** the
  `result.reason` reference was previously outside its scope — moved into the
  verifier blocks and returned in `WalletFinishResult.verification.reason`.
- `src/tests/qubicTx.test.ts` — 28 vitest cases (parser + verifier rejection
  paths + the public type).

### Client (apps/web)

- `lib/wallet/snap.ts` — `buildQubicSelfTransfer` (sender == receiver, amount = 0,
  inputType = 0x4147, input = challenge), `signChallengeAsTransaction` (calls
  `wallet_invokeSnap signTransaction`). `invokeSnapSignMessage` reserved for
  Option A and throws a clear error pointing to Option B.
- `components/marketing/connect-qubic-wallet.tsx` — snap path now goes
  end-to-end through the new `signChallengeAsTransaction` flow; the previous
  "snap returns the address, then sign with the vault" workaround is no longer
  the primary path. `submitFinish` helper split out to keep the message vs
  transaction kinds in one place.

### Command centre (apps/dashboard)

- `src/components/pages/wallet-auth.tsx` — by-kind breakdown card with
  side-by-side tiles (message vs transaction) + a stacked bar; `snap_active_30d`
  badge; new "Transaction audit feed" table (last 10 wallet-auth events with
  kind, address, label, IP hash, action); verifier banner updated to reflect
  the real K12 path.

### Tracker

- New phase `phase-21` (1 task, 2 SP, status done, progress 100).
- Task `p21-metamask-snap-connect` (p1, 2 SP, status done).
- `apps/dashboard/scripts/closeout-21.ts` — idempotent closeout script.

### Docs

- `docs/deliveries/phase-21-delivery.md` — this file.
- `ROADMAP.md` — status updated; Phase 21 entry added to the summary.

---

## Sub-phase breakdown

| Sub-task                              | SP | Status | Notes |
|---------------------------------------|----|--------|-------|
| 21.1 MetaMask snap end-to-end (Option B) + reserve Option A | 2 | done | All server + client + command centre + tests in one task |
| **Total**                             | **2** | **done** | |

---

## Test counts

- **services/identity**: 28/28 (new — `qubicTx.test.ts`)
- **services/ann**: 150/150 (unchanged)
- **services/aigarthpool**: 30/30 (unchanged)
- **services/training**: 42/42 (unchanged, last checked)
- **Monorepo typecheck**: 23/23 packages clean

---

## Honest limitations

- **The happy path is not unit-tested** — `verifyQubicTransactionSignature`'s
  real K12 + SchnorrQ_Verify path needs a full Qubic keypair, which is an
  integration test. The rejection paths (bad address, bad base64, wrong
  inputType, input mismatch, inputSize mismatch) are unit-tested. End-to-end
  sign-in via the snap requires MetaMask Flask + the snap installed in a real
  browser.
- **The K12 checksum derivation in the test suite** is a one-time
  `QubicHelper.getIdentity` call in `beforeAll`. If a future refactor changes
  how we derive the address, the tests will catch it via the `checksum_mismatch`
  rejection (the parser's `addressMatchesPublicKey` will fire first).
- **The `BigInt` literals in `lib/wallet/snap.ts`** are wrapped in `BigInt()`
  constructors because the web app's tsconfig targets ES2017. The numeric
  constants are small (`0`, `26`) so there's no perf impact.
- **`invokeSnapSignMessage` is a no-op stub** — when the upstream snap ships
  `signMessage`, the call site flips; no server change required.

---

## Comparison to prior phases

| Phase | SP | Active time | Velocity | Notes |
|---|---|---|---|---|
| 19A Garden UX | 3.5 | ~3h | 1.17 | 4 tasks, garden UX |
| 19B Dataset | 9.5 | ~6h | 1.58 | 6 tasks, dataset service |
| 19C Training | 11 | ~7h | 1.57 | 6 tasks, training orchestrator |
| 19D.1 Outcomes | 1.5 | ~50m | 1.80 | 1 task, decision outcomes |
| 19D.2 Auto-retrain | 2 | ~1h 30m | 1.33 | 1 task, retrain configs + events + cron |
| 19D.3 A/B shadow | 2 | ~1h 30m | 1.33 | 1 task, version router + shadow |
| 19D.4 Garden actual | 0.5 | ~30m | 1.00 | 1 task, two-line accuracy |
| **20 (AigarthPool)** | **5.5/6** | **~5h** | **1.10** | **5/6 tasks, contract + simulator + services** |
| **21 (Snap)** | **2** | **~1h 50m** | **1.10** | **1 task, end-to-end snap + command centre** |

Phase 21's velocity is on par with 19D sub-phases — same pattern of "1 well-scoped
task, end-to-end through server + client + command centre."

---

## Next

- **Multi-sig treasury (M1+M2 in `docs/aigarthpool/audit-checklist.md`)** as a
  separate phase before any public testnet deploy of AigarthPool. This is the
  last big gate before we can run a real on-chain testnet.
- When the AIO Qubic Dev Kit lands: walk through G1-G5 (build / gtest / simulator
  match / watcher idempotency) in `audit-checklist.md`.
- When the upstream MetaMask snap adds `signMessage`: flip the call site from
  `signChallengeAsTransaction` to `invokeSnapSignMessage`. No server change.
