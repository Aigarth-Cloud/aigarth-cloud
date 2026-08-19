# tests/integration/scripts — ad-hoc operator scripts

These are one-off scripts used during Phase 18 debugging and the
post-launch migration-system fix. They're not part of the test suite
(that's in `src/trinary-e2e.test.ts`) — they're operator tools.

Run any of them from the repo root with `node tests/integration/scripts/<name>.cjs`.

| Script | Purpose | When to run |
|---|---|---|
| `seed-migration-tables.cjs` | Insert a row into `public.{service}_migrations` so `pnpm db:migrate` becomes a no-op for an existing DB. | Fresh DBs that already have the tables from shim scripts (the 18A-18E baseline). Idempotent — safe to re-run. |
| `apply-billing-tissue-events.cjs` | Apply `services/billing/drizzle/0001_fantastic_galactus.sql` directly. | One-off: the 18E shim for billing was lost. Re-run only if `billing_tissue_usage_events` is missing. |
| `check-migration-state.cjs` | Print which per-service migrations tables exist + their rows. | When debugging "did my migration run?" |
| `check-billing-tables.cjs` | List all `billing_*` tables in the public schema. | When debugging "did the billing migration create the table?" |
| `check-demo-state.cjs` | Print the demo tissue members + their linked ANNs. | When debugging "is the demo tissue wired up correctly?" |
| `verify-demo-decide.cjs` | Sign up + log in + call /decide on `tissue_executive_v1`. | Quick smoke test for the demo. |

## Why are these here and not in `services/*/scripts/`?

The migration-system debug scripts lived in `services/*/scripts/` during
Phase 18 and were archived to `scripts/archived-migrations/scripts-archive/`
on 2026-08-04. The new home is `tests/integration/scripts/` because:

- They are post-Phase-18 leftovers from the migration-system refactor
- They reach across multiple services, so a per-service `scripts/` dir
  is the wrong shape
- Keeping them next to the integration test makes the connection
  between "the test passes" and "the DB is in the right state" obvious

The canonical create/seed/migrate paths are `pnpm db:migrate` and
`pnpm db:seed`. Use these ad-hoc scripts only when the canonical path
fails or for operator verification.
