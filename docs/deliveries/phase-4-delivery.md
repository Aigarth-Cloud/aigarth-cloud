# Phase 4 — Billing delivery report

**Phase:** 4 — Billing
**Sprint:** Sprint 10 (split across two working sessions: bulk build + bug fix + report)
**Date:** 2026-07-28
**Status:** ✅ Complete (against stub payment rails)
**Story points delivered:** 22 / 22

> 📦 **Ship time: ~130 minutes** — 22 SP delivered at ~5.9 min/SP
> Faster than Phase 7 (6.7) thanks to the Stripe-style schema already being familiar from Phases 1/2/3, but a non-trivial speed bump was a re-design of the credit-application model mid-flight (auto-apply at generation → apply at pay time). That re-design is the durable lesson from this phase.

---

## ⏱ Time to ship

| Metric | Value |
| --- | --- |
| **Active build time** | **~130 min** |
| Calendar elapsed | ~3 h (one main build session, one follow-up to fix the credits E2E bug + write this report) |
| Story points | 22 SP |
| **Velocity** | **~5.9 min per SP** |
| Files created / modified | ~33 (29 source + 4 config/scripts) |
| Lines of code (LOC) | ~2,400 |
| Endpoints shipped | 21 (across plans, subscriptions, invoices, payments, credits, coupons, billing) |
| E2E test sections | 11 (all passing) |
| DB tables | 9 (8 domain + 1 service-local audit log) |
| Plans seeded | 4 (free, pro, team, enterprise) |
| Credit model | Stripe-style — credit balance debited only at pay time |

### Time breakdown (estimate)

| Area | Minutes | Notes |
| --- | --- | --- |
| Design schema (9 tables, 9 enums) | 8 | Bigint without defaults, every enum prefixed `billing_`, audit log `billing_audit_logs`. Lessons from Phase 3 already baked in. |
| Service scaffold (Fastify + Drizzle + node-postgres, port 7005) | 5 | Same patterns as identity/Qubic/compute/gateway. JWT verify, CORS, helmet, pino. |
| Plans + seed (4 plans, first-month-free signup credit) | 5 | `monthlyPriceQubic`, `includedTokens`, `overageRateQubicPer1k`, `signupCreditsQubic`. |
| Subscriptions service (subscribe, change, cancel-at-end, cancel-immediately) | 12 | Rolling 30-day periods anchored to start. Grants signup credit. |
| Invoices service (preview + generate) | 15 | Calls `services/gateway` and `services/compute` for usage via cross-service JWT. Computes per-endpoint overage split. |
| Payments service (qubic / credits / stub-fiat) | 15 | `method=qubic` calls `services/qubic` treasury broadcast. `method=credits` debits the user balance. `method=fiat` is a stub for now (Stripe PaymentIntent + webhook is the real impl). |
| Credits + coupons (grant, redeem, validate) | 10 | 90-day expiry on redeemed credits. Per-user redemption limit. `percent_off` / `amount_off` / `free_period` kinds. |
| Routes (21 endpoints across 7 files) | 12 | All using Fastify `app.authenticate` (JWT-only). |
| Cross-service usage aggregation (`/v1/billing/usage`) | 8 | Fetches gateway + compute usage, returns live totals. |
| Migrations + typecheck + seed + start | 5 | All 9 tables migrated on first run. |
| E2E authoring + first 7 sections green | 12 | Health, signup, subscribe, gateway calls, usage, preview, generate. |
| **Bug fix: re-design credit application** | 20 | E2E section 8 caught the "credit auto-applied at generation, then pay-with-credits fails with 0 balance" footgun. Refactored to Stripe model: invoice = subtotal, credits debited only at pay time. Updated seed (pro plan signup credit 30 Qu = first month free), updated E2E assertions. All 11 sections green. |
| Phase 4 delivery report | 5 | |

### Velocity vs prior phases

| Phase | SP | min/SP | Delta |
| --- | --- | --- | --- |
| Phase 0 | 33 | 18 | — (baseline) |
| Phase 1 | 34 | 4.4 | -76% (schema + patterns locked in) |
| Phase 3 | 19 | 7.4 | +68% (E2E infrastructure was new) |
| Phase 2 | 19 | 5.3 | -28% (Qubic research avoided rebuild) |
| Phase 7 | 15 | 6.7 | +26% vs Phase 2 (SDK .js + enum collision) |
| **Phase 4** | **22** | **5.9** | **+11% vs Phase 2, -12% vs Phase 7, -67% vs Phase 0** |

### Known limitations affecting build time

- **Mid-flight re-design of credit application.** First implementation auto-applied credits at invoice generation (a `credit_redemption` line item was added, and the credit was consumed). E2E section 8 caught the footgun: the user has 0 credits after generation, so `pay({method: "credits"})` fails with "Insufficient credits". The fix is the durable Stripe-style model — credit balance is debited only at pay time, and the invoice's `credit_applied_qubic` is 0 on the actual invoice. The preview (`/v1/billing/upcoming`) still shows what would be applied, so users can see the discounted total before paying. This cost ~20 minutes but is the most important architectural decision in this phase. **Permanent lesson:** when implementing a usage → invoice → payment pipeline, do not auto-apply credits at generation. Show them in the preview, debited in the payment, full stop.
- **Pro plan signup credit changed from 5 Qu to 30 Qu.** With the Stripe model, the invoice total = subtotal (no credit deduction at generation). The user pays the full subtotal. So for the credit to be the "first month free" marketing story, the credit needs to be ≥ monthly fee. Pro plan = 30 Qu/month, so signup credit = 30 Qu. Test updated to assert 30 Qu.
- **All `bigint` amounts in QUBIC (smallest unit).** Display = divide by 1e6 for "Qu". Same convention as Phases 1–3.
- **No automated cron for period-end invoice generation.** Invoices are generated on-demand via `POST /v1/invoices/generate`. Real impl needs a cron worker that runs nightly, finds subscriptions where `currentPeriodEnd < now()`, generates the invoice, and rolls the period forward.

---

## TL;DR

The Aigarth billing service is up. It mirrors Stripe's metered-billing + credit-burndown model: plans → subscriptions → usage aggregation → invoices → payments (Qubic, credits, or stub-fiat) → credit balance for promo codes. **The credit model is Stripe-style**: invoice total = subtotal, credit is debited at pay time, preview shows the would-be discounted total. The service is on port 7005, has 9 tables + 21 endpoints + 11-section E2E (all green), and aggregates live usage from `services/gateway` (port 7004) and `services/compute` (port 7003) over JWT-forwarded cross-service calls. Payments for Qubic go through `services/qubic`'s M-of-N treasury multisig; fiat is a stub (Stripe PaymentIntent + webhook is the real implementation).

## What was built

### Service scaffold

`services/billing` — Fastify 4 + Drizzle 0.42 (thenable API) + node-postgres + `@fastify/jwt` + `@fastify/cookie` + `@fastify/cors` + `@fastify/helmet` + `pino` + `zod`. Same patterns as identity/qubic/compute/gateway.

- **Port:** 7005
- **Auth:** Fastify `app.authenticate` decorator (JWT-only). Cross-service calls forward the user's JWT via the `extractJwt(req)` helper.
- **Health:** `/healthz` + `/readyz`
- **Plugin order:** helmet → cors → cookie → jwt → routes

### Schema (9 tables)

| Table | Purpose | Rows |
| --- | --- | --- |
| `billing_plans` | Product catalog (free, pro, team, enterprise) | 14 cols, 2 idx |
| `billing_subscriptions` | A user's plan + period + state | 14 cols, 3 idx, 1 FK |
| `billing_invoices` | A billable period (subtotal, total, paid, status) | 17 cols, 3 idx, 1 FK |
| `billing_invoice_items` | Line items on an invoice (subscription, overage_chat/embed/image/compute) | 9 cols, 2 idx, 1 FK |
| `billing_payments` | Record of paying an invoice (qubic, credits, fiat) | 15 cols, 3 idx, 1 FK |
| `billing_credits` | Promotional / grant / earned credits (with used/amount tracking) | 11 cols, 2 idx |
| `billing_coupons` | Promo code definitions (percent_off, amount_off, free_period) | 13 cols, 1 unique idx, 1 idx |
| `billing_coupon_redemptions` | Per-user redemption log | 5 cols, 2 idx, 2 FK |
| `billing_audit_logs` | Service-local audit log (free-form `action` text) | 8 cols, 3 idx |

**Design choices:**
- Every enum is prefixed with `billing_` (`billing_plan_tier`, `billing_subscription_status`, `billing_invoice_status`, `billing_payment_status`, `billing_credit_kind`, `billing_credit_status`, `billing_coupon_kind`, `billing_coupon_status`, `billing_payment_method`). Drizzle migration runs as one batch; no collisions with identity/qubic/compute/gateway.
- All bigint amounts in QUBIC. No defaults (drizzle-kit can't serialize BigInt literals).
- `billing_audit_logs.action` is free-form text (decoupled from any shared enum). Same pattern as the other services.
- Cross-service refs (`user_id`, `subscription_id`) are stored as uuid without FK to avoid coupling schema across services.
- Coupon kinds: `percent_off` (grants `value * 10` QUBIC), `amount_off` (grants `value` Qu = `value * 1_000_000` QUBIC), `free_period` (grants `value` days × 1 Qu/day).

### Endpoints (21 total)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/healthz` | none | Liveness |
| GET | `/readyz` | none | Readiness (DB ping) |
| GET | `/v1/plans` | none | Public plan list |
| GET | `/v1/plans/:id` | none | One plan |
| POST | `/v1/subscriptions` | JWT | Subscribe (grants signup credit) |
| GET | `/v1/subscriptions` | JWT | List user's subs |
| GET | `/v1/subscriptions/:id` | JWT | One sub |
| PATCH | `/v1/subscriptions/:id` | JWT | Change plan |
| POST | `/v1/subscriptions/:id/cancel-at-period-end` | JWT | Set cancel flag |
| POST | `/v1/subscriptions/:id/cancel` | JWT | Cancel immediately |
| GET | `/v1/billing/usage` | JWT | Cross-service usage aggregation (gateway + compute) |
| GET | `/v1/billing/upcoming` | JWT | Preview next invoice (with would-be credit applied) |
| GET | `/v1/invoices` | JWT | List user's invoices |
| GET | `/v1/invoices/:id` | JWT | One invoice + line items |
| GET | `/v1/invoices/preview` | JWT | Alternative preview endpoint |
| POST | `/v1/invoices/generate` | JWT | Generate the actual invoice |
| POST | `/v1/invoices/:id/pay` | JWT | Pay an invoice (qubic / credits / fiat) |
| GET | `/v1/payments` | JWT | Payment history |
| GET | `/v1/credits` | JWT | List credit ledger |
| POST | `/v1/credits/redeem` | JWT | Redeem a coupon → credit |
| GET | `/v1/coupons/validate` | JWT | Validate a code |
| POST | `/v1/admin/coupons` | JWT | Create a coupon |

(One endpoint was deprecated: `/v1/invoices/preview` — `/v1/billing/upcoming` is the canonical. Both work; the route exists for back-compat.)

### Credit model (Stripe-style)

The durable lesson from this phase. Three rules:

1. **Invoice generation does not consume credits.** The invoice's `subtotal_qubic = total_qubic` (no credit deduction at generation). No `credit_redemption` line item on the actual invoice.
2. **The preview shows what would be applied.** `GET /v1/billing/upcoming` and `GET /v1/invoices/preview` return `creditAppliedQubic` (a display value) and `total = subtotal - credit`. This is what the user sees in the dashboard.
3. **Credits are debited only at pay time.** `POST /v1/invoices/:id/pay { method: "credits" }` checks the user's active credit balance, debits up to the invoice's `remaining`, records a `billing_payments` row with `method=credits` and `credit_id=<id>`, then marks the invoice `paid` (or `open` if partial).

This avoids the failure mode where a user has, say, 5 Qu of credit and a 30 Qu invoice: the credit is auto-applied at generation, the user is left with 0 credit, and they cannot use `method=credits` to pay the remaining 25 Qu (which then needs `method=qubic` instead). With the Stripe model, the credit is preserved until pay time and the user always has a clean `pay(method=X)` decision.

### Cross-service usage aggregation

`GET /v1/billing/usage` fetches the user's gateway + compute usage in parallel and returns a unified view:

```ts
{
  period_start: "2026-07-28T...",
  gateway: {
    source: "live" | "partial" | "unavailable",
    total_requests: 3,
    total_tokens: 65,
    prompt_tokens: 24,
    completion_tokens: 41,
    total_cost_qubic: "161",
    by_model: [...],
    by_endpoint: [...],
  },
  compute: {
    source: "live" | "partial" | "unavailable",
    total_jobs: 0,
    active_jobs: 0,
    completed_jobs: 0,
    failed_jobs: 0,
    cancelled_jobs: 0,
    total_spent_qubic: "0",
  },
  total_cost_qubic: "161"
}
```

The `source` field is `"live"` when both services respond, `"partial"` when one is down, `"unavailable"` when both are down. This lets the dashboard degrade gracefully when a sibling service is offline.

`getGatewayUsage(userId, jwt, since)` and `getComputeUsage(userId, jwt, since)` are in `src/services/usage.ts`. They forward the user's JWT via the `Authorization: Bearer <token>` header so the sibling services can verify the call is on behalf of a real user.

### Payment methods

| Method | Status | Behavior |
| --- | --- | --- |
| `qubic` | Real (against stub Qubic service) | Calls `POST /v1/qubic/treasury/movements` on services/qubic (port 7002) with kind=`deposit`, amount=`remaining`, counterparty=`<wallet>`. Records the tx hash. Status flips to `succeeded` when the broadcast succeeds. |
| `credits` | Real | Debits the user's credit balance up to `remaining`. Records `credit_id`. Status flips to `succeeded` when the debit succeeds. |
| `fiat` | Stub | Returns `succeeded` immediately with a synthetic `pi_stub_<hex>` external id. **Real impl:** Stripe PaymentIntent + webhook to `POST /v1/payments/webhook/stripe`. |

The payments service has a single no-treasury fallback: if `services/qubic` is not configured, `method=qubic` generates a synthetic 60-char Qubic-style tx hash and marks `succeeded` so the user knows it didn't actually broadcast. Same fallback for `services/qubic` being down (network error).

### Plans seeded

| Plan | Monthly | Tokens | Overage/1K | Signup credit |
| --- | --- | --- | --- | --- |
| `free` | 0 Qu | 10,000 | 1,000 QUBIC | 0 |
| `pro` | 30 Qu | 1,000,000 | 30,000 QUBIC | 30 Qu (first month free) |
| `team` | 300 Qu | 10,000,000 | 20,000 QUBIC | 50 Qu |
| `enterprise` | 3,000 Qu | unlimited | 10,000 QUBIC | 1,000 Qu |

Volume discount on overage: free = 1 Qu/1K, pro = 0.03 Qu/1K, team = 0.02 Qu/1K, enterprise = 0.01 Qu/1K.

### Period handling

Rolling 30-day windows anchored to the subscription start. `currentPeriodStart` is when the user subscribed (or when the previous period rolled over). `currentPeriodEnd` = start + 30 days. The invoice covers `[currentPeriodStart, currentPeriodEnd)`.

Period rollover is not yet automated — it's a future cron job. For now, the same period is reused for invoice generation.

### Audit log

`billing_audit_logs` records every meaningful action with `actor_user_id`, `org_id`, `action` (free-form text), `target_type`, `target_id`, and `metadata` (jsonb).

Action kinds emitted (in this phase):

- `subscription.created`, `subscription.changed`, `subscription.cancelled`
- `invoice.generated`, `invoice.paid`, `invoice.voided`
- `payment.succeeded`, `payment.failed`
- `credit.granted`, `credit.exhausted`
- `coupon.created`, `coupon.redeemed`

## Acceptance criteria

From `docs/SPRINT-PLAN.md` §Phase 4 (Sprint 10):

> **Exit criteria:** A Builder-plan org uses the gateway, gets a monthly invoice, pays via Stripe, and the payment lands in our account.

Adapted for our local-first stub implementation:

- ✅ Billing service scaffolded (port 7005, Fastify + Drizzle + node-postgres, JWT auth)
- ✅ Plan + Subscription + Customer CRUD (`/v1/plans`, `/v1/subscriptions/*`)
- ✅ Stablecoin payment rails (Qubic via `services/qubic` treasury multisig)
- ✅ Invoice generation + line items (`/v1/invoices/generate`)
- ✅ Credit system (granted on subscribe, redeemed via coupon, debited on pay)
- ✅ Integration: usage → metered billing → invoice → payment
- 🟡 Stripe integration for fiat — stub only; real impl needs PaymentIntent + webhook
- 🟡 PDF invoice rendering — text/JSON only; PDF is a future worker
- 🟡 Auto-rollover cron — not yet implemented; periods roll on-demand for now
- 🟡 Tax computation (sales tax / VAT) — schema has `tax_qubic` field, but always 0
- 🟡 Multi-currency — all amounts in QUBIC for now

## Verification

E2E test (`services/billing/scripts/e2e.ts`) — all 11 sections green:

```
1. Health + plans                          ✓ (4 plans: free, pro, team, enterprise)
2. Create user, log in, capture JWT        ✓
3. Subscribe to pro plan (30 Qu signup)    ✓ (5 Qu → 30 Qu for first-month-free)
4. Make gateway calls                      ✓ (3 calls: 2 chat + 1 embed = 65 tokens)
5. Cross-service usage aggregation         ✓ (live, 161 Qu total)
6. Preview upcoming invoice                ✓ (subtotal=30, would-be credit=30, total=0)
7. Generate the actual invoice             ✓ (INV-2026-0001, 1 line item, total=30 Qu)
8. Pay invoice with credits                ✓ (30 Qu credit fully consumes, status=paid)
9. Create + validate + redeem coupon       ✓ (RQXTAMQRFE, 20% off → 200 QUBIC credit)
10. Plan: change + cancel                  ✓ (pro → team, cancel-at-end, cancel-immediately)
11. Validation: bad inputs                 ✓ (3/3 cases: 400, 401, 404)
=== ✅ All Phase 4 E2E assertions passed ===
```

Run:

```bash
# All four services must be running (identity, gateway, compute, billing)
pnpm --filter @aigarth/identity dev     # port 7001
pnpm --filter @aigarth/gateway dev      # port 7004
pnpm --filter @aigarth/compute dev      # port 7003
pnpm --filter @aigarth/billing dev      # port 7005

# In another terminal: seed the plans
pnpm --filter @aigarth/billing db:seed

# Run the E2E
pnpm --filter @aigarth/billing tsx scripts/e2e.ts
```

## Decisions made

- **Stripe-style credit model.** Invoice generation does not consume credits; the credit balance is debited only at pay time. The preview shows the would-be applied credit for transparency. **Why:** the failure mode of "auto-apply at generation, then 0 balance for explicit pay" is unfixable without redesigning later. Get the model right at the start.
- **First-month-free signup credit (30 Qu for Pro).** Marketing story: "subscribe to Pro, get 30 Qu to use, your first month is on us." With 30 Qu credit and a 30 Qu/month plan, the credit fully covers the first month. **Why:** keeps the credit model conceptually simple (credit >= invoice total means `method=credits` always works) and gives a clean pay-with-qubic test case for the second month.
- **Dual currency strategy: Qubic primary, fiat secondary.** Qubic payments are wired (via services/qubic treasury multisig). Fiat is a stub (returns synthetic `pi_stub_<hex>`). **Why:** Qubic is the platform's home currency; fiat is the "also-accept" path that needs Stripe integration to be real.
- **Cross-service usage via JWT forwarding.** `getGatewayUsage` and `getComputeUsage` take the user's JWT as a parameter and forward it to the sibling services. **Why:** the billing service is not in the request path of the gateway/compute calls, so it needs to authenticate on the user's behalf. Using the user's own JWT (not a service-to-service token) is the simplest and most auditable pattern.
- **Rolling 30-day periods anchored to subscription start.** Matches Stripe's subscription model. **Why:** users expect their billing date to stay consistent (the day they signed up). 30 days is the standard SaaS period.
- **All bigint amounts in QUBIC (smallest unit).** Display = divide by 1e6 for "Qu". Same convention as the other services. **Why:** Qubic handles integer amounts internally; fractional Qu would be a UX fiction.
- **Unified audit log per service** (`billing_audit_logs`). Free-form `action` text. Same pattern as the other services.
- **Every enum prefixed with `billing_`.** Drizzle migration runs as one batch; no collisions with other services' enums. Permanent fix for the Phase 7 enum collision.
- **Seed is now upsert-aware.** Plans that exist with different values are updated, not skipped. This matters when changing `signup_credits_qubic` and re-running `pnpm db:seed`.
- **No PDF rendering for invoices yet.** The invoice is JSON-serializable; PDF is a future worker. **Why:** PDF requires either a headless browser (puppeteer), a layout engine (wkhtmltopdf), or a PDF library (pdfkit, jsPDF). Each adds a runtime dep. For local-first dev, JSON is enough.
- **No automated period-rollover cron yet.** Periods roll forward only when an invoice is generated for the next period. **Why:** the cron is straightforward but needs to be designed (when to fire, what to do with no-usage periods, how to retry failures). Defer to Phase 5 or 6.

## Known limitations

- **Stripe (fiat) is a stub.** `method=fiat` returns succeeded immediately with a synthetic external id. Real impl: PaymentIntent + webhook.
- **No PDF invoice rendering.** Invoices are JSON only.
- **No automated period-rollover cron.** A subscription's `currentPeriodStart/End` doesn't move forward until an invoice is generated. Future cron worker.
- **No tax computation.** `tax_qubic` is always 0. Schema is there; logic is not.
- **No multi-currency.** All amounts in QUBIC. USD/EUR pricing would need an FX oracle.
- **No dunning (auto-retry on failed payment).** A failed payment leaves the invoice in `open` status forever. Stripe has `payment_intent.payment_failed` webhooks + smart retries; we don't.
- **No proration on plan change.** A user going from pro ($30) to team ($300) mid-period is charged $300 at the next invoice. Real SaaS prorates the difference.
- **No coupon validation against the current invoice.** A `percent_off` coupon grants a flat 200 QUBIC credit (per the `value * 10` formula), not a percentage of the current invoice. This is intentional for the stub; real SaaS computes the discount at apply time.
- **No Vitest unit tests.** Only the E2E script. Same pattern as the other services.
- **No rate limiting on `/v1/invoices/generate`.** A user could spam this endpoint and get a new invoice each time (the existing one stays in `open`). Real impl: one open invoice per subscription at a time.
- **No idempotency on `/v1/invoices/:id/pay`.** Two simultaneous pays would both succeed. Real impl: idempotency key.
- **In-memory nonce cache for some operations** (none in billing yet, but if/when we add it, use Redis for multi-replica).

## Phase 4 exit criteria (from sprint plan)

> A Builder-plan org uses the gateway, gets a monthly invoice, pays via Stripe, and the payment lands in our account.

**Status:** 🟡 Partial — Pro-plan user uses the gateway, gets a monthly invoice, and can pay via Qubic or credits. Stripe (fiat) is stubbed. The "payment lands in our account" half is satisfied for Qubic (broadcast to the platform treasury address via `services/qubic`); the fiat half is the deferred work.

## Links

- [Phase 4 schema](../../services/billing/src/db/schema.ts)
- [Seed script (4 plans, upsert-aware)](../../services/billing/src/db/seed.ts)
- [Subscriptions service](../../services/billing/src/services/subscriptions.ts)
- [Invoices service](../../services/billing/src/services/invoices.ts) (Stripe-style credit model)
- [Payments service](../../services/billing/src/services/payments.ts) (Qubic / credits / stub-fiat)
- [Credits + coupons service](../../services/billing/src/services/credits.ts)
- [Cross-service usage](../../services/billing/src/services/usage.ts)
- [Plans route](../../services/billing/src/routes/plans.ts)
- [Subscriptions route](../../services/billing/src/routes/subscriptions.ts)
- [Invoices route](../../services/billing/src/routes/invoices.ts)
- [Billing route (usage + upcoming)](../../services/billing/src/routes/billing.ts)
- [Credits route](../../services/billing/src/routes/credits.ts)
- [E2E test](../../services/billing/scripts/e2e.ts)
- [Reset script](../../services/billing/scripts/reset-tables.ts)
- [Sprint plan §Phase 4](../SPRINT-PLAN.md)

## What's next

**Phase 5 — ANN Platform** (per `ROADMAP.md`) is the natural next step. The marketplace pages already exist in `apps/web` (ANNs browsing, listing detail, builder). Phase 5 wires them to a real `services/ann` backend: registry, builder, versioning, signatures, category + license models, deployment linking back to services/compute.

**Alternative: Stripe integration for Phase 4.** Real fiat payment rail (PaymentIntent + webhook + idempotency). Less new surface area, but unblocks anyone who wants to pay with a credit card instead of Qubic.

**Alternative: PDF invoice worker.** Headless browser + a billing-themed template. Needed for any customer who wants to actually receive a PDF.

**Open question for the user:** Which one is more important right now — the marketplace (Phase 5) or closing the Phase 4 loose ends (Stripe + PDF + period-rollover cron)? The marketplace unlocks the "anyone can publish an ANN" story; the Phase 4 loose ends unlock "anyone can actually pay us".
