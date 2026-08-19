# ADR 001 — Intelligence Economy Layer (Rejected, Scoped Sub-module Approved)

| Field | Value |
|---|---|
| **Status** | Accepted with modifications |
| **Date** | 2026-07-31 |
| **Author** | Principal Architect, Qubic Intelligence Protocol / Aigarth Cloud |
| **Reviewers** | Engineering, Founders, (Legal — TBD) |
| **Decides** | Whether to add a 5-contract "Intelligence Economy Layer" (IPO / ETF / Registry / Ownership / Revenue) on top of the existing Aigarth Cloud platform |
| **Outcome** | Reject the proposed 5-contract suite. Approve a narrow off-chain `services/economy` plugin. Defer any on-chain settlement contract behind explicit triggers. |

---

## 1. Context

A proposal was submitted to extend the Qubic Intelligence Protocol from an "ANN registry / orchestration layer" into an "Intelligence Economy Protocol" where intelligence assets can be created, funded, owned, evolved, traded, and monetized. The proposal called for:

- A 5-contract suite on Qubic (`IntelligenceRegistry`, `IntelligenceIPO`, `IntelligenceOwnership`, `IntelligenceRevenue`, `IntelligenceETF`).
- Per-ANN funding rounds (IPO metaphor), per-ANN ownership percentages, and revenue rights distributed across creators, investors, compute contributors, and the protocol.
- A "Caribbean Intelligence Index" as an example ETF-like product.

The proposal's premise is that Aigarth Cloud is "only" an ANN registry/orchestration layer. **That premise is false.** Before this review, the principal architect verified the current state of the monorepo:

| Proposal asks for | Already lives at |
|---|---|
| IntelligenceRegistry (owner, version, capability, fitness) | `services/ann` — `anns.ts`, `versions.ts`, `ratings.ts`, `benchmarks.ts`, `deployments.ts`; schema has `revenueShareBps`, `totalRevenueQubic`, `ownerUserId`/`ownerOrgId` (`services/ann/src/db/schema.ts:102-103, 152, 230-244`) |
| Listing, discovery, two-sided market | `services/marketplace` — `listings.ts`, `offers.ts`, `auctions.ts`, `bids.ts`, `reviews.ts` |
| Subscriptions, payments, invoices, credits, usage | `services/billing` — `subscriptions.ts`, `payments.ts`, `invoices.ts`, `credits.ts`, `usage.ts`, `plans.ts` |
| Wallet, staking, treasury, on-chain settlement | `services/qubic` — `wallets.ts`, `staking.ts`, `treasury.ts`, `tx-monitor.ts` (worker) |
| Compute allocation, node registry | `services/compute` (Phase 2) |
| Platform-level capital formation | Phase 10 "Genesis / IPO" already scoped in `ROADMAP.md:217-230` |

Adding 5 on-chain contracts in parallel would duplicate, fragment, and slow down the system, while introducing securities-law exposure the platform is not built to absorb.

---

## 2. Decision

**2.1 — Reject the 5-contract suite as written.**

**2.2 — Approve a narrow off-chain plugin: `services/economy`.**

A new Fastify service, parallel to `services/ann` and `services/marketplace`, that:

- Models multi-creator contribution shares on an ANN (bps).
- Computes revenue splits from usage records (pure function).
- Runs a payout engine that calls `services/qubic` to move QUBIC, with idempotency, audit log, and a `dry_run` mode.
- Provides a "bundle" listing type in `services/marketplace` (the "Caribbean Intelligence Index" as a real product, not a token).

Hard boundary: the core protocol (`services/ann`, `services/marketplace`, `services/billing`, `services/qubic`) **must not import from `services/economy`**. The economy module is a consumer of the core, never a peer. Enforced by `pnpm` workspace boundaries and code review.

**2.3 — Defer any on-chain settlement contract behind explicit triggers.**

A single optional contract `intelligence-settlement` (a thin event log of `(ann_id, from, to, amount, tx_ref)` plus a `payMany(recipients[])` batch helper) may be considered **only** if all three of the following are true:

- Qubic mainnet has the `outsourced-computing` contract stable.
- Aigarth has at least 50 published ANNs and meaningful MRR from subscriptions (threshold TBD by Finance).
- A licensed legal opinion confirms that ownership-transfer and revenue-payout events are not securities in the target jurisdictions.

**2.4 — Reject the IPO/ETF framing outright.**

The legitimate "IPO" in this system is the platform-level Genesis (Phase 10), not per-ANN. The proposal's "Caribbean Intelligence Index ETF" must be reframed as a curated marketplace bundle listing. No tradable share, no ownership token, no investment vehicle.

---

## 3. Why this is the right call

### 3.1 — Off-chain already implements 80% of the proposal

Listing, offers, auctions, reviews, subscriptions, invoices, payments, credits, usage metering, revenue share fields, ownership, and creator monetization are **all live in the existing service constellation** (`docs/ARCHITECTURE.md:11-21`). The "missing" piece is the end-to-end payout path (usage → creator wallet), which is a 1-sprint build, not a 5-contract program.

### 3.2 — Putting these contracts on Qubic is a bad trade

- Qubic contracts are **C++ QPI** deployed via PR → `qubic/proposal` → GQMPROP → **451-of-676 computor quorum vote**. Realistic lead time per contract: **1–3 months** including the 7-day node upgrade window after approval.
- Contract code is **frozen at deploy**; upgrades require a new proposal round.
- Every contract adds to the per-tick compute budget of all 676 computors. Five new contracts is a real ask of the network.
- Qubic has no native oracle — fitness/performance/usage signals must come from off-chain feeds (`services/ann/benchmarks`, `services/gateway`), which means another trusted component to design and operate.

A system that already exists in Postgres + Fastify + Stripe, with iteration cycles of days, is the wrong thing to replace with contracts that take a year to deploy and freeze on day one.

### 3.3 — The proposal carries significant regulatory exposure

The proposal uses the words *IPO*, *ETF*, *investors*, *funding target*, *ownership percentages*, *revenue rights*. In the US (and most jurisdictions) this is a textbook Howey Test fact pattern: an investment of money in a common enterprise with an expectation of profit derived from the efforts of others. **You do not need a token to be a security.** Investment-style utility on a blockchain has been treated as such since *SEC v. Telegram* and *SEC v. Kik*. The Qubic incubation pitch (`docs/ENDGAME-PROTO-PROPOSAL.md`) targets enterprise and developer adoption — not retail speculation. A Howey-magnet framing is a strategic mismatch.

### 3.4 — Speculation is bad for the platform

A tradable "ownership" surface for ANNs would let **price decouple from utility** (the NFT/ICO pattern). When a hyped intelligence project fails to deliver, the platform's credibility — and the Qubic ecosystem's — takes the hit. Bundles as curated listings solve the same marketing problem without the legal and reputation risk.

### 3.5 — The proposal correctly identifies the gaps; the fix is wrong

| Real gap the proposal names | Right fix |
|---|---|
| End-to-end revenue split from paid API call to creator wallet | `services/economy/payouts.ts` calling `services/qubic` |
| Performance-linked reputation that affects discoverability and pricing | Wire `services/ann/ratings.ts` + `benchmarks.ts` to `services/marketplace` ranking |
| Co-creation credits when multiple creators contribute to one ANN | `contributors` table with bps shares in `services/ann`, modeled in `services/economy/contributors.ts` |
| Bundles / collections of ANNs sold as a unit (the "ETF" use case) | `bundle_listings` type in `services/marketplace` |

None of these need a smart contract.

---

## 4. Proposed target architecture (after this decision)

```
┌─ Application Layer ──────────────────────────────────────┐
│  apps/web (3003) · apps/dashboard (4000) · apps/studio    │
└──────────────────────────────────────────────────────────┘
┌─ Service Constellation (each with its own data + deploy) ─┐
│  identity (7001) · qubic (7002) · compute (7003)         │
│  gateway (7004) · billing (7005) · ann (7006)            │
│  marketplace (7007) · economy* (NEW, off-chain plugin)   │
└──────────────────────────────────────────────────────────┘
┌─ Shared infra ───────────────────────────────────────────┐
│  Postgres · Redis · NATS · MinIO · Sentry · Prometheus  │
└──────────────────────────────────────────────────────────┘
┌─ Qubic settlement ───────────────────────────────────────┐
│  Wallet, staking, tx monitor, treasury (services/qubic)  │
│  (Optional) intelligence-settlement contract — DEFERRED  │
└──────────────────────────────────────────────────────────┘
```

The `services/economy` module is a **consumer** of the core services, never a peer. Core services stay unchanged. Helix and Compute plug in later at the points already marked.

### 4.1 Module layout

```
services/
  ann/                    # existing — registry, versions, ratings, licenses, deployments
  marketplace/            # existing — listings, offers, auctions, reviews, bundles
  billing/                # existing — plans, subscriptions, invoices, credits, usage, payouts
  economy/                # NEW (off-chain only)
    src/
      services/
        payouts.ts        # routes billing usage → creator wallet (Qubic settlement)
        splits.ts         # revenue split engine (bps math, multi-recipient)
        bundles.ts        # "intelligence indexes" as marketplace listing bundles
        contributors.ts   # co-creation credit ledger per ANN
      routes/
        payouts.ts
        bundles.ts
        contributors.ts
      db/
        schema.ts         # contributor_shares, payout_runs, bundle_listings
      lib/
        settlement.ts     # thin wrapper that calls services/qubic for QUBIC transfer

contracts/                # NEW (Qubic C++ QPI) — DEFERRED until triggers met
  intelligence-settlement/  # ONE contract, much later, optional
```

---

## 5. Consequences

### Positive

- No 6–12 month contract deployment pause before users see a benefit.
- No securities-law exposure on the platform's per-asset layer.
- The off-chain economy ships in 1–2 sprints, behind a `feature.economy` flag.
- The platform's enterprise/developer focus is preserved.
- Future on-chain settlement is preserved as an option, gated by real economic activity and a legal opinion.

### Negative

- Investors hoping for a per-ANN tradable surface will not get one. (Acceptable — this audience was never the target.)
- The "Caribbean Intelligence Index" will be a bundle, not an ETF. Marketing must use neutral language ("intelligence collection", "curated bundle").
- A future on-chain settlement contract, if ever built, will be a separate program of work with its own proposal.

### Neutral

- Phase 10 Genesis / IPO is unchanged. It is, and remains, the only legitimate "IPO" surface in the system.

---

## 6. Implementation — what ships in the next 1–2 sprints

In `services/economy` (new Fastify service):

1. `contributors.ts` — multi-creator share model for one ANN (bps).
2. `splits.ts` — pure function: `(usage_record, contributors, creator_share_bps, platform_fee_bps) → payout[]`.
3. `payouts.ts` — batched payout runner that calls `services/qubic` to move QUBIC, with idempotency, retries, and a `payout_runs` audit log.
4. `bundles.ts` — marketplace-listing type that bundles N ANNs with a single price (the "ETF" use case, properly framed).
5. Simulator UI in `apps/dashboard` (no real money) — "if I own 30% of ANN X and it earns 1M QUBIC this month, I get X".
6. Feature flag `feature.economy` — off by default until battle-tested.

Estimated scope: **6–8 SP** across 1–2 sprints.

---

## 7. Triggers to revisit the on-chain deferral

All three must be true before any `intelligence-settlement` Qubic contract is proposed:

1. Qubic mainnet has the `outsourced-computing` contract stable.
2. Aigarth has ≥ 50 published ANNs and meaningful MRR from subscriptions (Finance to set the threshold).
3. A licensed legal opinion confirms ownership-transfer and revenue-payout events are not securities in the target jurisdictions.

If any one is false, the deferral stands.

---

## 8. What this decision explicitly does NOT do

- It does not block per-ANN revenue sharing — that is the off-chain `services/economy` module.
- It does not block creator royalties on marketplace sales — `services/marketplace/offers.ts` already supports it.
- It does not block subscription-based monetisation of ANNs — `services/billing` already supports it.
- It does not block the platform-level Genesis / IPO (Phase 10) — that is the only legitimate "IPO" in the system.
- It does not block a *future* regulated wrapper for ANN ownership shares (e.g. an SPV in a friendly jurisdiction) — only the on-chain implementation and the unbranded marketing.

---

## 9. References

- `docs/ARCHITECTURE.md` — service constellation, principles
- `docs/ROADMAP.md` — 16-phase build plan, including Phase 10 Genesis / IPO
- `docs/ENDGAME-PROTO-PROPOSAL.md` — Qubic CCF incubation submission (enterprise / developer focus)
- `docs/RISK-REGISTER.md` — top 20 risks; this decision adds **R-ADR-001-1: Securities-law exposure from per-asset capital formation** (owner: Legal — not yet engaged — flag for next review)
- `docs/GOVERNANCE.md` — how decisions get made; this ADR is the first decision record under that process
- `services/ann/src/db/schema.ts:102-103, 152, 230-244` — existing `revenueShareBps`, `totalRevenueQubic`, `ownerUserId/ownerOrgId` fields
- `services/marketplace/`, `services/billing/`, `services/qubic/` — existing service implementations
- Qubic contract deployment pipeline — `develop → PR → qubic/proposal → GQMPROP → 451/676 quorum → 7-day node upgrade`

---

## 10. Changelog

- **2026-07-31** — Initial decision (Accepted with Modifications). Rejected 5-contract suite. Approved `services/economy` plugin. Deferred on-chain settlement behind three explicit triggers.
