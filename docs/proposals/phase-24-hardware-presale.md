# Phase 24 — Hardware node presale (Aigarth Cloud)

> **Status:** Proposal, awaiting approval
> **Date:** 2026-08-09
> **Source mechanic:** Otto One presale (https://myotto.ai/presale) — two-stage payment + spot reservation + counter + preorder schema
> **Related docs:** [`docs/BRD.md`](../BRD.md) §3 (M4 — hardware roadmap), [`docs/PRD.md`](../PRD.md), [`docs/aigarthpool/audit-checklist.md`](../aigarthpool/audit-checklist.md) (M3/M4 closed in Phase 23, M5/M6 + I1-I4 still open)

---

## 1. Why this exists

Aigarth Cloud has a compute marketplace and a node operator system. The marketing site doesn't yet have a public way to **reserve a compute spot in advance of mainnet**. We want one before mainnet goes live, because:

- A spot reservation commits real QUBIC to the platform, which is the strongest pre-launch signal we can get.
- A pre-launch reservation list makes the mainnet launch concrete (people are waiting for their reserved unit).
- Yield earned on the held deposit is a differentiator versus fiat-deposit competitors — our deposit earns while it waits.

The mechanic is borrowed from Otto (the agent-computer startup) and adapted to QUBIC-native flows. We keep the parts that work (two-stage payment, FAQ-driven trust, preorder schema), drop the parts that don't (shipping, return shipping, hardware restock fee), and add the parts we can do uniquely (yield on the held deposit, USD-anchored pricing on a volatile token).

---

## 2. The mechanic in plain English

A user visits `/nodes` on the marketing site. They see:

> **Reserve a tier 1 compute spot. $599 total, $30 deposit.**
> Your deposit earns yield while you wait. Pay the balance when mainnet launches. Cancel any time before that for a full refund.

They click **Reserve**, link their Qubic wallet (existing flow), sign a QUBIC transaction for $30 worth of QUBIC at the current rate, and get a confirmation. Their dashboard now shows:

- Reservation status: `spot_held`
- Deposit paid: 67,415,730 QUBIC (~$30 at the rate at reserve time)
- Yield accrued: 124,500 QUBIC (Qearn, since they opted in at reserve)
- Balance due: $569 USD, charged in QUBIC at the rate when mainnet activates

When mainnet activates, the system emails them 14 days before to confirm. They click **Confirm**, sign a QUBIC transaction for the balance (less yield accrued), and their reservation moves to `confirmed`. Compute allocation unlocks.

If they release before mainnet, the $30 is refunded in QUBIC at the release-time rate. After mainnet, the existing `releaseReservation` partial-refund-with-penalty flow applies.

That's the whole mechanic. The rest of this doc is the implementation.

---

## 3. Tier ladder

| Tier | Final USD | Deposit USD | Ratio | Ship trigger | Phase |
|---|---|---|---|---|---|
| **Tier 1** | $599 | $30 | 5.0% | 14-day window #1 after mainnet | **This phase (24)** |
| **Tier 2** | $899 | $50 | 5.6% | 14-day window #2 | Phase 25+ |
| **Tier 3** | $1,299 | $75 | 5.8% | 14-day window #3 | Phase 25+ |

Tier 1 is the only tier the marketing page surfaces this phase. Tiers 2 and 3 are valid in the schema (the `tier` column accepts `1` / `2` / `3`), but the marketing layer rejects attempts to reserve them and the dashboard shows no actions for them. They become real when their own phases start.

Tier 1 mirrors Otto's 8GB/256GB spec on the dollar anchor. The QUBIC amount is a derived value, recomputed at each charge moment from the price oracle. At $0.000000445/QUBIC (Aug 2026), tier 1 is ~1.35B QUBIC final / ~67.4M QUBIC deposit. The user never sees the QUBIC amount in marketing copy; the wallet UI surfaces it at the moment of signing.

---

## 4. UX flow

### 4.1 Reserve

1. User lands on `/nodes`. Sees the tier 1 spec, FAQ, compare table, schema.org Product/PreOrder markup.
2. Clicks **Reserve for $30**. Prompted to log in or sign up (existing auth flow).
3. After login, prompted to link their Qubic wallet (existing `startLinkWallet` / `finishLinkWallet` flow, with `prewarmQubic()` already in place per recent work).
4. **Yield opt-in toggle**: "Earn yield on your deposit while you wait? (off by default — turn on for ~3-5% APY credited on confirm)". Optional.
5. Wallet shows the exact QUBIC amount at current rate (e.g. "67,415,730 QUBIC ≈ $30"). User signs.
6. Tx broadcasts. UI shows pending state. On confirmation, reservation moves to `spot_held`.
7. Email confirmation with reservation ID, dashboard link, and a "What happens next" summary.

### 4.2 Hold

- Reservation row exists in `spot_held` status. Deposit USD value is fixed at $30. QUBIC amount is the actual amount paid. The rate at reserve time is stored for audit.
- If yield opt-in: Qearn lock is created at the QUBIC amount of the deposit. Qearn yield accrues in QUBIC. Yield is stored as a credit on the reservation row, not a separate ledger entry.
- The user can release any time before mainnet for a full refund.

### 4.3 Confirm (14-day window after mainnet)

1. Mainnet activation triggers an email to every `spot_held` reservation holder: "Your unit is ready. Balance due: $569 USD. You have 14 days to confirm or release."
2. User opens the dashboard, sees the reservation with the new status `awaiting_confirm`. Balance shows: $569 USD minus yield_credit_qubic (in USD at the current rate).
3. Two actions: **Confirm** or **Release**.
4. **Confirm**: Wallet UI shows the QUBIC amount for the balance at current rate. User signs. Status → `confirmed`. Compute allocation unlocks via the existing reservation flow (Phase 6).
5. **Release**: Refund flow per the existing `releaseReservation` with a small penalty (e.g. 5% of the deposit, the same penalty as existing reservations).

### 4.4 After confirm

- Reservation is functionally a normal `services/compute` reservation with the existing lifecycle (active, extended, expired, released).
- The presale layer is a thin wrapper on top. The presale state machine is: `pending_funding` → `spot_held` → (`awaiting_confirm` → `confirmed` | `released`). After `confirmed`, it merges with the regular reservation lifecycle.

---

## 5. Architecture

### 5.1 Data model

**`node_reservations`** (new table in `services/compute`):

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK → `users.id` |
| `tier` | smallint | `1` / `2` / `3`. Default `1`. |
| `status` | text | `pending_funding` / `spot_held` / `awaiting_confirm` / `confirmed` / `released` |
| `deposit_usd_cents` | bigint | e.g. `3000` for $30.00 |
| `deposit_qubic` | numeric(38,0) | Actual QUBIC amount paid |
| `qubic_usd_rate_at_reserve` | numeric(20,10) | For audit + refund calc |
| `qubic_usd_rate_at_confirm` | numeric(20,10) | Nullable until confirm |
| `yield_opt_in` | boolean | Default false |
| `yield_credit_qubic` | numeric(38,0) | Accrued yield, 0 until confirm |
| `qearn_lock_id` | text | Nullable; the on-chain lock reference if opted in |
| `tx_hash_reserve` | text | Unique constraint; idempotency |
| `tx_hash_confirm` | text | Nullable; unique constraint |
| `confirm_window_opens_at` | timestamptz | Set when the system triggers the 14-day email |
| `confirm_window_closes_at` | timestamptz | confirm_window_opens_at + 14 days |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**`node_escrow`** (new table in `services/economy`):

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `reservation_id` | uuid | FK → `node_reservations.id` |
| `user_id` | uuid | FK → `users.id` |
| `direction` | text | `debit` (user → escrow) / `credit` (escrow → user, on release) |
| `amount_qubic` | numeric(38,0) | |
| `tx_hash` | text | Unique |
| `purpose` | text | `deposit` / `balance` / `refund` / `yield_credit` / `penalty` |
| `created_at` | timestamptz | |

Double-entry: every debit has a corresponding credit on the escrow side. The escrow's running balance is the sum of all debits minus credits for that reservation. Used for audit + the partial-refund calc.

### 5.2 Services

**`services/compute/src/services/node-reservations.ts`** (new):
- `createNodeReservation(userId, { tier, yieldOptIn })` — creates a `pending_funding` row, returns reservation with deposit details
- `fundNodeReservation(userId, reservationId, { txHash, amountQubic, rateUsdPerQubic })` — moves to `spot_held`, debits escrow, optionally triggers Qearn lock
- `listNodeReservations(userId, { status? })` — list with status filter
- `getNodeReservation(userId, reservationId)` — read
- `openConfirmWindow(reservationId)` — internal; called by the system when mainnet activates; sets `confirm_window_opens_at`/`closes_at` and triggers the email
- `confirmNodeReservation(userId, reservationId, { txHash, amountQubic, rateUsdPerQubic })` — moves to `confirmed`, debits escrow balance, creates the underlying compute reservation
- `releaseNodeReservation(userId, reservationId, { txHash, amountQubic, rateUsdPerQubic })` — moves to `released`, credits escrow

**`services/economy/src/services/escrow.ts`** (new):
- `debitEscrow({ reservationId, userId, amountQubic, txHash, purpose })` — idempotent on tx_hash; updates running balance
- `creditEscrow({ reservationId, userId, amountQubic, txHash, purpose })` — same
- `getEscrowBalance(reservationId)` — sum of debits minus credits
- `listEscrowEntries(reservationId)` — for the dashboard ledger view

**`services/economy/src/services/qearn-lock.ts`** (new):
- `lockDeposit({ reservationId, amountQubic })` — wraps the existing Qearn integration (Phase 23 qearn-watcher); creates a lock, returns `qearn_lock_id`
- `unlockDeposit({ reservationId })` — releases the lock; returns the QUBIC principal + accrued yield
- `getLockYield(reservationId)` — current yield accrued, polled from the Qearn contract

**`services/qubic/src/workers/qearn-watcher.ts`** (extend):
- Add a `qubic_usd_rate` cache. Refresh every 60s from the existing CoinGecko/CoinMarketCap query (the watcher already pulls Qubic network state; we add a separate price-poll worker for the USD rate). Store the rate in a `qubic_usd_rates` table with a unique index on `fetched_at`. The reservation service reads the latest row at charge time.

### 5.3 SDK

`packages/sdk/src/resources/compute.ts` (extend):
- `listNodeReservations({ status? })` → `NodeReservation[]`
- `createNodeReservation({ tier, yieldOptIn })` → `NodeReservation` (with `deposit_usd_cents` and the deposit instructions)
- `fundNodeReservation(id, { txHash, amountQubic, rateUsdPerQubic })` → `NodeReservation`
- `getNodeReservation(id)` → `NodeReservation`
- `confirmNodeReservation(id, { txHash, amountQubic, rateUsdPerQubic })` → `NodeReservation`
- `releaseNodeReservation(id, { txHash, amountQubic, rateUsdPerQubic })` → `NodeReservation`
- `getNodeEscrow(id)` → `EscrowEntry[]`

Type: `NodeReservation` mirrors the table, with `deposit_qubic` / `balance_qubic` as `string` (per the SDK convention in AGENTS.md).

### 5.4 Marketing page

`apps/web/app/(marketing)/nodes/page.tsx` (new):
- Hero: "Reserve a tier 1 compute spot. $599 total, $30 deposit."
- Sub: "One tier now. Two more later. No subscription. Cancel any time before we ship."
- Tier 1 spec card
- Three-card compare table: Hetzner / AWS / Aigarth (vs Otto, we compare on compute primitives not hardware)
- 8-10 FAQ items:
  1. What is a compute spot?
  2. What does $599 include?
  3. What are the total ongoing costs?
  4. When does my spot activate?
  5. Can I get a refund?
  6. What is yield opt-in?
  7. How does QUBIC pricing work?
  8. How is this different from Hetzner / AWS?
  9. How is this different from raw Qubic staking?
  10. What happens at the 14-day window?
- Schema.org `Product` with `availability: PreOrder`, `price: 59900` (cents), `priceCurrency: USD`
- **NO animated counter / fake urgency**. An honest "spots remaining" counter is allowed (and only if the hard cap is real).
- Reserve CTA → `ReserveForm.tsx` (login → wallet link → yield opt-in toggle → confirm modal with current QUBIC amount)

Brand-voice notes (per `docs/BRAND-VOICE.md` and the AGENTS.md em-dash policy):
- No em-dashes. Colons in place of em-dashes, with the rules from AGENTS.md.
- Plain English. No abstract nouns ("intelligence", "synergy", "ecosystem" — except where literal).
- Small uppercase labels under plain-English headlines.

### 5.5 Dashboard

`apps/dashboard/src/components/pages/node-reservations.tsx` (new):
- List of user's reservations, status badges, deposit USD / QUBIC paid / yield accrued / balance due columns
- Per-row actions: release (if `spot_held`), confirm (if `awaiting_confirm`), view on Qubic explorer
- Escrow ledger view (collapsible per reservation)

### 5.6 Internal-trigger worker

`apps/dashboard/scripts/phase-24-trigger-confirm-window.ts` (new, operator script):
- Takes a `reservationId` and calls the internal endpoint to open the confirm window + send the email
- This is the manual operator escape hatch. The real auto-trigger (when mainnet activates) lives in a separate `services/compute` worker that watches for mainnet activation. For Phase 24 we ship the operator script; the auto-worker is Phase 25+ (tied to Phase 20.6 mainnet deploy).

---

## 6. Volatility model

The page shows USD. The wallet UI converts at charge time. The reservation row stores the actual QUBIC amount paid at the rate at that moment.

- **Reserve**: store `deposit_qubic` and `qubic_usd_rate_at_reserve`. The $30 is the anchor; QUBIC amount varies.
- **Confirm**: store `qubic_usd_rate_at_confirm`. The $569 is the anchor; QUBIC amount varies.
- **Release before confirm**: refund in QUBIC at the rate at release time, of the $30 USD value.
- **Release after confirm (partial)**: per existing `releaseReservation` with penalty.

This means:
- The user is never exposed to QUBIC price between reserve and confirm (their USD cost is fixed).
- Yield credit is denominated in QUBIC, applied to the balance at the current rate at confirm.
- If QUBIC price crashes 50% between reserve and confirm, the user pays 2x QUBIC for the same $569, but the yield credit (also in QUBIC) is also worth half. Net effect: roughly the same.
- The platform's USD revenue is stable. The platform's QUBIC revenue is volatile. That's by design — Aigarth is a QUBIC-denominated protocol.

The price oracle is the existing Qearn-watcher (Phase 23) plus a new `qubic_usd_rates` table that the watcher refreshes every 60s. The reservation service reads the latest row at charge time.

---

## 7. Edge cases

| Edge case | Handling |
|---|---|
| User signs the deposit tx but it never confirms | Reservation stays `pending_funding` for 24h, then auto-cancels. The escrow row is never created. |
| User signs the deposit tx twice (same reservation) | Idempotency on `tx_hash`. Second call returns the existing row. |
| User releases after mainnet but before confirm window opens | Allowed. Full refund minus 5% penalty (same as existing releaseReservation). |
| User releases after confirm window opens | Allowed. Per existing releaseReservation. |
| QUBIC price oracle stale (>5 min old) at charge time | Refuse to charge. Return 503 with `price_quote_stale`. The UI prompts the user to retry. |
| Yield opt-in but Qearn lock fails | Reservation still moves to `spot_held`. `yield_opt_in` is set to false; yield_credit_qubic stays 0. Surface the failure in the dashboard. |
| User changes their wallet between reserve and confirm | Refuse the confirm. User must link a wallet and re-link the original wallet. (Or, in a follow-up, allow re-link with audit trail. For Phase 24, refuse.) |
| Qearn yield exceeds the balance due | Credit the full balance, send the excess yield to the user's linked wallet as a separate tx. |
| 14-day confirm window closes with no action | Auto-release with the standard 5% penalty. Email the user. |

---

## 8. Phasing

### 8.1 This phase (Phase 24) ships

- Tier 1 only
- Reserve → spot_held → confirm/release flow
- Yield opt-in (off by default)
- USD-anchored pricing with QUBIC-derived amounts
- Marketing page (`/nodes`)
- Dashboard reservations page
- SDK methods
- Operator script to manually trigger the confirm window

### 8.2 Explicitly out of scope (later phases)

- **Tier 2 and tier 3** (Phase 25+): schema supports them, marketing does not. Each gets its own 14-day window after mainnet, sequenced.
- **Auto-trigger worker** for the confirm window (Phase 25+, depends on Phase 20.6 mainnet deploy). For Phase 24, the operator script is the manual path.
- **Real QPI multisig integration** for the escrow (Phase 20.6). Phase 24 uses the existing stub pattern, same as the rest of the QPI-deferred work.
- **Per-tier governance rights** for tier 3 (separate phase when tier 3 spec is written).
- **Subscription / pass-through model-usage billing** (Phase 26+ when mainnet is live and the gateway has real usage data).
- **Animated counter / fake urgency** — explicit no, even if Otto does it.

### 8.3 What blocks Phase 24

- Phase 20.6 mainnet deploy (the long pole per Phase 23). We can ship the reservation flow in Phase 24 without mainnet; the `spot_held` state can hold for as long as needed before mainnet activates. No blocker.
- The QPI stub for the multisig escrow. Same as the rest of the QPI-deferred work.

---

## 9. Acceptance criteria

- [ ] `/nodes` page renders with tier 1 spec, FAQ, compare table. Schema.org `Product` with `availability: PreOrder` validates (Google Rich Results test passes).
- [ ] User can click "Reserve for $30" → login or signup → link Qubic wallet → see yield opt-in toggle → see the exact QUBIC amount in the wallet UI → sign the tx.
- [ ] On tx confirmation, reservation moves to `spot_held`, escrow row created (debit), Qearn lock created (if opted in).
- [ ] User's dashboard shows the reservation with status, deposit USD, QUBIC paid, current QUBIC value, yield accrued, balance due.
- [ ] User can release before mainnet → full $30 refund at release-time rate. Status `released`.
- [ ] After the operator triggers the confirm window, reservation moves to `awaiting_confirm`. Confirmation email sent.
- [ ] User confirms → balance tx signed → status `confirmed`, allocation unlocked, yield credit applied.
- [ ] User releases after mainnet → partial refund per existing `releaseReservation` pattern. Penalty = 5% of the deposit (configurable).
- [ ] Tier 2 and tier 3 reservation rows are creatable in DB; the marketing layer rejects them; the dashboard shows no actions.
- [ ] The price oracle refreshes every 60s and refuses to charge if the rate is >5 min stale.
- [ ] Vitest coverage: escrow (debit/credit/idempotency/balance), reservations (lifecycle), qearn-lock (lock/unlock/yield), price-oracle staleness. ~30 new cases.
- [ ] Typecheck clean across `@aigarth/sdk`, `@aigarth/compute`, `@aigarth/economy`, `@aigarth/web`, `apps/dashboard`.
- [ ] All em-dashes replaced per AGENTS.md policy (colons in headlines; Oxford comma where the colon would land on `and|or|but`).
- [ ] No mojibake in marketing copy. `apps/web/scripts/scan-mojibake.ps1` passes.

---

## 10. Open questions

1. **Hard cap on tier 1 spots.** I'm suggesting 100. Need a number from you. Drives the "spots remaining" counter (if any) and the operational ceiling.
2. **Confirm window length.** I picked 14 days. Otto's 7 days is shorter. Longer is more user-friendly; shorter is better for treasury planning.
3. **Penalty percentage on release after mainnet.** I picked 5% (matches existing). Worth a separate decision if the presale flow should have a different penalty than the regular reservation flow.
4. **Yield opt-in default.** Currently off. Otto has no yield. Turning it on by default would maximize our differentiation but might confuse users. Worth a call.
5. **Tier 2 and tier 3 specs.** I named placeholder values ($899/$50 and $1,299/$75). The real specs need compute allocation, governance rights, and a USD/QUBIC conversation that's a separate doc.

---

## 11. What this phase does not touch

- `services/aigarthpool` — no changes. The presale is a reservation flow, not a staking flow.
- `services/ann`, `services/marketplace`, `services/tissue` — no changes.
- `services/identity` — no changes beyond reusing the existing wallet-link flow.
- `apps/web` (beyond the new `/nodes` route) — no changes.
- `apps/dashboard` (beyond the new `/node-reservations` page) — no changes.

The blast radius is small. The integration points are clean. The risk surface is the price oracle (mitigated by the staleness check) and the Qearn yield opt-in (mitigated by the opt-in default and the failure mode that gracefully degrades to no yield).

---

## 12. Files this phase creates or modifies

**Created:**
- `services/compute/src/db/schema.ts` — `node_reservations` table
- `services/compute/src/services/node-reservations.ts` — service methods
- `services/compute/src/routes/node-reservations.ts` — HTTP routes
- `services/economy/src/services/escrow.ts` — escrow service
- `services/economy/src/services/qearn-lock.ts` — Qearn lock wrapper
- `services/economy/src/db/schema.ts` — `node_escrow` table
- `services/qubic/src/workers/usd-price-oracle.ts` — 60s USD rate poller (or extend the existing qearn-watcher)
- `services/compute/src/db/schema.ts` — `qubic_usd_rates` table
- `apps/web/app/(marketing)/nodes/page.tsx` — marketing page
- `apps/web/app/(marketing)/nodes/ReserveForm.tsx` — reserve form component
- `apps/dashboard/src/components/pages/node-reservations.tsx` — dashboard page
- `apps/dashboard/scripts/phase-24-trigger-confirm-window.ts` — operator script
- `services/compute/tests/node-reservations.test.ts` — vitest
- `services/economy/tests/escrow.test.ts` — vitest
- `services/economy/tests/qearn-lock.test.ts` — vitest
- `services/qubic/tests/usd-price-oracle.test.ts` — vitest
- `docs/deliveries/phase-24-delivery.md` — delivery report (follows `_TEMPLATE.md`)

**Modified:**
- `packages/sdk/src/resources/compute.ts` — add `nodeReservations` resource
- `services/qubic/src/workers/qearn-watcher.ts` — add `qubic_usd_rate` cache + write to `qubic_usd_rates`
- `services/qubic/src/db/schema.ts` — `qubic_usd_rates` table
- `apps/dashboard/src/lib/repo.ts` — register the new page (if applicable)
- `docs/SPRINT-PLAN.md` — Phase 24 entry
- `docs/BRD.md` — note the hardware presale flow in the M4 hardware roadmap section

---

## 13. Why this is a good Phase 24

- Small blast radius. The integration points are clean.
- Reuses 80% of the existing reservation + wallet-link + Qearn-watcher plumbing.
- The new code is the data model, the escrow service, the marketing page, and the dashboard. ~8.5 SP.
- The risk is bounded: the price oracle is the only piece that interacts with the external world in a way we can't fully test, and it's mitigated by the staleness check.
- The user-facing value is concrete: people can pre-commit QUBIC to a compute spot, earn yield while they wait, and get a unit when mainnet goes live.
- It directly mirrors the Otto mechanic that we want to learn from, adapted to our primitives. Good A/B against the fiat-deposit competitors.

If you want to ship it, the next step is to start with 24.1 (schema + routes). The design doc is the spec; the implementation is straightforward.
