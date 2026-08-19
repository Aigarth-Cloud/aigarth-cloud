# Aigarth Billing Service

Subscription engine + usage-based metering + invoicing + payments. Modeled on Stripe's metered billing + credit-burndown pattern, adapted for Aigarth.

Port: **7005**

## Stack

- Fastify 4 + Drizzle 0.42 (thenable) + node-postgres
- Same auth pattern as the other services (JWT verify only)
- Cross-service: aggregates usage from `services/gateway` (gateway_requests) and `services/compute` (compute_jobs)
- Payments: Qubic (via services/qubic treasury), credits (internal), fiat (stubbed for now)

## Endpoints

- `GET /healthz`, `GET /readyz`
- `GET /v1/plans` — list plans
- `GET /v1/plans/:id` — read plan
- `GET /v1/subscriptions` — list user's subscriptions
- `POST /v1/subscriptions` — subscribe to a plan
- `PATCH /v1/subscriptions/:id` — change plan, set cancel-at-period-end
- `POST /v1/subscriptions/:id/cancel` — cancel immediately
- `GET /v1/invoices` — list user's invoices
- `GET /v1/invoices/:id` — read invoice (with line items)
- `POST /v1/invoices/:id/pay` — pay invoice (Qubic / credits / stub fiat)
- `GET /v1/payments` — list payments
- `GET /v1/credits` — list credits
- `POST /v1/credits/redeem` — redeem a promo code
- `GET /v1/coupons/validate?code=X` — check a coupon
- `GET /v1/billing/usage` — current-period usage summary
- `GET /v1/billing/upcoming` — preview next invoice
- `POST /v1/admin/coupons` — create a coupon (admin)
- `POST /v1/admin/invoices/generate` — generate next period's invoices (admin)

## Run

```bash
pnpm install
cp .env.example .env
# edit .env (DATABASE_URL, JWT_SECRET)
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Test

```bash
# identity, qubic, compute, gateway must all be running
pnpm tsx scripts/e2e.ts
```
