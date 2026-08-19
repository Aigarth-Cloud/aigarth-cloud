# Integration tests

End-to-end tests that hit the **live Aigarth Cloud stack**.

## What it covers

`src/trinary-e2e.test.ts` runs the full Trinary Intelligence flow:

1. Stack health check (pings `/healthz` on all 8 services)
2. Sign up a fresh user via the identity service
3. Login to get a JWT
4. Create 3 ANNs (sales / risk / finance) with the trinary decision protocol
5. Add a published version to each
6. Create a veto_aware tissue with the 3 members
7. Call `/decide` on the tissue
8. Verify the signed envelope + contributors
9. Verify the billing usage event was recorded
10. Verify the decision was persisted to `tissue_decisions`
11. Verify the tissue's `total_decisions` counter bumped
12. Cleanup: delete all the test rows

## Running

```bash
# 1. Make sure the stack is up
pnpm stack:up         # starts postgres, redis, nats, minio, mailhog
pnpm dev              # starts all 8 services + 2 apps

# 2. Run the integration test
pnpm --filter @aigarth/integration-tests test
```

If the stack is down, the test **skips gracefully** with a clear message. This is intentional — `pnpm test` should pass in CI even when the stack isn't running.

## Environment

Override any of the defaults via environment variables:

| Variable | Default |
|----------|---------|
| `AIGARTH_IDENTITY_URL` | `http://localhost:7001` |
| `AIGARTH_QUBIC_URL` | `http://localhost:7002` |
| `AIGARTH_COMPUTE_URL` | `http://localhost:7003` |
| `AIGARTH_GATEWAY_URL` | `http://localhost:7004` |
| `AIGARTH_BILLING_URL` | `http://localhost:7005` |
| `AIGARTH_ANN_URL` | `http://localhost:7006` |
| `AIGARTH_MARKETPLACE_URL` | `http://localhost:7007` |
| `AIGARTH_TISSUE_URL` | `http://localhost:7008` |
| `DATABASE_URL` | `postgres://aigarth:aigarth_dev@localhost:5432/aigarth` |
| `INTEGRATION_JWT_SECRET` | same as the dev default in `services/*/.env` |

## Test data

Each test run uses a unique `RUN_ID` (timestamp + random suffix). All ANNs, versions, tissue, members, decisions, and billing events are prefixed with `itest-${RUN_ID}-` and cleaned up in `afterAll` (best-effort, in dependency order).

If a test fails mid-run, leftover rows stay in the database until the next successful run. The teardown is idempotent (deletes by `slug` / `request_id` / `id`).

## Time-to-run

~4 seconds for the full 12-step flow. The 5s polling on the billing hook is the main floor (it usually returns in <500ms).
